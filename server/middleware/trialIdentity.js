import crypto from "crypto";

const TRIAL_COOKIE_NAME = "hm_trial_id";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function parseCookieHeader(cookieHeader = "") {
  return String(cookieHeader || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, pair) => {
      const i = pair.indexOf("=");
      if (i <= 0) return acc;
      const key = pair.slice(0, i).trim();
      const value = pair.slice(i + 1).trim();
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {});
}

function serializeCookie(name, value, options = {}) {
  const attrs = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge != null) attrs.push(`Max-Age=${options.maxAge}`);
  if (options.path) attrs.push(`Path=${options.path}`);
  if (options.sameSite) attrs.push(`SameSite=${options.sameSite}`);
  if (options.httpOnly) attrs.push("HttpOnly");
  if (options.secure) attrs.push("Secure");
  return attrs.join("; ");
}

function isValidTrialId(value) {
  return typeof value === "string" && value.length >= 20 && value.length <= 128;
}

export function ensureTrialIdentity(req, res, next) {
  if (req.userId) {
    next();
    return;
  }

  const cookies = parseCookieHeader(req.headers.cookie);
  let trialId = cookies[TRIAL_COOKIE_NAME];

  if (!isValidTrialId(trialId)) {
    trialId = crypto.randomUUID();
  }

  req.trialId = trialId;

  const shouldUseSecureCookie = process.env.NODE_ENV === "production";
  const cookie = serializeCookie(TRIAL_COOKIE_NAME, trialId, {
    httpOnly: true,
    sameSite: "Lax",
    secure: shouldUseSecureCookie,
    maxAge: ONE_YEAR_SECONDS,
    path: "/",
  });

  const existing = res.getHeader("Set-Cookie");
  if (!existing) {
    res.setHeader("Set-Cookie", cookie);
  } else if (Array.isArray(existing)) {
    res.setHeader("Set-Cookie", [...existing, cookie]);
  } else {
    res.setHeader("Set-Cookie", [existing, cookie]);
  }

  next();
}

import crypto from "crypto";

const TRIAL_COOKIE_NAME = "hm_trial_id";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function getClientIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) {
    return realIp.trim();
  }

  if (typeof req.ip === "string" && req.ip.trim()) {
    return req.ip.trim();
  }

  return "";
}

function getClientUserAgent(req) {
  const ua = req.headers["user-agent"];
  if (typeof ua !== "string") return "";
  return ua.replace(/\s+/g, " ").trim().slice(0, 300);
}

function createFingerprintTrialId(ip, userAgent) {
  if (!ip) return "";
  const salt = process.env.TRIAL_IDENTITY_SALT || "hm-trial-ip-salt";
  const fingerprint = userAgent ? `${ip}|${userAgent}` : ip;
  const digest = crypto.createHash("sha256").update(`${salt}:${fingerprint}`).digest("hex");
  return `fp_${digest}`;
}

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

  const clientIp = getClientIp(req);
  const userAgent = getClientUserAgent(req);
  const fingerprintTrialId = createFingerprintTrialId(clientIp, userAgent);
  const cookies = parseCookieHeader(req.headers.cookie);
  const headerTrialId = req.headers["x-trial-id"];
  let trialId =
    fingerprintTrialId ||
    (typeof headerTrialId === "string" ? headerTrialId.trim() : cookies[TRIAL_COOKIE_NAME]);

  if (!isValidTrialId(trialId)) {
    trialId = crypto.randomUUID();
  }

  req.trialId = trialId;

  const shouldUseSecureCookie = process.env.NODE_ENV === "production";
  const sameSite = shouldUseSecureCookie ? "None" : "Lax";
  const cookie = serializeCookie(TRIAL_COOKIE_NAME, trialId, {
    httpOnly: true,
    sameSite,
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

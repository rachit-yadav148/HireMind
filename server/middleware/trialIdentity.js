import crypto from "crypto";
import FreeTrialUsage from "../models/FreeTrialUsage.js";

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

/**
 * Server-side fingerprint based on IP + User-Agent.
 * Changes when IP changes (mobile networks, dynamic ISP), so it is used only
 * as a supplementary signal alongside the client-side device fingerprint.
 */
function createServerFingerprint(ip, userAgent) {
  if (!ip) return "";
  const salt = process.env.TRIAL_IDENTITY_SALT || "hm-trial-ip-salt";
  const fingerprint = userAgent ? `${ip}|${userAgent}` : ip;
  const digest = crypto.createHash("sha256").update(`${salt}:${fingerprint}`).digest("hex");
  return `fp_${digest}`;
}

/**
 * Client-supplied device fingerprint (canvas + screen + navigator signals).
 * Stable across incognito mode AND localStorage/cookie clears because it is
 * computed from hardware characteristics, not stored state.
 * We re-hash it server-side with a salt so raw client values are not stored.
 */
function normalizeClientDeviceFp(rawClientFp) {
  if (typeof rawClientFp !== "string" || rawClientFp.length < 8 || rawClientFp.length > 256) {
    return "";
  }
  const salt = process.env.TRIAL_IDENTITY_SALT || "hm-trial-ip-salt";
  const digest = crypto.createHash("sha256").update(`${salt}:cdfp:${rawClientFp}`).digest("hex");
  return `cdfp_${digest}`;
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

export async function ensureTrialIdentity(req, res, next) {
  if (req.userId) {
    next();
    return;
  }

  const clientIp = getClientIp(req);
  const userAgent = getClientUserAgent(req);
  const serverFp = createServerFingerprint(clientIp, userAgent);

  // Client-computed device fingerprint (canvas + screen + navigator).
  // Hashed server-side before storage so raw values are never stored.
  const rawClientFp = typeof req.headers["x-device-fp"] === "string"
    ? req.headers["x-device-fp"].trim()
    : "";
  const clientDeviceFp = normalizeClientDeviceFp(rawClientFp);

  const cookies = parseCookieHeader(req.headers.cookie);
  const headerTrialId = typeof req.headers["x-trial-id"] === "string"
    ? req.headers["x-trial-id"].trim()
    : "";
  const cookieTrialId = cookies[TRIAL_COOKIE_NAME] || "";

  // Build the list of fingerprints we can use to identify this device.
  // clientDeviceFp is canvas-based so it survives incognito + storage clears.
  // serverFp (IP+UA) is the legacy fallback and may change over time.
  const fingerprintsToCheck = [clientDeviceFp, serverFp].filter(Boolean);

  // -----------------------------------------------------------------------
  // Resolution order (most reliable → least reliable):
  //
  // 1. Device fingerprints — check DB FIRST, before trusting any client ID.
  //    If this device's fingerprints are already linked to a trial record,
  //    use that record's ID. This is what blocks incognito re-tries and
  //    prevents resets after localStorage/cookie clears.
  //
  // 2. Client-supplied persistent IDs (localStorage header, then HttpOnly
  //    cookie). Only used when the device has no existing trial record.
  //
  // 3. Server fingerprint as the trial ID itself (new device, no record yet).
  //
  // 4. Random UUID as last resort (no IP available, server-less env, etc.).
  // -----------------------------------------------------------------------
  let trialId = "";

  // Step 1 — fingerprint lookup (always runs, even when header/cookie present)
  if (fingerprintsToCheck.length > 0) {
    try {
      const linked = await FreeTrialUsage.findOne({
        linkedFingerprints: { $in: fingerprintsToCheck },
      })
        .select("trialId")
        .lean();
      if (linked?.trialId) {
        trialId = linked.trialId;
      }
    } catch {
      // Non-fatal: fall through to client-supplied IDs
    }
  }

  // Step 2 — client-supplied persistent IDs (only when device has no record)
  if (!trialId) {
    trialId =
      (isValidTrialId(headerTrialId) ? headerTrialId : "") ||
      (isValidTrialId(cookieTrialId) ? cookieTrialId : "") ||
      "";
  }

  // Step 3 — server fingerprint as fallback ID
  if (!trialId) {
    trialId = serverFp;
  }

  // Step 4 — random UUID if nothing else works
  if (!isValidTrialId(trialId)) {
    trialId = crypto.randomUUID();
  }

  // Link ALL current fingerprints to this trial record (non-blocking).
  // This is what enables future incognito sessions to be caught by Step 1.
  const fingerprintsToAdd = [clientDeviceFp, serverFp].filter(Boolean);
  if (fingerprintsToAdd.length > 0 && isValidTrialId(trialId)) {
    FreeTrialUsage.findOneAndUpdate(
      { trialId },
      { $addToSet: { linkedFingerprints: { $each: fingerprintsToAdd } } },
      { upsert: false }
    ).catch(() => {});
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

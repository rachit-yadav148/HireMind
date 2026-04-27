export const FREE_RESUME_ANALYSIS_KEY = "free_resume_analysis_used";
export const FREE_INTERVIEW_SECONDS_KEY = "free_interview_seconds_used";
export const FREE_INTERVIEW_TRIAL_USED_KEY = "free_interview_trial_used";
export const FREE_TRIAL_SIGNUP_TRACKED_KEY = "user_signed_up_after_trying_free_tracked";
export const FREE_TRIAL_ID_KEY = "hm_trial_id";

// ---------------------------------------------------------------------------
// Device fingerprinting — stable across incognito and localStorage clears
// Uses canvas rendering + device properties; does NOT rely on storage
// ---------------------------------------------------------------------------

function _murmurhash2(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

function _canvasToken() {
  try {
    const c = document.createElement("canvas");
    c.width = 240;
    c.height = 60;
    const g = c.getContext("2d");
    g.textBaseline = "alphabetic";
    g.fillStyle = "#f60";
    g.fillRect(100, 5, 80, 30);
    g.fillStyle = "#069";
    g.font = "bold 15px Arial,sans-serif";
    g.fillText("HM trial \u2764\ufe0f", 5, 30);
    g.fillStyle = "rgba(102,204,0,0.8)";
    g.font = "13px Georgia,serif";
    g.fillText("HM trial \u2764\ufe0f", 7, 32);
    return c.toDataURL().slice(-80);
  } catch {
    return "";
  }
}

export function getDeviceFingerprint() {
  if (typeof window === "undefined") return "";
  try {
    const nav = window.navigator;
    const scr = window.screen;
    const tz = (() => {
      try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ""; }
    })();
    const parts = [
      nav.userAgent || "",
      nav.language || "",
      (nav.languages || []).join(","),
      String(nav.hardwareConcurrency || 0),
      String(nav.deviceMemory || 0),
      nav.platform || "",
      String(scr.width),
      String(scr.height),
      String(scr.colorDepth),
      String(scr.pixelDepth || 0),
      tz,
      String(new Date().getTimezoneOffset()),
      _canvasToken(),
    ];
    return "dfp_" + _murmurhash2(parts.join("|||"));
  } catch {
    return "";
  }
}

export const FREE_RESUME_ANALYSIS_LIMIT = 1;
export const FREE_INTERVIEW_LIMIT_SECONDS = 180;

function getLocalStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function createTrialId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `trial_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

export function getOrCreateTrialId() {
  const storage = getLocalStorage();
  if (!storage) return "";
  let id = String(storage.getItem(FREE_TRIAL_ID_KEY) || "").trim();
  if (!id) {
    id = createTrialId();
    storage.setItem(FREE_TRIAL_ID_KEY, id);
  }
  return id;
}

function toSafeInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

export function getFreeResumeAnalysisUsed() {
  const storage = getLocalStorage();
  if (!storage) return 0;
  return Math.min(FREE_RESUME_ANALYSIS_LIMIT, toSafeInt(storage.getItem(FREE_RESUME_ANALYSIS_KEY)));
}

export function markFreeResumeAnalysisUsed() {
  const storage = getLocalStorage();
  if (!storage) return FREE_RESUME_ANALYSIS_LIMIT;
  storage.setItem(FREE_RESUME_ANALYSIS_KEY, String(FREE_RESUME_ANALYSIS_LIMIT));
  return FREE_RESUME_ANALYSIS_LIMIT;
}

export function getFreeInterviewSecondsUsed() {
  const storage = getLocalStorage();
  if (!storage) return 0;
  return Math.min(FREE_INTERVIEW_LIMIT_SECONDS, toSafeInt(storage.getItem(FREE_INTERVIEW_SECONDS_KEY)));
}

export function addFreeInterviewSecondsUsed(deltaSeconds) {
  const storage = getLocalStorage();
  if (!storage) return 0;
  const current = getFreeInterviewSecondsUsed();
  const next = Math.min(FREE_INTERVIEW_LIMIT_SECONDS, current + Math.max(0, toSafeInt(deltaSeconds)));
  storage.setItem(FREE_INTERVIEW_SECONDS_KEY, String(next));
  return next;
}

export function getRemainingFreeInterviewSeconds() {
  return Math.max(0, FREE_INTERVIEW_LIMIT_SECONDS - getFreeInterviewSecondsUsed());
}

export function hasUsedFreeInterviewTrial() {
  const storage = getLocalStorage();
  if (!storage) return false;
  if (storage.getItem(FREE_INTERVIEW_TRIAL_USED_KEY) === "1") return true;
  return getFreeInterviewSecondsUsed() > 0;
}

export function markFreeInterviewTrialUsed() {
  const storage = getLocalStorage();
  if (!storage) return;
  storage.setItem(FREE_INTERVIEW_TRIAL_USED_KEY, "1");
}

export function getRemainingFreeInterviewTrials() {
  return hasUsedFreeInterviewTrial() ? 0 : 1;
}

export function hasFreeTrialUsage() {
  return getFreeResumeAnalysisUsed() > 0 || getFreeInterviewSecondsUsed() > 0;
}

export function shouldTrackUserSignedUpAfterTryingFree() {
  const storage = getLocalStorage();
  if (!storage) return false;
  if (!hasFreeTrialUsage()) return false;
  if (storage.getItem(FREE_TRIAL_SIGNUP_TRACKED_KEY) === "1") return false;
  storage.setItem(FREE_TRIAL_SIGNUP_TRACKED_KEY, "1");
  return true;
}

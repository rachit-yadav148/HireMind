export const FREE_RESUME_ANALYSIS_KEY = "free_resume_analysis_used";
export const FREE_INTERVIEW_SECONDS_KEY = "free_interview_seconds_used";
export const FREE_INTERVIEW_TRIAL_USED_KEY = "free_interview_trial_used";
export const FREE_TRIAL_SIGNUP_TRACKED_KEY = "user_signed_up_after_trying_free_tracked";

export const FREE_RESUME_ANALYSIS_LIMIT = 1;
export const FREE_INTERVIEW_LIMIT_SECONDS = 180;

function getLocalStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
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

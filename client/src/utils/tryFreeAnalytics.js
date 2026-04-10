import posthog from "../posthog";

const SOURCE = "landing_page_try_free";

function withDefaultSource(properties = {}) {
  return {
    source: SOURCE,
    ...properties,
  };
}

export function trackResumeAnalysisTryFreeClicked() {
  posthog.capture("resume_analysis_try_free_clicked", withDefaultSource());
}

export function trackAiInterviewTryFreeClicked() {
  posthog.capture("ai_interview_try_free_clicked", withDefaultSource());
}

export function trackResumeAnalysisFreeCompleted(properties = {}) {
  posthog.capture("resume_analysis_free_completed", withDefaultSource(properties));
}

export function trackAiInterviewFreeStarted(properties = {}) {
  posthog.capture("ai_interview_free_started", withDefaultSource(properties));
}

export function trackAiInterviewFreeLimitReached(properties = {}) {
  posthog.capture("ai_interview_free_limit_reached", withDefaultSource(properties));
}

export function trackUserSignedUpAfterTryingFree(properties = {}) {
  posthog.capture("user_signed_up_after_trying_free", withDefaultSource(properties));
}

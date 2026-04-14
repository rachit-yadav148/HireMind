import { useCallback, useEffect, useState } from "react";
import { api, getApiErrorMessage } from "../services/api";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import posthog from "../posthog";
import { useAuth } from "../context/AuthContext";
import { useCredits } from "../context/CreditContext";
import SignupPromptModal from "../components/SignupPromptModal";
import CreditQuotaModal from "../components/CreditQuotaModal";
import {
  FREE_INTERVIEW_LIMIT_SECONDS,
  addFreeInterviewSecondsUsed,
  getRemainingFreeInterviewTrials,
  getFreeInterviewSecondsUsed,
  hasUsedFreeInterviewTrial,
  markFreeInterviewTrialUsed,
  getRemainingFreeInterviewSeconds,
} from "../utils/freeTrial";
import { trackAiInterviewFreeLimitReached, trackAiInterviewFreeStarted } from "../utils/tryFreeAnalytics";

const TIMER_OPTIONS = [
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
  { label: "1 hour", value: 60 },
  { label: "1.5 hour", value: 90 },
  { label: "2 hours", value: 120 },
];

function formatDuration(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function speak(text, onEnd) {
  if (!text || !window.speechSynthesis) {
    onEnd?.();
    return;
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.95;
  u.pitch = 1;
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  window.speechSynthesis.speak(u);
}

export default function InterviewSimulator() {
  const { isAuthenticated } = useAuth();
  const { refreshCredits } = useCredits();
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [jdFile, setJdFile] = useState(null);
  const [resumeFile, setResumeFile] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [stage, setStage] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [report, setReport] = useState(null);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [timerEnding, setTimerEnding] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [ratingMessage, setRatingMessage] = useState("");
  const [ttsError, setTtsError] = useState("");
  const [audioStatus, setAudioStatus] = useState("");
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [trialStatus, setTrialStatus] = useState(null);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [creditError, setCreditError] = useState(null);

  const remainingFreeInterviewSeconds =
    trialStatus?.mode === "guest"
      ? Math.max(0, Number(trialStatus.interviewSecondsLeft ?? 0))
      : !isAuthenticated
      ? getRemainingFreeInterviewSeconds()
      : null;
  const remainingFreeInterviewMinutes =
    remainingFreeInterviewSeconds !== null ? Math.ceil(remainingFreeInterviewSeconds / 60) : null;
  const remainingFreeInterviewTrials =
    trialStatus?.mode === "guest"
      ? Math.max(0, Number(trialStatus.interviewTrialsLeft ?? 0))
      : !isAuthenticated
      ? getRemainingFreeInterviewTrials()
      : null;

  const guestMode = !isAuthenticated;
  const pageShellClass = guestMode
    ? "-mx-4 sm:-mx-6 md:-mx-10 min-h-screen bg-chromatic px-4 py-6 sm:px-6 md:px-10"
    : "";
  const innerShellClass = guestMode
    ? "relative mx-auto w-full max-w-5xl overflow-hidden pb-14"
    : "mx-auto w-full max-w-5xl pb-10";
  const surfaceClass = guestMode
    ? "rounded-3xl border border-slate-700/60 bg-slate-900/35 backdrop-blur-sm shadow-card"
    : "rounded-2xl border border-slate-800 bg-slate-900/40";

  const { supported, listening, transcript, error: speechErr, start, stop, reset } =
    useSpeechRecognition();

  const [typedAnswer, setTypedAnswer] = useState("");

  useEffect(() => {
    let active = true;

    async function loadTrialStatus() {
      try {
        const { data } = await api.get("/trial/status");
        if (!active) return;
        setTrialStatus(data || null);
      } catch {
        if (!active) return;
        setTrialStatus(null);
      }
    }

    loadTrialStatus();
    return () => {
      active = false;
    };
  }, []);

  const isMobileBrowser = useCallback(() => {
    if (typeof window === "undefined") return false;
    const touchDevice = navigator.maxTouchPoints > 0;
    const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches;
    return Boolean(touchDevice || coarsePointer);
  }, []);

  const appendMsg = useCallback((role, content, extra = {}) => {
    setMessages((m) => [...m, { role, content, ...extra, t: Date.now() }]);
  }, []);

  const primeSpeechSynthesis = useCallback(() => {
    if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance === "undefined") {
      setTtsError("Text-to-speech is not supported in this browser.");
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const primer = new SpeechSynthesisUtterance(" ");
      primer.volume = 0;
      window.speechSynthesis.speak(primer);
      setTtsError("");
    } catch {
      setTtsError("Question audio is blocked. Tap Replay question and check volume/silent mode.");
    }
  }, []);

  const speakText = useCallback((text, onEnd) => {
    if (!text || !window.speechSynthesis || typeof window.SpeechSynthesisUtterance === "undefined") {
      onEnd?.();
      return;
    }

    try {
      setTtsError("");
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.95;
      u.pitch = 1;
      u.onend = () => onEnd?.();
      u.onerror = () => {
        setTtsError("Could not play question audio. Tap Replay question and increase media volume.");
        onEnd?.();
      };
      window.speechSynthesis.speak(u);

      window.setTimeout(() => {
        if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
          setTtsError("Question audio may be blocked. Tap Replay question once to enable TTS.");
        }
      }, 600);
    } catch {
      setTtsError("Could not play question audio. Tap Replay question and increase media volume.");
      onEnd?.();
    }
  }, []);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    if (!sessionId || report || !timerActive || timeLeft <= 0) return;
    const id = setInterval(() => {
      if (!isAuthenticated) {
        addFreeInterviewSecondsUsed(1);
      }
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [sessionId, report, timerActive, timeLeft, isAuthenticated]);

  useEffect(() => {
    if (!sessionId || report || !timerActive) return;
    if (timeLeft > 0 || timerEnding || loading) return;
    if (!isAuthenticated && getFreeInterviewSecondsUsed() >= FREE_INTERVIEW_LIMIT_SECONDS) {
      trackAiInterviewFreeLimitReached({
        resume_uploaded: Boolean(resumeFile),
        job_description_present: Boolean(jdFile),
        target_company: company,
        target_role: role,
      });
      setShowSignupPrompt(true);
    }
    setTimerEnding(true);
    endInterviewEarly(true);
  }, [
    timeLeft,
    sessionId,
    report,
    timerActive,
    timerEnding,
    loading,
    isAuthenticated,
    resumeFile,
    jdFile,
    company,
    role,
  ]);

  async function handleStart(e) {
    e.preventDefault();
    setApiError("");
    primeSpeechSynthesis();
    if (isMobileBrowser()) {
      void enableAudioAndMic();
    }
    if (
      !isAuthenticated &&
      ((trialStatus?.mode === "guest" && Number(trialStatus.interviewTrialsLeft ?? 0) <= 0) ||
        hasUsedFreeInterviewTrial() ||
        getFreeInterviewSecondsUsed() >= FREE_INTERVIEW_LIMIT_SECONDS)
    ) {
      setShowSignupPrompt(true);
      setApiError("Your free AI interview trial is used. Create a free account to continue practicing.");
      trackAiInterviewFreeLimitReached({
        resume_uploaded: Boolean(resumeFile),
        job_description_present: Boolean(jdFile),
        target_company: company,
        target_role: role,
      });
      return;
    }
    if (!resumeFile) {
      setApiError("Resume is required to start interview.");
      return;
    }
    setLoading(true);
    setReport(null);
    setMessages([]);
    try {
      const fd = new FormData();
      fd.append("company", company);
      fd.append("role", role);
      if (jdFile) fd.append("jobDescription", jdFile);
      if (resumeFile) fd.append("resume", resumeFile);

      const { data } = await api.post("/interviews/start", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const remainingFreeSeconds =
        trialStatus?.mode === "guest"
          ? Math.max(0, Number(trialStatus.interviewSecondsLeft ?? 0))
          : getRemainingFreeInterviewSeconds();
      const initialTimeLeft = !isAuthenticated
        ? Math.max(1, Math.min(durationMinutes * 60, remainingFreeSeconds))
        : durationMinutes * 60;

      setSessionId(data.sessionId);
      setCurrentQuestion(data.question);
      setStage(data.stage || "technical");
      setTimeLeft(initialTimeLeft);
      if (!isAuthenticated) {
        markFreeInterviewTrialUsed();
        try {
          const { data: status } = await api.get("/trial/status");
          setTrialStatus(status || null);
        } catch {
          /* noop */
        }
      }
      setTimerActive(true);
      setTimerEnding(false);
      setRating(0);
      setRatingSubmitted(false);
      setRatingMessage("");
      appendMsg("interviewer", data.question);
      posthog.capture("interview_started", {
        company,
        role,
        duration_minutes: durationMinutes,
      });

      // Track credit usage for authenticated users
      if (isAuthenticated) {
        posthog.capture("credit_used", { feature: "interview", amount: 10 });
        refreshCredits();
      }

      if (!isAuthenticated) {
        trackAiInterviewFreeStarted({
          resume_uploaded: Boolean(resumeFile),
          job_description_present: Boolean(jdFile),
          target_company: company,
          target_role: role,
        });
      }
      speakText(data.question);
      reset();
    } catch (err) {
      const errorCode = err?.response?.data?.code;
      if (isAuthenticated && (errorCode === "INSUFFICIENT_CREDITS" || errorCode === "UNLIMITED_CAP_REACHED")) {
        setCreditError(err.response.data);
        setShowCreditModal(true);
        setApiError(err.response.data.message);
      } else {
        setApiError(getApiErrorMessage(err, "Could not start interview"));
        if (errorCode === "FREE_LIMIT_REACHED") {
          setShowSignupPrompt(true);
          try {
            const { data: status } = await api.get("/trial/status");
            setTrialStatus(status || null);
          } catch {
            /* noop */
          }
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function submitAnswer() {
    if (!sessionId || !currentQuestion) return;
    const answer = (transcript.trim() || typedAnswer.trim());
    if (!answer) {
      setApiError("Speak your answer (or type it below), then submit.");
      return;
    }
    stop();
    setApiError("");
    setLoading(true);
    appendMsg("you", answer);

    try {
      const { data } = await api.post("/interviews/answer", {
        sessionId,
        question: currentQuestion,
        answer,
      });

      appendMsg("feedback", data.feedback, { kind: "feedback" });

      if (data.completed && data.report) {
        const answeredCount = messages.filter((m) => m.role === "you").length + 1;
        setReport(data.report);
        setTimerActive(false);
        setCurrentQuestion("");
        posthog.capture("interview_completed", {
          questions_answered: answeredCount,
        });
        speakText("Interview complete. Here is your report summary.");
        return;
      }

      if (data.nextQuestion) {
        setCurrentQuestion(data.nextQuestion);
        setStage(data.stage || stage);
        appendMsg("interviewer", data.nextQuestion);
        speakText(data.nextQuestion);
      }
      reset();
      setTypedAnswer("");
    } catch (err) {
      setApiError(getApiErrorMessage(err, "Failed to submit answer"));
      if (err?.response?.data?.code === "FREE_LIMIT_REACHED") {
        setShowSignupPrompt(true);
      }
    } finally {
      setLoading(false);
    }
  }

  async function endInterviewEarly(triggeredByTimer = false) {
    const isTimerTriggered = triggeredByTimer === true;
    if (!sessionId) return;
    if (isTimerTriggered) {
      setApiError("Time is up. Ending interview and preparing your report...");
    } else {
      setApiError("Ending Interview and preparing your report...");
    }
    setLoading(true);
    stop();
    try {
      const { data } = await api.post("/interviews/end", { sessionId });
      if (data?.report) {
        const answeredCount = messages.filter((m) => m.role === "you").length;
        setReport(data.report);
        setTimerActive(false);
        setCurrentQuestion("");
        posthog.capture("interview_completed", {
          questions_answered: answeredCount,
        });
        speakText(
          isTimerTriggered
            ? "Time is up. Interview ended. Here is your summary and score."
            : "Interview ended. Here is your summary and score."
        );
      }
    } catch (err) {
      setApiError(getApiErrorMessage(err, "Failed to end interview"));
      if (err?.response?.data?.code === "FREE_LIMIT_REACHED") {
        setShowSignupPrompt(true);
      }
    } finally {
      setTimerEnding(false);
      setLoading(false);
    }
  }

  async function submitInterviewRating() {
    if (!sessionId || rating < 1 || rating > 5 || ratingSubmitted) return;
    setRatingLoading(true);
    setRatingMessage("");
    try {
      await api.post("/interviews/rate", { sessionId, rating });
      setRatingSubmitted(true);
      setRatingMessage("Thanks! Your feedback was submitted.");
    } catch (err) {
      setRatingMessage(getApiErrorMessage(err, "Failed to submit rating"));
    } finally {
      setRatingLoading(false);
    }
  }

  async function enableAudioAndMic() {
    setAudioStatus("");
    primeSpeechSynthesis();

    if (!navigator.mediaDevices?.getUserMedia) {
      setAudioStatus("Microphone permission API is not available in this browser. Use typing fallback.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setAudioStatus("Click on Start microphone and start speaking.");
    } catch (err) {
      const code = String(err?.name || err?.message || "").toLowerCase();
      if (code.includes("notallowed") || code.includes("permission") || code.includes("denied")) {
        setAudioStatus("Microphone permission denied. Allow mic in browser/site settings and reload.");
      } else {
        setAudioStatus("Could not initialize microphone. You can still type your answer below.");
      }
    }
  }

  function replayQuestion() {
    primeSpeechSynthesis();
    if (currentQuestion) speakText(currentQuestion);
  }

  return (
    <div className={pageShellClass}>
      <div className={innerShellClass}>
      {guestMode && <div className="pointer-events-none absolute -top-16 -left-16 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />}
      {guestMode && <div className="pointer-events-none absolute top-1/3 -right-20 h-64 w-64 rounded-full bg-fuchsia-500/18 blur-3xl" />}
      {guestMode && <div className="pointer-events-none absolute bottom-0 left-1/4 h-56 w-56 rounded-full bg-indigo-400/16 blur-3xl" />}

      <div className={`relative z-10 mb-6 p-5 md:p-6 ${surfaceClass}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-white">AI Interview Simulator</h1>
            <p className="text-slate-300 mt-2 max-w-xl text-sm md:text-base">
              Practice realistic company-specific interviews with voice flow, live feedback, and final
              scoring.
            </p>
          </div>
          {remainingFreeInterviewMinutes !== null && remainingFreeInterviewTrials !== null && (
            <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs md:text-sm text-cyan-200">
              Free trial left: <span className="font-semibold">{remainingFreeInterviewTrials}</span> · Time:
              <span className="font-semibold"> ~{remainingFreeInterviewMinutes} min</span>
            </div>
          )}
        </div>
      </div>

      {!sessionId && (
        <form
          onSubmit={handleStart}
          className={`relative z-10 p-5 md:p-6 mb-8 max-w-2xl grid gap-4 sm:grid-cols-2 ${surfaceClass}`}
        >
          {apiError && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-sm px-4 py-3 sm:col-span-2">
              {apiError}
            </div>
          )}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Target company</label>
            <input
              required
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full rounded-lg bg-slate-900/80 border border-slate-600/80 px-3 py-2 text-sm text-white"
              placeholder="e.g. Google"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Target role</label>
            <input
              required
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-lg bg-slate-900/80 border border-slate-600/80 px-3 py-2 text-sm text-white"
              placeholder="e.g. SWE Intern"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs text-slate-400 mb-1">
              Job Description (optional)
            </label>
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => setJdFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-slate-400"
            />
            {jdFile && (
              <p className="text-xs text-slate-500 mt-2">Selected: {jdFile.name}</p>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-slate-400 mb-1">Resume (required)</label>
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
              required
              onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-slate-400"
            />
            {resumeFile && (
              <p className="text-xs text-slate-500 mt-2">Selected: {resumeFile.name}</p>
            )}
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Interview duration</label>
            <select
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="w-full rounded-lg bg-slate-900/80 border border-slate-600/80 px-3 py-2 text-sm text-white"
            >
              {TIMER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`sm:col-span-2 font-semibold disabled:opacity-50 text-white py-3 rounded-xl ${
              guestMode
                ? "bg-gradient-to-r from-brand-500 to-fuchsia-500 hover:from-brand-400 hover:to-fuchsia-400 shadow-glow"
                : "bg-brand-500 hover:bg-brand-400"
            }`}
          >
            {loading ? "Starting…" : "Start voice interview"}
          </button>
        </form>
      )}

      {sessionId && !report && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className={`lg:col-span-2 min-h-[380px] flex flex-col ${surfaceClass}`}>
            <div className="border-b border-slate-800 px-4 py-3 flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-slate-500">
                Stage: <span className="text-brand-400">{stage}</span>
              </span>
              <span className="text-xs uppercase tracking-wide text-slate-500">
                Time left: <span className="text-amber-400">{formatDuration(timeLeft)}</span>
              </span>
              {currentQuestion && (
                <button
                  type="button"
                  onClick={replayQuestion}
                  className="text-xs text-brand-400 hover:text-brand-300"
                >
                  Replay question (TTS)
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[480px]">
              {messages.map((m) => (
                <div
                  key={m.t}
                  className={`rounded-xl px-4 py-3 text-sm ${
                    m.role === "you"
                      ? "bg-brand-500/10 border border-brand-500/25 ml-8"
                      : m.kind === "feedback"
                        ? "bg-amber-500/10 border border-amber-500/25"
                        : "bg-slate-800/60 border border-slate-700 mr-8"
                  }`}
                >
                  <p className="text-xs text-slate-500 mb-1">
                    {m.role === "you"
                      ? "You"
                      : m.kind === "feedback"
                        ? "AI feedback"
                        : "Interviewer"}
                  </p>
                  <p className="text-slate-200 whitespace-pre-wrap">{m.content}</p>
                </div>
              ))}
            </div>
          </div>

          <div className={`p-4 space-y-4 h-fit ${surfaceClass}`}>
            <h3 className="font-display font-semibold text-white">Your answer</h3>
            {!supported && (
              <p className="text-xs text-amber-400">
                Voice input is not supported in this browser/device combination. Open over HTTPS,
                allow microphone permission, or type your answer below.
              </p>
            )}
            {speechErr && <p className="text-xs text-red-400">Mic: {speechErr}</p>}
            {ttsError && <p className="text-xs text-amber-300">TTS: {ttsError}</p>}
            {audioStatus && (
              <p className={`text-xs ${audioStatus.includes("enabled") ? "text-emerald-300" : "text-amber-300"}`}>
                {audioStatus}
              </p>
            )}

            <div className="rounded-lg bg-slate-900/80 border border-slate-600/80 min-h-[100px] p-3 text-sm text-slate-300">
              {transcript || (listening ? "Listening…" : "Press start and speak your answer.")}
            </div>
            <label className="block text-xs text-slate-500 mt-3">Or type your answer</label>
            <textarea
              value={typedAnswer}
              onChange={(e) => setTypedAnswer(e.target.value)}
              rows={3}
              className="w-full rounded-lg bg-slate-900/80 border border-slate-600/80 px-3 py-2 text-sm text-white placeholder:text-slate-500"
              placeholder="Fallback if microphone is unavailable"
            />

            <div className="flex flex-wrap gap-2">
              {!listening ? (
                <button
                  type="button"
                  onClick={start}
                  disabled={!supported || loading}
                  className="font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm"
                >
                  Start microphone
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stop}
                  className="font-medium bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-lg text-sm"
                >
                  Stop
                </button>
              )}
              <button
                type="button"
                onClick={submitAnswer}
                disabled={loading || !currentQuestion}
                className={`font-medium disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm ${
                  guestMode
                    ? "bg-gradient-to-r from-cyan-500 to-brand-500 hover:from-cyan-400 hover:to-brand-400"
                    : "bg-brand-500 hover:bg-brand-400"
                }`}
              >
                {loading ? "Sending…" : "Submit answer"}
              </button>
              <button
                type="button"
                onClick={() => endInterviewEarly(false)}
                disabled={loading || !sessionId}
                className="font-medium bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm"
              >
                End Interview
              </button>
            </div>
            {apiError && (
              <p className="text-xs text-red-400">{apiError}</p>
            )}
            <p className="text-xs text-slate-500">
              Tip: Answer clearly after clicking Start microphone. Submit sends your transcript to
              advanced AI for feedback and the next question.
            </p>
          </div>
        </div>
      )}

      {report && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-8 max-w-2xl">
          <h2 className="font-display text-2xl font-bold text-white mb-2">Interview report</h2>
          <p className="text-slate-400 text-sm mb-6">Scores are indicative and for practice only.</p>
          <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-5 text-center mb-6">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Interview Score</p>
            <p className="text-4xl font-bold text-brand-400 tabular-nums mt-1">
              {report.interviewScore ?? Math.round(((report.communicationScore || 0) + (report.technicalDepth || 0) + (report.confidenceScore || 0)) / 3)}
              <span className="text-lg text-slate-500"> / 100</span>
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: "Communication", value: report.communicationScore },
              { label: "Technical depth", value: report.technicalDepth },
              { label: "Confidence", value: report.confidenceScore },
            ].map((x) => (
              <div key={x.label} className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 text-center">
                <p className="text-3xl font-bold text-brand-400 tabular-nums">{x.value}</p>
                <p className="text-xs text-slate-500 mt-1">{x.label}</p>
              </div>
            ))}
          </div>
          <h3 className="font-semibold text-white mb-2">Suggestions</h3>
          <ul className="space-y-2 text-sm text-slate-300">
            {(report.suggestions || []).map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-brand-500">•</span>
                {s}
              </li>
            ))}
          </ul>

          <div className="mt-6 rounded-xl bg-slate-900/60 border border-slate-800 p-4">
            <p className="text-sm text-slate-300 mb-2">Rate this AI interview experience</p>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => !ratingSubmitted && setRating(v)}
                  className={`text-2xl ${v <= rating ? "text-amber-400" : "text-slate-600"} ${
                    ratingSubmitted ? "cursor-default" : "hover:text-amber-300"
                  }`}
                  aria-label={`Rate ${v} star${v > 1 ? "s" : ""}`}
                >
                  ★
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={submitInterviewRating}
                disabled={ratingLoading || ratingSubmitted || rating < 1}
                className="font-medium bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm"
              >
                {ratingLoading ? "Submitting…" : ratingSubmitted ? "Submitted" : "Submit rating"}
              </button>
              {ratingMessage && <p className="text-xs text-slate-400">{ratingMessage}</p>}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setTimerActive(false);
              setTimeLeft(0);
              setApiError("");
              setSessionId(null);
              setReport(null);
              setMessages([]);
              setCurrentQuestion("");
              setRating(0);
              setRatingSubmitted(false);
              setRatingMessage("");
            }}
            className="mt-8 font-semibold bg-brand-500 hover:bg-brand-400 text-white px-5 py-2.5 rounded-xl"
          >
            New interview
          </button>
        </div>
      )}

      <SignupPromptModal open={showSignupPrompt} onClose={() => setShowSignupPrompt(false)} feature="ai_interview" />
      <CreditQuotaModal
        isOpen={showCreditModal}
        onClose={() => setShowCreditModal(false)}
        reason={creditError?.code}
        creditsNeeded={creditError?.creditsNeeded || 0}
      />
      </div>
    </div>
  );
}

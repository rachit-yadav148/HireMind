import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  MessageCircle,
  Cpu,
  Shield,
  Lightbulb,
  Star,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { api, getApiErrorMessage } from "../services/api";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import posthog from "../posthog";
import { useAuth } from "../context/AuthContext";
import { useCredits } from "../context/CreditContext";
import SignupPromptModal from "../components/SignupPromptModal";
import CreditQuotaModal from "../components/CreditQuotaModal";
import RecruiterInterviewUI from "../components/interview/RecruiterInterviewUI";
import PressureInterviewUI from "../components/interview/PressureInterviewUI";
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

const REPORT_STAGGER = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.055, delayChildren: 0.06 },
  },
};

const REPORT_ITEM = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
  },
};

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
  const jdInputRef = useRef(null);
  const resumeInputRef = useRef(null);
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
  const [interviewMode, setInterviewMode] = useState("practice");
  const [conversationalSession, setConversationalSession] = useState(null);
  const [animatedMainScore, setAnimatedMainScore] = useState(0);

  useEffect(() => {
    if (!report) {
      setAnimatedMainScore(0);
      return;
    }
    const target =
      report.interviewScore ??
      Math.round(
        ((report.communicationScore || 0) + (report.technicalDepth || 0) + (report.confidenceScore || 0)) / 3
      );
    let frame;
    let cancelled = false;
    const start = performance.now();
    const duration = 820;
    function easeOutCubic(t) {
      return 1 - (1 - t) ** 3;
    }
    function step(now) {
      if (cancelled) return;
      const p = Math.min(1, (now - start) / duration);
      setAnimatedMainScore(Math.round(target * easeOutCubic(p)));
      if (p < 1) frame = requestAnimationFrame(step);
    }
    frame = requestAnimationFrame(step);
    return () => {
      cancelled = true;
      if (frame) cancelAnimationFrame(frame);
    };
  }, [report]);

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
    setConversationalSession(null);

    // Recruiter / Pressure mode — use conversational endpoint
    if (interviewMode === "recruiter" || interviewMode === "pressure") {
      try {
        const fd = new FormData();
        fd.append("company", company);
        fd.append("role", role);
        fd.append("mode", interviewMode);
        if (jdFile) fd.append("jobDescription", jdFile);
        if (resumeFile) fd.append("resume", resumeFile);

        const { data } = await api.post("/interviews/start-conversational", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        posthog.capture("interview_started", {
          company, role, duration_minutes: durationMinutes, mode: interviewMode,
        });
        if (isAuthenticated) {
          posthog.capture("credit_used", { feature: "interview", amount: 10 });
          refreshCredits();
        }
        if (!isAuthenticated) {
          markFreeInterviewTrialUsed();
          trackAiInterviewFreeStarted({
            resume_uploaded: Boolean(resumeFile),
            job_description_present: Boolean(jdFile),
            target_company: company,
            target_role: role,
          });
        }

        setConversationalSession({
          sessionId: data.sessionId,
          aiMessage: data.aiMessage,
          candidateName: data.candidateName || "",
          mode: interviewMode,
        });
      } catch (err) {
        const errorCode = err?.response?.data?.code;
        if (isAuthenticated && (errorCode === "INSUFFICIENT_CREDITS" || errorCode === "UNLIMITED_CAP_REACHED")) {
          setCreditError(err.response.data);
          setShowCreditModal(true);
          setApiError(err.response.data.message);
        } else {
          setApiError(getApiErrorMessage(err, "Could not start interview"));
          if (errorCode === "FREE_LIMIT_REACHED") setShowSignupPrompt(true);
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    // Practice mode — existing flow
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
        mode: "practice",
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

      if (data.conductWarning && data.interviewerPrompt) {
        if (data.feedback && String(data.feedback).trim()) {
          appendMsg("feedback", data.feedback, { kind: "feedback" });
        }
        appendMsg("interviewer", data.interviewerPrompt);
        speakText(data.interviewerPrompt);
        reset();
        setTypedAnswer("");
        return;
      }

      if (data.feedback && String(data.feedback).trim()) {
        appendMsg("feedback", data.feedback, { kind: "feedback" });
      }

      if (data.completed && data.report) {
        const answeredCount = messages.filter((m) => m.role === "you").length + 1;
        setReport(data.report);
        setTimerActive(false);
        setCurrentQuestion("");
        posthog.capture("interview_completed", {
          questions_answered: answeredCount,
        });
        speakText(data.closingMessage || "Interview complete. Here is your report summary.");
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

      {!conversationalSession && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38 }}
          className={`relative z-10 mb-5 p-5 md:p-6 ${surfaceClass}`}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-brand-500 flex items-center justify-center shadow-lg shrink-0">
                <span className="text-xl">🎙️</span>
              </div>
              <div>
                <h1 className="font-display text-2xl md:text-3xl font-bold text-white">AI Interview Simulator</h1>
                <p className="text-slate-400 mt-0.5 text-sm md:text-base max-w-xl">
                  Practice realistic company-specific interviews with voice flow, live feedback, and final scoring.
                </p>
              </div>
            </div>
            {remainingFreeInterviewMinutes !== null && remainingFreeInterviewTrials !== null && (
              <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-200 font-medium shrink-0">
                {remainingFreeInterviewTrials} trial{remainingFreeInterviewTrials !== 1 ? "s" : ""} left · ~{remainingFreeInterviewMinutes} min
              </div>
            )}
          </div>
        </motion.div>
      )}

      {!sessionId && !conversationalSession && (
        <motion.form
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onSubmit={handleStart}
          className={`relative z-10 p-5 md:p-6 mb-8 max-w-2xl grid gap-5 sm:grid-cols-2 ${surfaceClass}`}
        >
          <AnimatePresence>
            {apiError && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-sm px-4 py-3 sm:col-span-2"
              >
                {apiError}
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Target company *</label>
            <input
              required
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full rounded-xl bg-slate-900/80 border border-slate-700 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-brand-500/60 transition-colors"
              placeholder="e.g. Google"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Target role *</label>
            <input
              required
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-xl bg-slate-900/80 border border-slate-700 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-brand-500/60 transition-colors"
              placeholder="e.g. SWE Intern"
            />
          </div>

          {/* File uploads */}
          <div className="sm:col-span-2 grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Job Description</label>
              <input
                ref={jdInputRef}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => setJdFile(e.target.files?.[0] || null)}
              />
              <button
                type="button"
                onClick={() => jdInputRef.current?.click()}
                className={`w-full rounded-xl border-2 border-dashed py-3 px-4 text-sm text-left transition-all ${
                  jdFile
                    ? "border-cyan-500/50 bg-cyan-500/5 text-cyan-300"
                    : "border-slate-700 hover:border-slate-500 text-slate-400"
                }`}
              >
                {jdFile ? `✓ ${jdFile.name}` : "📄 JD file (optional)"}
              </button>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Resume *</label>
              <input
                ref={resumeInputRef}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
              />
              <button
                type="button"
                onClick={() => resumeInputRef.current?.click()}
                className={`w-full rounded-xl border-2 border-dashed py-3 px-4 text-sm text-left transition-all ${
                  resumeFile
                    ? "border-brand-500/50 bg-brand-500/5 text-brand-300"
                    : "border-slate-700 hover:border-slate-500 text-slate-400"
                }`}
              >
                {resumeFile ? `✓ ${resumeFile.name}` : "📋 Resume (required)"}
              </button>
            </div>
          </div>

          {/* Interview mode */}
          <div className="sm:col-span-2">
            <label className="block text-xs text-slate-400 mb-2">Interview mode</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "practice",  label: "Practice",  desc: "Relaxed, guided Q&A with feedback",  icon: "🎯", color: "from-emerald-500 to-cyan-500" },
                { id: "recruiter", label: "Recruiter", desc: "Realistic 1-on-1 conversation",       icon: "🎙️", color: "from-brand-500 to-violet-500" },
                { id: "pressure",  label: "Pressure",  desc: "Proctored with cam & screen lock",   icon: "🔴", color: "from-red-500 to-rose-600" },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setInterviewMode(m.id)}
                  className={`p-3.5 rounded-xl border text-left transition-all duration-200 ${
                    interviewMode === m.id
                      ? "border-brand-500/60 bg-brand-500/12 ring-1 ring-brand-500/25"
                      : "border-slate-700 bg-slate-800/40 hover:border-slate-600 hover:bg-slate-800/70"
                  }`}
                >
                  <span className="text-xl block mb-1.5">{m.icon}</span>
                  <p className={`text-sm font-semibold ${interviewMode === m.id ? "text-brand-300" : "text-white"}`}>
                    {m.label}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">{m.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Interview duration</label>
            <select
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="w-full rounded-xl bg-slate-900/80 border border-slate-700 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500/60 transition-colors"
            >
              {TIMER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: !loading ? 1.015 : 1 }}
            whileTap={{ scale: 0.98 }}
            className={`sm:col-span-2 font-semibold disabled:opacity-50 text-white py-3.5 rounded-xl text-sm transition-shadow shadow-lg ${
              guestMode
                ? "bg-gradient-to-r from-brand-500 to-fuchsia-500 hover:from-brand-400 hover:to-fuchsia-400 shadow-glow"
                : "bg-gradient-to-r from-brand-500 to-cyan-500 hover:from-brand-400 hover:to-cyan-400"
            }`}
          >
            {loading
              ? "Starting…"
              : interviewMode === "practice"
              ? "🎯 Start practice interview"
              : interviewMode === "recruiter"
              ? "🎙️ Start recruiter interview"
              : "🔴 Start pressure interview"}
          </motion.button>
        </motion.form>
      )}

      {conversationalSession && !report && (
        <div className="relative z-10">
          {conversationalSession.mode === "pressure" ? (
            <PressureInterviewUI
              sessionId={conversationalSession.sessionId}
              initialAiMessage={conversationalSession.aiMessage}
              candidateName={conversationalSession.candidateName}
              durationMinutes={durationMinutes}
              onEnd={() => {}}
              onReport={(r) => {
                setSessionId(conversationalSession.sessionId);
                setReport(r);
                setConversationalSession(null);
              }}
            />
          ) : (
            <RecruiterInterviewUI
              sessionId={conversationalSession.sessionId}
              initialAiMessage={conversationalSession.aiMessage}
              candidateName={conversationalSession.candidateName}
              durationMinutes={durationMinutes}
              mode="recruiter"
              onEnd={() => {}}
              onReport={(r) => {
                setSessionId(conversationalSession.sessionId);
                setReport(r);
                setConversationalSession(null);
              }}
            />
          )}
        </div>
      )}

      {sessionId && !report && !conversationalSession && (
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
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className={`relative z-10 mx-auto max-w-3xl overflow-hidden ${
            guestMode
              ? "rounded-3xl border border-white/10 bg-slate-900/45 backdrop-blur-xl shadow-2xl ring-1 ring-white/[0.06]"
              : "rounded-3xl border border-slate-700/60 bg-slate-900/50 backdrop-blur-xl shadow-2xl ring-1 ring-white/[0.04]"
          }`}
        >
          <div className="pointer-events-none absolute -top-28 right-0 h-72 w-72 rounded-full bg-gradient-to-br from-cyan-500/25 via-brand-500/15 to-transparent blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-16 h-64 w-64 rounded-full bg-gradient-to-tr from-violet-600/20 to-transparent blur-3xl" />

          <motion.div
            variants={REPORT_STAGGER}
            initial="hidden"
            animate="visible"
            className="relative px-5 py-8 sm:px-8 sm:py-10 md:px-10 md:py-12"
          >
            <motion.div variants={REPORT_ITEM} className="flex flex-wrap items-start justify-between gap-4 mb-8 md:mb-10">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/30 via-brand-500/35 to-violet-600/25 shadow-lg ring-1 ring-white/15">
                  <Sparkles className="h-7 w-7 text-cyan-200" strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-white">
                    Interview report
                  </h2>
                  <p className="mt-1 text-sm text-slate-400 max-w-md leading-relaxed">
                    Scores are indicative and for practice only — use them to sharpen your next session.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Pressure-mode violation deduction */}
            <AnimatePresence>
              {report.pressureViolations?.totalDeduction > 0 && (
                <motion.div
                  variants={REPORT_ITEM}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mb-8 rounded-2xl border border-red-500/35 bg-gradient-to-br from-red-950/50 to-red-950/20 p-5 backdrop-blur-sm shadow-lg shadow-red-950/20"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
                    <p className="text-sm font-semibold text-red-200">
                      Pressure mode · −{report.pressureViolations.totalDeduction} points applied
                    </p>
                  </div>
                  <ul className="space-y-2 text-sm text-red-200/85 mb-4">
                    {report.pressureViolations.reasons.map((r, i) => (
                      <li key={i} className="flex gap-2 pl-0.5">
                        <span className="text-red-400/90 mt-1.5 h-1 w-1 shrink-0 rounded-full bg-red-400" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-6 text-xs text-slate-400 border-t border-red-500/20 pt-4">
                    <span>
                      Head warnings:{" "}
                      <strong className="text-slate-200 tabular-nums">{report.pressureViolations.headWarnings}</strong>
                    </span>
                    <span>
                      Tab switches:{" "}
                      <strong className="text-slate-200 tabular-nums">{report.pressureViolations.tabSwitches}</strong>
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {report.pressureViolations && report.pressureViolations.totalDeduction === 0 && (
              <motion.div
                variants={REPORT_ITEM}
                className="mb-8 rounded-2xl border border-emerald-500/35 bg-gradient-to-br from-emerald-950/45 to-emerald-950/15 p-5 backdrop-blur-sm"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                  <p className="text-sm font-semibold text-emerald-200">Pressure mode · No score deductions</p>
                </div>
                <p className="mt-2 text-xs text-emerald-200/70">Strong focus and discipline — keep it up.</p>
                <div className="mt-4 flex flex-wrap gap-6 text-xs text-slate-400 border-t border-emerald-500/15 pt-4">
                  <span>
                    Head warnings:{" "}
                    <strong className="text-slate-200 tabular-nums">{report.pressureViolations.headWarnings}</strong>
                  </span>
                  <span>
                    Tab switches:{" "}
                    <strong className="text-slate-200 tabular-nums">{report.pressureViolations.tabSwitches}</strong>
                  </span>
                </div>
              </motion.div>
            )}

            {/* Hero score */}
            <motion.div variants={REPORT_ITEM} className="mb-8 md:mb-10">
              <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-slate-800/80 via-slate-900/90 to-slate-950 p-8 md:p-10 shadow-inner">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_0%,rgba(56,189,248,0.12),transparent_55%)]" />
                <div className="flex flex-col items-center md:flex-row md:items-center md:justify-center md:gap-12">
                  <div className="relative mb-6 md:mb-0">
                    <svg className="h-40 w-40 -rotate-90 transform md:h-44 md:w-44" viewBox="0 0 120 120" aria-hidden>
                      <circle
                        cx="60"
                        cy="60"
                        r="52"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="8"
                        className="text-slate-800/90"
                      />
                      <circle
                        cx="60"
                        cy="60"
                        r="52"
                        fill="none"
                        stroke="url(#scoreGradInterview)"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${((animatedMainScore / 100) * 326.73).toFixed(2)} 326.73`}
                        className="transition-[stroke-dasharray] duration-300 ease-out"
                      />
                      <defs>
                        <linearGradient id="scoreGradInterview" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#22d3ee" />
                          <stop offset="55%" stopColor="#6366f1" />
                          <stop offset="100%" stopColor="#a78bfa" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Score</span>
                      <span className="font-display text-4xl font-bold tabular-nums tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-white to-violet-200 md:text-5xl">
                        {animatedMainScore}
                      </span>
                      <span className="text-sm font-medium text-slate-500">/ 100</span>
                    </div>
                  </div>
                  <div className="text-center md:text-left max-w-xs">
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Overall</p>
                    <p className="mt-1 text-lg font-semibold text-white">Interview performance</p>
                    <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                      Combined signal across communication, depth, and confidence — weighted toward how you showed up in this session.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Sub-scores */}
            <motion.div variants={REPORT_ITEM} className="grid gap-4 sm:grid-cols-3 mb-10">
              {[
                {
                  label: "Communication",
                  value: report.communicationScore,
                  Icon: MessageCircle,
                  tint: "from-sky-500/25 to-cyan-500/10 border-sky-500/25",
                  bar: "bg-gradient-to-r from-sky-400 to-cyan-400",
                },
                {
                  label: "Technical depth",
                  value: report.technicalDepth,
                  Icon: Cpu,
                  tint: "from-violet-500/25 to-indigo-500/10 border-violet-500/25",
                  bar: "bg-gradient-to-r from-violet-400 to-indigo-400",
                },
                {
                  label: "Confidence",
                  value: report.confidenceScore,
                  Icon: Shield,
                  tint: "from-emerald-500/25 to-teal-500/10 border-emerald-500/25",
                  bar: "bg-gradient-to-r from-emerald-400 to-teal-400",
                },
              ].map((x, idx) => {
                  const MetricIcon = x.Icon;
                  return (
                <motion.div
                  key={x.label}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + idx * 0.06, duration: 0.4 }}
                  whileHover={{ y: -3, transition: { duration: 0.2 } }}
                  className={`rounded-2xl border bg-gradient-to-br ${x.tint} p-5 backdrop-blur-sm`}
                >
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <MetricIcon className="h-4 w-4 text-slate-400" strokeWidth={2} />
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{x.label}</span>
                    </div>
                    <span className="font-display text-2xl font-bold tabular-nums text-white">{x.value}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-900/80">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, Math.max(0, Number(x.value) || 0))}%` }}
                      transition={{ duration: 0.85, delay: 0.25 + idx * 0.08, ease: [0.22, 1, 0.36, 1] }}
                      className={`h-full rounded-full ${x.bar}`}
                    />
                  </div>
                </motion.div>
              );
              })}
            </motion.div>

            {/* Suggestions */}
            <motion.div variants={REPORT_ITEM}>
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="h-5 w-5 text-amber-400/90" strokeWidth={2} />
                <h3 className="font-display text-lg font-semibold text-white tracking-tight">Suggestions</h3>
              </div>
              <ul className="space-y-3">
                {(report.suggestions || []).map((s, i) => {
                  const isPenalty = s.startsWith("[Pressure Mode Penalty]");
                  const text = isPenalty ? s.replace("[Pressure Mode Penalty] ", "") : s;
                  return (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.08 + i * 0.04 }}
                      className={`flex gap-3 rounded-xl border px-4 py-3.5 text-sm leading-relaxed ${
                        isPenalty
                          ? "border-red-500/25 bg-red-950/30 text-red-100"
                          : "border-white/[0.06] bg-slate-800/40 text-slate-200"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                          isPenalty ? "bg-red-500/25 text-red-300" : "bg-brand-500/20 text-brand-300"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span>{text}</span>
                    </motion.li>
                  );
                })}
              </ul>
            </motion.div>

            {/* Rating */}
            <motion.div
              variants={REPORT_ITEM}
              className="mt-10 rounded-2xl border border-white/[0.07] bg-slate-800/35 p-6 backdrop-blur-md"
            >
              <div className="flex items-center gap-2 mb-3">
                <Star className="h-5 w-5 text-amber-400/80" strokeWidth={2} />
                <p className="text-sm font-semibold text-white">Rate this interview experience</p>
              </div>
              <p className="text-xs text-slate-500 mb-4">Your feedback helps us improve the simulator.</p>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => !ratingSubmitted && setRating(v)}
                    className={`rounded-lg p-1.5 transition-transform text-2xl ${
                      v <= rating ? "text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.35)]" : "text-slate-600"
                    } ${ratingSubmitted ? "cursor-default" : "hover:text-amber-300 hover:scale-110"}`}
                    aria-label={`Rate ${v} star${v > 1 ? "s" : ""}`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <motion.button
                  type="button"
                  whileHover={{ scale: ratingLoading || ratingSubmitted || rating < 1 ? 1 : 1.02 }}
                  whileTap={{ scale: ratingLoading || ratingSubmitted || rating < 1 ? 1 : 0.98 }}
                  onClick={submitInterviewRating}
                  disabled={ratingLoading || ratingSubmitted || rating < 1}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 disabled:opacity-45 disabled:shadow-none"
                >
                  {ratingLoading ? "Submitting…" : ratingSubmitted ? "Submitted" : "Submit rating"}
                  {!ratingSubmitted && !ratingLoading && <ChevronRight className="h-4 w-4 opacity-80" />}
                </motion.button>
                {ratingMessage && <p className="text-xs text-slate-400">{ratingMessage}</p>}
              </div>
            </motion.div>

            <motion.div variants={REPORT_ITEM} className="mt-10 flex justify-center sm:justify-start">
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
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
                  setConversationalSession(null);
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/[0.1]"
              >
                New interview
                <ChevronRight className="h-4 w-4 opacity-70" />
              </motion.button>
            </motion.div>
          </motion.div>
        </motion.div>
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

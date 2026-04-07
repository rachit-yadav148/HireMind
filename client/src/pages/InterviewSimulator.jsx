import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";

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

  const { supported, listening, transcript, error: speechErr, start, stop, reset } =
    useSpeechRecognition();

  const [typedAnswer, setTypedAnswer] = useState("");

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
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [sessionId, report, timerActive, timeLeft]);

  useEffect(() => {
    if (!sessionId || report || !timerActive) return;
    if (timeLeft > 0 || timerEnding || loading) return;
    setTimerEnding(true);
    endInterviewEarly(true);
  }, [timeLeft, sessionId, report, timerActive, timerEnding, loading]);

  async function handleStart(e) {
    e.preventDefault();
    setApiError("");
    primeSpeechSynthesis();
    if (isMobileBrowser()) {
      void enableAudioAndMic();
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
      setSessionId(data.sessionId);
      setCurrentQuestion(data.question);
      setStage(data.stage || "technical");
      setTimeLeft(durationMinutes * 60);
      setTimerActive(true);
      setTimerEnding(false);
      setRating(0);
      setRatingSubmitted(false);
      setRatingMessage("");
      appendMsg("interviewer", data.question);
      speakText(data.question);
      reset();
    } catch (err) {
      setApiError(err.response?.data?.message || "Could not start interview");
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
        setReport(data.report);
        setTimerActive(false);
        setCurrentQuestion("");
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
      setApiError(err.response?.data?.message || "Failed to submit answer");
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
        setReport(data.report);
        setTimerActive(false);
        setCurrentQuestion("");
        speakText(
          isTimerTriggered
            ? "Time is up. Interview ended. Here is your summary and score."
            : "Interview ended. Here is your summary and score."
        );
      }
    } catch (err) {
      setApiError(err.response?.data?.message || "Failed to end interview");
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
      setRatingMessage(err.response?.data?.message || "Failed to submit rating");
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
      setAudioStatus("Audio and microphone are enabled. You can start speaking now.");
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
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-white">AI Interview Simulator</h1>
        <p className="text-slate-400 mt-1 max-w-2xl">
          The interviewer speaks questions aloud. Answer via microphone (Web Speech API). After each
          answer you get feedback, then the next question — technical, behavioral, then HR.
        </p>
      </div>

      {!sessionId && (
        <form
          onSubmit={handleStart}
          className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 mb-8 max-w-xl grid gap-4"
        >
          {apiError && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm px-3 py-2">
              {apiError}
            </div>
          )}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Target company</label>
            <input
              required
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white"
              placeholder="e.g. Google"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Target role</label>
            <input
              required
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white"
              placeholder="e.g. SWE Intern"
            />
          </div>

          <div>
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
          <div>
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
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white"
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
            className="font-semibold bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-white py-2.5 rounded-xl"
          >
            {loading ? "Starting…" : "Start voice interview"}
          </button>
        </form>
      )}

      {sessionId && !report && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/40 min-h-[420px] flex flex-col">
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

          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4 h-fit">
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
                Audio: {audioStatus}
              </p>
            )}

            <div className="rounded-lg bg-slate-950 border border-slate-700 min-h-[100px] p-3 text-sm text-slate-300">
              {transcript || (listening ? "Listening…" : "Press start and speak your answer.")}
            </div>
            <label className="block text-xs text-slate-500 mt-3">Or type your answer</label>
            <textarea
              value={typedAnswer}
              onChange={(e) => setTypedAnswer(e.target.value)}
              rows={3}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-600"
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
                className="font-medium bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm"
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
    </div>
  );
}

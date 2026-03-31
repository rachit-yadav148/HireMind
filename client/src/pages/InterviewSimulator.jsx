import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";

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

  const { supported, listening, transcript, error: speechErr, start, stop, reset } =
    useSpeechRecognition();

  const [typedAnswer, setTypedAnswer] = useState("");

  const appendMsg = useCallback((role, content, extra = {}) => {
    setMessages((m) => [...m, { role, content, ...extra, t: Date.now() }]);
  }, []);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  async function handleStart(e) {
    e.preventDefault();
    setApiError("");
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
      appendMsg("interviewer", data.question);
      speak(data.question);
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
        setCurrentQuestion("");
        speak("Interview complete. Here is your report summary.");
        return;
      }

      if (data.nextQuestion) {
        setCurrentQuestion(data.nextQuestion);
        setStage(data.stage || stage);
        appendMsg("interviewer", data.nextQuestion);
        speak(data.nextQuestion);
      }
      reset();
      setTypedAnswer("");
    } catch (err) {
      setApiError(err.response?.data?.message || "Failed to submit answer");
    } finally {
      setLoading(false);
    }
  }

  async function endInterviewEarly() {
    if (!sessionId) return;
    setApiError("");
    setLoading(true);
    stop();
    try {
      const { data } = await api.post("/interviews/end", { sessionId });
      if (data?.report) {
        setReport(data.report);
        setCurrentQuestion("");
        speak("Interview ended. Here is your summary and score.");
      }
    } catch (err) {
      setApiError(err.response?.data?.message || "Failed to end interview");
    } finally {
      setLoading(false);
    }
  }

  function replayQuestion() {
    if (currentQuestion) speak(currentQuestion);
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
            <label className="block text-xs text-slate-400 mb-1">Resume (optional)</label>
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-slate-400"
            />
            {resumeFile && (
              <p className="text-xs text-slate-500 mt-2">Selected: {resumeFile.name}</p>
            )}
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
                Speech recognition is not supported in this browser. Use Chrome or Edge for voice
                input, or paste text below if we add it later.
              </p>
            )}
            {speechErr && <p className="text-xs text-red-400">Mic: {speechErr}</p>}

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
                onClick={endInterviewEarly}
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
          <button
            type="button"
            onClick={() => {
              setSessionId(null);
              setReport(null);
              setMessages([]);
              setCurrentQuestion("");
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

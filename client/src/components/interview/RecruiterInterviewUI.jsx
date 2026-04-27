import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Clock, PhoneOff, Volume2, VolumeX, MessageSquare, ChevronDown } from "lucide-react";
import { api, getApiErrorMessage } from "../../services/api";
import { useAlwaysOnMic } from "../../hooks/useAlwaysOnMic";
import AudioVisualizer from "./AudioVisualizer";

function formatDuration(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

const INACTIVITY_REMIND_MS = 30000;
const INACTIVITY_END_MS = 120000;

export default function RecruiterInterviewUI({
  sessionId,
  initialAiMessage,
  candidateName,
  durationMinutes,
  mode,
  onEnd,
  onReport,
}) {
  const [micReady, setMicReady] = useState(false);
  const [micPermLoading, setMicPermLoading] = useState(false);
  const [micPermError, setMicPermError] = useState("");
  const [messages, setMessages] = useState([]);
  const [currentAiText, setCurrentAiText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [timeLeft, setTimeLeft] = useState(durationMinutes * 60);
  const [micEnabled, setMicEnabled] = useState(true);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [showTranscript, setShowTranscript] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ended, setEnded] = useState(false);
  /** SR must not start until the first TTS greeting finishes — otherwise the mic picks up the AI voice */
  const [openingDone, setOpeningDone] = useState(false);
  const greetingSpokenRef = useRef(false);

  const inactivityTimerRef = useRef(null);
  const stallCountRef = useRef(0);
  const messagesEndRef = useRef(null);
  const ttsEnabledRef = useRef(ttsEnabled);
  const endedRef = useRef(false);
  const micRef = useRef(null);
  const indianVoiceRef = useRef(null);
  const ttsSafetyRef = useRef(null);

  useEffect(() => { ttsEnabledRef.current = ttsEnabled; }, [ttsEnabled]);
  useEffect(() => { endedRef.current = ended; }, [ended]);

  // Pick the best available voice — prefer natural-sounding Indian English voices
  useEffect(() => {
    function pickVoice() {
      const voices = window.speechSynthesis?.getVoices() || [];
      if (!voices.length) return;
      const priorities = [
        (v) => v.lang === "en-IN" && /google/i.test(v.name),
        (v) => v.lang === "en-IN" && /rishi/i.test(v.name),
        (v) => v.lang === "en-IN",
        (v) => v.lang.startsWith("en") && /google/i.test(v.name),
        (v) => v.lang.startsWith("en") && /natural|premium|enhanced/i.test(v.name),
        (v) => v.lang.startsWith("en"),
        (v) => !!v,
      ];
      for (const test of priorities) {
        const match = voices.find(test);
        if (match) { indianVoiceRef.current = match; return; }
      }
    }
    pickVoice();
    window.speechSynthesis?.addEventListener?.("voiceschanged", pickVoice);
    return () => window.speechSynthesis?.removeEventListener?.("voiceschanged", pickVoice);
  }, []);

  // ─── TTS ───
  const speakText = useCallback((text, onDone) => {
    // #region agent log
    fetch('/api/debug-log-244377',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'244377',location:'RecruiterInterviewUI:speakText-entry',message:'SPEAK ENTRY',data:{textLen:text?.length,hasText:!!text,hasSynth:!!window.speechSynthesis,ttsEnabled:ttsEnabledRef.current,willEarlyReturn:(!text||!window.speechSynthesis||!ttsEnabledRef.current)},timestamp:Date.now(),hypothesisId:'H-A2'})}).catch(()=>{});
    // #endregion
    // Cancel any previous speech and its safety timer
    if (ttsSafetyRef.current) { clearTimeout(ttsSafetyRef.current); ttsSafetyRef.current = null; }
    window.speechSynthesis?.cancel();

    // Pause mic so TTS audio isn't picked up as user speech
    micRef.current?.pause();

    if (!text || !window.speechSynthesis || !ttsEnabledRef.current) {
      setIsSpeaking(false);
      micRef.current?.resume();
      onDone?.();
      return;
    }

    // Re-pick voice in case voiceschanged fired since last pick
    if (!indianVoiceRef.current) {
      const voices = window.speechSynthesis.getVoices() || [];
      const fb = voices.find((v) => v.lang.startsWith("en")) || voices[0];
      if (fb) indianVoiceRef.current = fb;
    }

    const u = new SpeechSynthesisUtterance(text);
    if (indianVoiceRef.current) {
      u.voice = indianVoiceRef.current;
      u.lang = indianVoiceRef.current.lang;
    }
    u.rate = 1.08;
    u.pitch = 1.0;
    u.volume = 1;

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (ttsSafetyRef.current) { clearTimeout(ttsSafetyRef.current); ttsSafetyRef.current = null; }
      setIsSpeaking(false);
      micRef.current?.resume();
      onDone?.();
    };

    u.onend = finish;
    u.onerror = finish;

    // #region agent log
    fetch('/api/debug-log-244377',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'244377',location:'RecruiterInterviewUI:speakText',message:'PRE-SPEAK',data:{textLen:text.length,textStart:text.slice(0,80),voiceName:indianVoiceRef.current?.name,voiceLang:indianVoiceRef.current?.lang,synthSpeaking:window.speechSynthesis.speaking,synthPending:window.speechSynthesis.pending},timestamp:Date.now(),hypothesisId:'H-A'})}).catch(()=>{});
    // #endregion
    setIsSpeaking(true);
    window.speechSynthesis.speak(u);

    // If speechSynthesis silently rejects the utterance (autoplay not yet unlocked
    // or no voice available), nothing starts speaking — detect and recover quickly.
    const silentCheck = setTimeout(() => {
      // #region agent log
      fetch('/api/debug-log-244377',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'244377',location:'RecruiterInterviewUI:silentCheck',message:'350ms CHECK',data:{speaking:window.speechSynthesis.speaking,pending:window.speechSynthesis.pending,willFinish:(!window.speechSynthesis.speaking && !window.speechSynthesis.pending)},timestamp:Date.now(),hypothesisId:'H-A'})}).catch(()=>{});
      // #endregion
      if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
        finish();
      }
    }, 350);

    // Hard safety net: force finish after estimated speaking time
    const estimatedMs = Math.max(4000, text.length * 70);
    ttsSafetyRef.current = setTimeout(() => {
      clearTimeout(silentCheck);
      window.speechSynthesis.cancel();
      finish();
    }, estimatedMs);
  }, []);

  // ─── Permission gate ───
  async function handleGrantMic() {
    setMicPermError("");
    setMicPermLoading(true);

    // Unlock TTS SYNCHRONOUSLY before any `await`.
    // Anything after an await runs in a new microtask outside the user-gesture
    // context, so the browser would silently reject speechSynthesis.speak().
    if (window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
        const primer = new SpeechSynthesisUtterance(" ");
        primer.volume = 0.05; // Slightly audible so the audio output device wakes up
        window.speechSynthesis.speak(primer);
      } catch { /* ignore */ }
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setMicPermError("Microphone API not available. Use Chrome/Edge on HTTPS or localhost.");
      setMicPermLoading(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch (err) {
      const code = String(err?.name || err?.message || "").toLowerCase();
      if (code.includes("notallowed") || code.includes("permission") || code.includes("denied")) {
        setMicPermError("Microphone permission denied. Click the lock icon in your address bar → allow microphone → reload.");
      } else {
        setMicPermError(`Could not access microphone: ${err?.message || "unknown error"}.`);
      }
      setMicPermLoading(false);
      return;
    }

    setMicPermLoading(false);
    setMicReady(true);
  }

  // ─── Greeting ───
  useEffect(() => {
    if (!micReady) return;

    if (!initialAiMessage?.trim()) {
      setOpeningDone(true);
      return;
    }

    if (greetingSpokenRef.current) return;
    greetingSpokenRef.current = true;

    setCurrentAiText(initialAiMessage);
    setMessages([{ role: "interviewer", text: initialAiMessage, t: Date.now() }]);

    const timer = setTimeout(() => {
      speakText(initialAiMessage, () => {
        setOpeningDone(true);
        startInactivityTimer();
      });
    }, 150);

    return () => {
      clearTimeout(timer);
      greetingSpokenRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAiMessage, micReady, speakText]);

  // ─── Timer ───
  useEffect(() => {
    if (!micReady || ended || timeLeft <= 0) return;
    const id = setInterval(() => setTimeLeft((p) => Math.max(0, p - 1)), 1000);
    return () => clearInterval(id);
  }, [micReady, ended, timeLeft]);

  useEffect(() => {
    if (timeLeft <= 0 && !ended && micReady) handleEndInterview(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, ended, micReady]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ─── Inactivity detection ───
  const clearInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  const startInactivityTimer = useCallback(() => {
    clearInactivityTimer();
    inactivityTimerRef.current = setTimeout(() => {
      if (endedRef.current) return;
      const name = candidateName || "there";
      addAiReminder(`Hey ${name}, do you want me to repeat the question?`);
      inactivityTimerRef.current = setTimeout(() => {
        if (endedRef.current) return;
        handleEndInterview(true);
      }, INACTIVITY_END_MS - INACTIVITY_REMIND_MS);
    }, INACTIVITY_REMIND_MS);
  }, [candidateName, clearInactivityTimer]);

  useEffect(() => { return () => clearInactivityTimer(); }, [clearInactivityTimer]);

  function addAiReminder(text) {
    setMessages((m) => [...m, { role: "interviewer", text, t: Date.now(), isReminder: true }]);
    setCurrentAiText(text);
    speakText(text, () => startInactivityTimer());
  }

  const handleSpeechActivity = useCallback(() => {
    clearInactivityTimer();
  }, [clearInactivityTimer]);

  const handleSilenceEnd = useCallback(async (userText) => {
    if (!userText.trim() || loading || endedRef.current) return;

    const wordCount = userText.trim().split(/\s+/).length;
    if (wordCount < 5) {
      stallCountRef.current++;
      if (stallCountRef.current >= 3) {
        const name = candidateName || "there";
        addAiReminder(`We're running short on time, you have to be quick ${name}.`);
        stallCountRef.current = 0;
        return;
      }
    } else {
      stallCountRef.current = 0;
    }

    setMessages((m) => [...m, { role: "candidate", text: userText, t: Date.now() }]);
    setLoading(true);
    setError("");
    micRef.current?.pause();

    try {
      const { data } = await api.post("/interviews/converse", {
        sessionId,
        userMessage: userText,
        candidateName,
      });

      if (data.interviewEnded) {
        setMessages((m) => [
          ...m,
          { role: "interviewer", text: data.aiMessage, t: Date.now(), conductEnd: true },
        ]);
        setCurrentAiText(data.aiMessage);
        speakText(data.aiMessage, () => {
          void handleEndInterview(true);
        });
        return;
      }

      setMessages((m) => [...m, { role: "interviewer", text: data.aiMessage, t: Date.now() }]);
      setCurrentAiText(data.aiMessage);
      speakText(data.aiMessage, () => startInactivityTimer());
    } catch (err) {
      const msg = getApiErrorMessage(err, "Failed to get response");
      setError(msg);
      micRef.current?.resume();
      startInactivityTimer();
      if (err?.response?.data?.code === "FREE_LIMIT_REACHED") handleEndInterview(true);
    } finally {
      setLoading(false);
    }
  }, [sessionId, candidateName, loading, speakText, startInactivityTimer]);

  // Mic starts only after opening greeting TTS completes — avoids SR capturing AI audio
  const { listening, transcript, error: micError, stream, pause: micPause, resume: micResume } =
    useAlwaysOnMic({
      enabled: micReady && micEnabled && !ended && openingDone,
      onSilenceEnd: handleSilenceEnd,
      onSpeechActivity: handleSpeechActivity,
    });

  useEffect(() => {
    micRef.current = { pause: micPause, resume: micResume };
  }, [micPause, micResume]);

  async function handleEndInterview(timerTriggered = false) {
    if (ended) return;
    setEnded(true);
    setMicEnabled(false);
    window.speechSynthesis?.cancel();
    clearInactivityTimer();
    try {
      const { data } = await api.post("/interviews/end", { sessionId });
      if (data?.report) onReport?.(data.report);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to end interview"));
    }
    onEnd?.();
  }

  const toggleTts = () => {
    if (ttsEnabled) window.speechSynthesis?.cancel();
    setTtsEnabled(!ttsEnabled);
  };

  // ─── Permission gate UI ───
  if (!micReady) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-8 max-w-md mx-auto text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-500/20 mb-5">
          <Mic className="w-8 h-8 text-brand-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">
          {mode === "pressure" ? "Pressure Interview" : "Recruiter Interview"}
        </h2>
        <p className="text-slate-400 text-sm mb-1">
          Your microphone will stay <span className="text-white font-medium">always on</span> during this interview.
        </p>
        <p className="text-slate-500 text-xs mb-6">
          The AI interviewer will speak questions aloud and listen to your answers in real time.
        </p>
        {micPermError && <p className="text-sm text-red-400 mb-4">{micPermError}</p>}
        {micPermLoading && (
          <p className="text-sm text-amber-300 mb-4 animate-pulse">
            Waiting for microphone permission…
          </p>
        )}
        <button
          onClick={handleGrantMic}
          disabled={micPermLoading}
          className="w-full font-semibold bg-brand-500 hover:bg-brand-400 disabled:opacity-60 text-white py-3 rounded-xl transition-colors"
        >
          {micPermLoading ? "Requesting mic access..." : "Allow Microphone & Start Interview"}
        </button>
      </div>
    );
  }

  // ─── Interview UI ───
  return (
    <div className="relative flex flex-col h-[calc(100vh-120px)] max-h-[800px] rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-900/80 z-30">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${ended ? "bg-slate-500" : "bg-emerald-400 animate-pulse"}`} />
          <span className="text-sm font-medium text-slate-300">
            {mode === "pressure" ? "Pressure Interview" : "Recruiter Interview"}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={toggleTts} className="text-slate-400 hover:text-white transition-colors" title={ttsEnabled ? "Mute interviewer" : "Unmute interviewer"}>
            {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <div className="flex items-center gap-1.5 text-amber-400">
            <Clock className="w-4 h-4" />
            <span className="text-sm font-mono font-semibold tabular-nums">{formatDuration(timeLeft)}</span>
          </div>
          <button
            onClick={() => handleEndInterview(false)}
            disabled={ended}
            className="flex items-center gap-1.5 bg-red-600/80 hover:bg-red-500 disabled:opacity-40 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            End
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 relative">
        <div className="text-center mb-6 max-w-lg">
          <p className="text-sm text-brand-400 mb-2 flex items-center justify-center gap-2">
            {isSpeaking && (
              <span className="flex gap-0.5">
                <span className="w-1 h-3 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1 h-3 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1 h-3 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
            )}
            {isSpeaking ? "Interviewer is speaking..." : "The interviewer asks..."}
          </p>
          <p className="text-xl font-semibold text-white leading-relaxed">{currentAiText}</p>
          {currentAiText && !isSpeaking && !loading && (
            <button
              onClick={() => speakText(currentAiText)}
              className="mt-3 text-xs text-slate-400 hover:text-brand-300 underline underline-offset-2 transition-colors"
            >
              🔊 Replay question
            </button>
          )}
        </div>

        <AudioVisualizer stream={stream} isListening={listening && !isSpeaking && !loading} size={160} />

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={() => setMicEnabled(!micEnabled)}
            disabled={ended}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              micEnabled && listening
                ? "bg-emerald-600/20 border border-emerald-500/40 text-emerald-300"
                : "bg-slate-800 border border-slate-700 text-slate-400 hover:text-white"
            }`}
          >
            {micEnabled && listening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            {isSpeaking ? "AI speaking..." : openingDone && micEnabled && listening ? "Listening..." : openingDone ? "Mic off" : "Getting ready..."}
          </button>
        </div>

        {transcript && !loading && (
          <div className="mt-4 max-w-md text-center">
            <p className="text-sm text-slate-400 italic">"{transcript}"</p>
          </div>
        )}

        {loading && <p className="mt-4 text-sm text-brand-400 animate-pulse">Processing your answer...</p>}
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        {micError && <p className="mt-2 text-xs text-amber-400">{micError}</p>}
      </div>

      {/* Transcript drawer */}
      <div className="border-t border-slate-800">
        <button
          onClick={() => setShowTranscript(!showTranscript)}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
          Transcript
          <ChevronDown className={`w-4 h-4 transition-transform ${showTranscript ? "rotate-180" : ""}`} />
        </button>
        {showTranscript && (
          <div className="max-h-48 overflow-y-auto px-5 pb-4 space-y-3">
            {messages.map((m, idx) => (
              <div
                key={`${m.t}-${idx}`}
                className={`text-sm ${
                  m.role === "candidate" ? "text-brand-300 ml-6"
                    : m.isReminder ? "text-amber-300"
                    : "text-slate-300 mr-6"
                }`}
              >
                <span className="text-xs text-slate-500 block mb-0.5">
                  {m.role === "candidate" ? "You" : "Interviewer"}
                </span>
                {m.text}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}

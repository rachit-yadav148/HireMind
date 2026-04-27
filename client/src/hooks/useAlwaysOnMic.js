import { useCallback, useEffect, useRef, useState } from "react";

// Longer silence timeout to let Indian-English speakers finish sentences
// (accounts for natural pauses, code-switching, and thinking gaps)
const SILENCE_TIMEOUT_MS = 4500;

// Restart delay to avoid instant restarts that drop audio
const RESTART_DELAY_MS = 80;

function isIOSLikeDevice() {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * Always-on mic hook with silence detection.
 * Optimised for Indian-English speakers — uses en-IN locale, higher
 * maxAlternatives, and longer silence window to avoid cutting off mid-sentence.
 */
export function useAlwaysOnMic({ enabled = false, onSilenceEnd, onSpeechActivity, lang = "en-IN" } = {}) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const [stream, setStream] = useState(null);
  const recRef = useRef(null);
  const finalRef = useRef("");
  const interimRef = useRef("");
  const silenceTimerRef = useRef(null);
  const onSilenceEndRef = useRef(onSilenceEnd);
  const onSpeechActivityRef = useRef(onSpeechActivity);
  const shouldListenRef = useRef(false);
  const pausedRef = useRef(false);
  const restartTimerRef = useRef(null);

  useEffect(() => {
    onSilenceEndRef.current = onSilenceEnd;
  }, [onSilenceEnd]);

  useEffect(() => {
    onSpeechActivityRef.current = onSpeechActivity;
  }, [onSpeechActivity]);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const startSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      // Use final + whatever interim was last seen (catches partial phrases
      // the engine hasn't finalised yet)
      const text = (finalRef.current + " " + interimRef.current).trim();
      if (text && onSilenceEndRef.current) {
        onSilenceEndRef.current(text);
        finalRef.current = "";
        interimRef.current = "";
        setTranscript("");
      }
    }, SILENCE_TIMEOUT_MS);
  }, [clearSilenceTimer]);

  const resetTranscript = useCallback(() => {
    finalRef.current = "";
    interimRef.current = "";
    setTranscript("");
    clearSilenceTimer();
  }, [clearSilenceTimer]);

  const pause = useCallback(() => {
    pausedRef.current = true;
    clearSilenceTimer();
    if (restartTimerRef.current) { clearTimeout(restartTimerRef.current); restartTimerRef.current = null; }
    const rec = recRef.current;
    if (rec) {
      try { rec.abort(); } catch { /* ignore */ }
    }
    setListening(false);
  }, [clearSilenceTimer]);

  const resume = useCallback(() => {
    pausedRef.current = false;
    finalRef.current = "";
    interimRef.current = "";
    setTranscript("");
    const rec = recRef.current;
    if (rec && shouldListenRef.current) {
      // Slight delay to let the engine fully stop before restarting
      restartTimerRef.current = setTimeout(() => {
        try {
          rec.start();
          setListening(true);
        } catch { /* ignore */ }
      }, RESTART_DELAY_MS);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      shouldListenRef.current = false;
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setError("Speech recognition not supported in this browser. Please use Google Chrome.");
      return;
    }

    let mediaStream = null;

    async function init() {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000,
            channelCount: 1,
          },
        });
        setStream(mediaStream);
      } catch (err) {
        const code = String(err?.name || "").toLowerCase();
        if (code.includes("notallowed") || code.includes("denied")) {
          setError("Microphone permission denied. Allow mic in browser settings and reload.");
        } else {
          setError("Could not access microphone.");
        }
        return;
      }

      const rec = new SR();
      rec.continuous = !isIOSLikeDevice();
      rec.interimResults = true;
      rec.lang = lang;
      rec.maxAlternatives = 3;

      rec.onresult = (event) => {
        clearSilenceTimer();
        // Notify parent that the user is actively speaking
        onSpeechActivityRef.current?.();
        let currentInterim = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          // Pick the alternative with highest confidence
          let bestText = result[0].transcript;
          let bestConf = result[0].confidence || 0;
          for (let a = 1; a < result.length; a++) {
            if ((result[a].confidence || 0) > bestConf) {
              bestConf = result[a].confidence;
              bestText = result[a].transcript;
            }
          }

          if (result.isFinal) {
            finalRef.current += bestText;
            interimRef.current = "";
          } else {
            currentInterim += bestText;
          }
        }

        interimRef.current = currentInterim;
        setTranscript((finalRef.current + " " + interimRef.current).trim());
        startSilenceTimer();
      };

      rec.onerror = (e) => {
        if (e.error === "no-speech" || e.error === "aborted") return;
        // "network" errors happen transiently on Chrome — auto-restart
        if (e.error === "network") {
          if (shouldListenRef.current && !pausedRef.current) {
            restartTimerRef.current = setTimeout(() => {
              try { rec.start(); setListening(true); } catch { setListening(false); }
            }, RESTART_DELAY_MS * 2);
          }
          return;
        }
        setError(String(e.error || "speech_error"));
        setListening(false);
      };

      rec.onend = () => {
        if (!shouldListenRef.current || pausedRef.current) {
          setListening(false);
          return;
        }
        // Delayed restart prevents "already started" race
        restartTimerRef.current = setTimeout(() => {
          if (!shouldListenRef.current || pausedRef.current) { setListening(false); return; }
          try {
            rec.start();
            setListening(true);
          } catch {
            setListening(false);
          }
        }, RESTART_DELAY_MS);
      };

      recRef.current = rec;
      shouldListenRef.current = true;

      try {
        rec.start();
        setListening(true);
        setError("");
      } catch {
        setError("Could not start microphone.");
      }
    }

    init();

    return () => {
      shouldListenRef.current = false;
      clearSilenceTimer();
      if (restartTimerRef.current) { clearTimeout(restartTimerRef.current); restartTimerRef.current = null; }
      if (recRef.current) {
        try { recRef.current.abort(); } catch { /* ignore */ }
        recRef.current = null;
      }
      if (mediaStream) {
        mediaStream.getTracks().forEach((t) => t.stop());
      }
      setStream(null);
      setListening(false);
    };
  }, [enabled, lang, clearSilenceTimer, startSilenceTimer]);

  return { listening, transcript, error, stream, resetTranscript, pause, resume };
}

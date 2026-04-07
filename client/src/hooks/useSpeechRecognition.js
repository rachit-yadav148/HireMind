import { useCallback, useEffect, useRef, useState } from "react";

function normalizeSpeechError(err) {
  const code = String(err || "").toLowerCase();
  if (code === "service-not-allowed" || code === "not-allowed") {
    return "Microphone access is blocked. Allow mic permission in browser/site settings and reload.";
  }
  if (code === "audio-capture") {
    return "No microphone was found. Connect/enable a microphone and try again.";
  }
  return code || "speech_error";
}

function isIOSLikeDevice() {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * Web Speech API hook. Returns { supported, listening, transcript, error, start, stop, reset }
 */
export function useSpeechRecognition({ lang = "en-US" } = {}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const recRef = useRef(null);
  const finalRef = useRef("");
  const shouldKeepListeningRef = useRef(false);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    setSupported(true);
    const rec = new SR();
    rec.continuous = !isIOSLikeDevice();
    rec.interimResults = true;
    rec.lang = lang;

    rec.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) {
          finalRef.current += r[0].transcript;
        } else {
          interim += r[0].transcript;
        }
      }
      setTranscript(`${finalRef.current}${interim}`.trim());
    };

    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      setError(normalizeSpeechError(e.error));
      setListening(false);
      shouldKeepListeningRef.current = false;
    };

    rec.onend = () => {
      if (!shouldKeepListeningRef.current) {
        setListening(false);
        return;
      }

      try {
        rec.start();
        setListening(true);
      } catch {
        setListening(false);
      }
    };

    recRef.current = rec;
    return () => {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    };
  }, [lang]);

  const start = useCallback(() => {
    setError("");
    finalRef.current = "";
    setTranscript("");
    const rec = recRef.current;
    if (!rec) return;
    shouldKeepListeningRef.current = true;

    const startRecognition = () => {
      try {
        rec.start();
        setListening(true);
      } catch {
        shouldKeepListeningRef.current = false;
        setError("Could not start microphone");
      }
    };

    if (!navigator.mediaDevices?.getUserMedia) {
      startRecognition();
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        stream.getTracks().forEach((t) => t.stop());
        startRecognition();
      })
      .catch((err) => {
        shouldKeepListeningRef.current = false;
        const code = String(err?.name || err?.message || "").toLowerCase();
        if (code.includes("notallowed") || code.includes("permission") || code.includes("denied")) {
          setError("Microphone permission denied. Enable it in browser/site settings and reload.");
          return;
        }
        setError("Could not access microphone");
      });
  }, []);

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    shouldKeepListeningRef.current = false;
    try {
      rec.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  }, []);

  const reset = useCallback(() => {
    finalRef.current = "";
    setTranscript("");
    setError("");
  }, []);

  return { supported, listening, transcript, error, start, stop, reset };
}

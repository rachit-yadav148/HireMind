import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Monitor, AlertTriangle, Eye } from "lucide-react";
import RecruiterInterviewUI from "./RecruiterInterviewUI";

const VISIBILITY_WARN_DELAY_MS = 500;
const CALIBRATION_FRAMES = 15;
const MIN_SKIN_PIXELS = 200;
const HEAD_OFFSET_THRESHOLD = 0.15;
const HEAD_WARN_COOLDOWN_MS = 8000;

export default function PressureInterviewUI({
  sessionId,
  initialAiMessage,
  candidateName,
  durationMinutes,
  onEnd,
  onReport,
}) {
  const [webcamStream, setWebcamStream] = useState(null);
  const [webcamError, setWebcamError] = useState("");
  const [screenStream, setScreenStream] = useState(null);
  const [screenError, setScreenError] = useState("");
  const [warnings, setWarnings] = useState([]);
  const [showRedFlash, setShowRedFlash] = useState(false);
  const [permissionsReady, setPermissionsReady] = useState(false);
  const [headTrackingActive, setHeadTrackingActive] = useState(false);

  // Keep stream in a ref too so the callback ref can access it synchronously
  const webcamStreamRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const headCheckInterval = useRef(null);
  const warningTimerRef = useRef(null);
  const lastHeadWarnRef = useRef(0);

  const addWarning = useCallback((msg) => {
    setWarnings((w) => [...w.slice(-4), { text: msg, t: Date.now() }]);
    setShowRedFlash(true);
    setTimeout(() => setShowRedFlash(false), 2000);
  }, []);

  // Attach stream to a video element — called both from the callback ref and
  // whenever the stream changes after the element is already mounted.
  const attachStream = useCallback((el, stream) => {
    // #region agent log
    fetch('/api/debug-log-244377',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'244377',location:'PressureInterviewUI:attachStream',message:'ATTACH',data:{elExists:!!el,streamExists:!!stream,tracks:stream?.getTracks().map(t=>({kind:t.kind,readyState:t.readyState,enabled:t.enabled}))},timestamp:Date.now(),hypothesisId:'H-D,H-E'})}).catch(()=>{});
    // #endregion
    if (!el || !stream) return;
    el.srcObject = stream;
    const playPromise = el.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        setTimeout(() => el.play().catch(() => {}), 100);
      });
    }
  }, []);

  // Callback ref: fires the moment the <video> element enters the DOM.
  const videoCallbackRef = useCallback((el) => {
    videoRef.current = el;
    if (el && webcamStreamRef.current) {
      attachStream(el, webcamStreamRef.current);
    }
  }, [attachStream]);

  // Also re-attach whenever the stream object itself changes.
  useEffect(() => {
    if (videoRef.current && webcamStream) {
      attachStream(videoRef.current, webcamStream);
    }
  }, [webcamStream, attachStream]);

  async function requestWebcam() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 320 }, height: { ideal: 240 } },
        audio: false,
      });
      webcamStreamRef.current = stream;
      setWebcamStream(stream);
      setWebcamError("");
      return stream;
    } catch {
      setWebcamError("Camera permission denied. Enable camera in browser settings.");
      return null;
    }
  }

  async function requestScreenShare() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      setScreenStream(stream);
      setScreenError("");
      stream.getVideoTracks()[0].onended = () => {
        setScreenStream(null);
        addWarning("Screen sharing stopped! Please share your screen again.");
      };
      return stream;
    } catch {
      setScreenError("Screen sharing denied. You must share your screen for this mode.");
      return null;
    }
  }

  async function setupPermissions() {
    const cam = await requestWebcam();
    const screen = await requestScreenShare();
    if (cam && screen) {
      setPermissionsReady(true);
    }
  }

  // ─── Head tracking ───
  useEffect(() => {
    if (!permissionsReady || !webcamStream) return;

    // Wait a tick for the video element to start playing before capturing frames
    const startDelay = setTimeout(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      let frameCount = 0;
      let calCenterX = 0.5, calCenterY = 0.5;
      let calSamples = 0, calSumX = 0, calSumY = 0;
      let calibrated = false;

      setHeadTrackingActive(true);

      headCheckInterval.current = setInterval(() => {
        if (!video.videoWidth) return;
        const W = 160, H = 120;
        canvas.width = W;
        canvas.height = H;
        ctx.drawImage(video, 0, 0, W, H);

        const { data } = ctx.getImageData(0, 0, W, H);
        let skinWeight = 0, wX = 0, wY = 0, skinPixels = 0;

        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const i = (y * W + x) * 4;
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const isSkin =
              r > 60 && g > 30 && b > 15 &&
              r > g && (r - g) > 10 &&
              Math.abs(r - b) > 10 &&
              !(r > 220 && g > 210 && b > 200);
            if (!isSkin) continue;
            skinWeight += 1;
            wX += x;
            wY += y;
            skinPixels++;
          }
        }

        frameCount++;

        if (skinPixels < MIN_SKIN_PIXELS) {
          if (frameCount > CALIBRATION_FRAMES && calibrated) {
            const now = Date.now();
            if (now - lastHeadWarnRef.current > HEAD_WARN_COOLDOWN_MS) {
              addWarning("No face detected. Please stay visible on camera.");
              lastHeadWarnRef.current = now;
            }
          }
          return;
        }

        const cx = wX / skinWeight / W;
        const cy = wY / skinWeight / H;

        if (!calibrated) {
          calSumX += cx;
          calSumY += cy;
          calSamples++;
          if (calSamples >= CALIBRATION_FRAMES) {
            calCenterX = calSumX / calSamples;
            calCenterY = calSumY / calSamples;
            calibrated = true;
          }
          return;
        }

        const dx = Math.abs(cx - calCenterX);
        const dy = Math.abs(cy - calCenterY);

        if (dx > HEAD_OFFSET_THRESHOLD || dy > HEAD_OFFSET_THRESHOLD * 1.3) {
          const now = Date.now();
          if (now - lastHeadWarnRef.current > HEAD_WARN_COOLDOWN_MS) {
            addWarning("Please keep your head facing the screen. Do not look away.");
            lastHeadWarnRef.current = now;
          }
        }
      }, 1200);
    }, 500);

    return () => {
      clearTimeout(startDelay);
      if (headCheckInterval.current) clearInterval(headCheckInterval.current);
      setHeadTrackingActive(false);
    };
  }, [permissionsReady, webcamStream, addWarning]);

  // Tab visibility detection
  useEffect(() => {
    if (!permissionsReady) return;

    function handleVisibilityChange() {
      if (document.hidden) {
        warningTimerRef.current = setTimeout(() => {
          addWarning("Tab switching detected! Stay on this tab during the interview.");
        }, VISIBILITY_WARN_DELAY_MS);
      } else {
        if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      }
    }

    function handleBlur() {
      addWarning("Window focus lost! Do not switch to other applications.");
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    try { document.documentElement.requestFullscreen?.(); } catch { /* ignore */ }

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      try { document.exitFullscreen?.(); } catch { /* ignore */ }
    };
  }, [permissionsReady, addWarning]);

  // Cleanup streams on unmount only — use refs so the cleanup doesn't re-run
  // (and kill live tracks) every time webcamStream or screenStream changes.
  const webcamStreamCleanupRef = useRef(null);
  const screenStreamCleanupRef = useRef(null);
  useEffect(() => { webcamStreamCleanupRef.current = webcamStream; }, [webcamStream]);
  useEffect(() => { screenStreamCleanupRef.current = screenStream; }, [screenStream]);
  useEffect(() => {
    return () => {
      // #region agent log
      fetch('/api/debug-log-244377',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'244377',location:'PressureInterviewUI:cleanup-unmount',message:'UNMOUNT CLEANUP',data:{webcamTracks:webcamStreamCleanupRef.current?.getTracks().map(t=>t.readyState),screenTracks:screenStreamCleanupRef.current?.getTracks().map(t=>t.readyState)},timestamp:Date.now(),hypothesisId:'H-D-fix'})}).catch(()=>{});
      // #endregion
      webcamStreamCleanupRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamCleanupRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function handleEnd() {
    webcamStream?.getTracks().forEach((t) => t.stop());
    screenStream?.getTracks().forEach((t) => t.stop());
    try { document.exitFullscreen?.(); } catch { /* ignore */ }
    onEnd?.();
  }

  // ─── Permission gate ───
  if (!permissionsReady) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-8 max-w-lg mx-auto text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/20 mb-5">
          <Eye className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Pressure Mode Setup</h2>
        <p className="text-slate-400 text-sm mb-6">
          This mode requires camera access and screen sharing to simulate a proctored interview environment.
          Your camera, screen, and tab focus will be monitored.
        </p>

        <div className="space-y-3 text-left mb-6">
          <div className="flex items-center gap-3 text-sm">
            <Camera className={`w-5 h-5 ${webcamStream ? "text-emerald-400" : "text-slate-500"}`} />
            <span className={webcamStream ? "text-emerald-300" : "text-slate-400"}>
              {webcamStream ? "Camera ready" : "Camera permission needed"}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Monitor className={`w-5 h-5 ${screenStream ? "text-emerald-400" : "text-slate-500"}`} />
            <span className={screenStream ? "text-emerald-300" : "text-slate-400"}>
              {screenStream ? "Screen sharing active" : "Screen sharing needed"}
            </span>
          </div>
        </div>

        {webcamError && <p className="text-sm text-red-400 mb-3">{webcamError}</p>}
        {screenError && <p className="text-sm text-red-400 mb-3">{screenError}</p>}

        <button
          onClick={setupPermissions}
          className="w-full font-semibold bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-400 hover:to-orange-400 text-white py-3 rounded-xl transition-all"
        >
          Grant Permissions & Start
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      {showRedFlash && (
        <div className="fixed inset-0 z-[60] bg-red-600/20 pointer-events-none animate-pulse" />
      )}

      {warnings.length > 0 && (
        <div className="absolute top-14 left-0 right-0 z-40 px-4 space-y-1">
          {warnings.slice(-2).map((w) => (
            <div
              key={w.t}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-sm text-red-300"
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {w.text}
            </div>
          ))}
        </div>
      )}

      {/* Camera preview — callback ref guarantees stream is attached on mount */}
      <div className="absolute bottom-20 right-4 z-50 w-52 h-40 rounded-2xl overflow-hidden border-2 border-slate-500 bg-black shadow-2xl">
        <video
          ref={videoCallbackRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
          style={{ transform: "scaleX(-1)" }}
        />
        <canvas ref={canvasRef} className="hidden" />
        <div className="absolute top-1.5 left-2 right-2 flex items-center justify-between pointer-events-none">
          <span className="text-[10px] font-semibold text-white bg-black/70 rounded px-1.5 py-0.5">You</span>
          <div className="flex items-center gap-1 bg-black/70 rounded px-1.5 py-0.5">
            <div className={`w-1.5 h-1.5 rounded-full ${headTrackingActive ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
            <span className="text-[10px] text-white">{headTrackingActive ? "Tracking" : "..."}</span>
          </div>
        </div>
        {/* Face guide corners */}
        <div className="absolute inset-3 pointer-events-none">
          <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-brand-400/70 rounded-tl" />
          <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-brand-400/70 rounded-tr" />
          <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-brand-400/70 rounded-bl" />
          <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-brand-400/70 rounded-br" />
        </div>
      </div>

      <RecruiterInterviewUI
        sessionId={sessionId}
        initialAiMessage={initialAiMessage}
        candidateName={candidateName}
        durationMinutes={durationMinutes}
        mode="pressure"
        onEnd={handleEnd}
        onReport={onReport}
      />
    </div>
  );
}

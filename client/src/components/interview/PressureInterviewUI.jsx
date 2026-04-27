import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Monitor, AlertTriangle, Eye } from "lucide-react";
import RecruiterInterviewUI from "./RecruiterInterviewUI";

const VISIBILITY_WARN_DELAY_MS = 500;
const CALIBRATION_FRAMES = 20;
/** Low-pass on pose angles — dampens jitter from the tracker */
const HEAD_POSE_SMOOTH_ALPHA = 0.22;
/** Degrees off neutral before we consider it “looking away” (natural micro-moves stay below this) */
const HEAD_YAW_WARN_DEG = 34;
const HEAD_PITCH_WARN_DEG = 28;
/** Must exceed thresholds this many frames in a row (~300–450ms) before warning */
const HEAD_POSE_CONFIRM_FRAMES = 12;
const HEAD_WARN_COOLDOWN_MS = 4000;
const WARNING_DISPLAY_MS = 3000;
const HEAD_WARN_DEDUCT_THRESHOLD = 10;
const TAB_SWITCH_DEDUCT_THRESHOLD = 3;

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
  const [activeWarning, setActiveWarning] = useState(null);
  const [showRedFlash, setShowRedFlash] = useState(false);
  const [permissionsReady, setPermissionsReady] = useState(false);
  const [headTrackingActive, setHeadTrackingActive] = useState(false);

  const webcamStreamRef = useRef(null);
  const videoRef = useRef(null);
  const warningTimerRef = useRef(null);
  const lastHeadWarnRef = useRef(0);
  const warningDismissTimerRef = useRef(null);
  const redFlashTimerRef = useRef(null);

  // Violation counters (persisted in refs so closures always see latest)
  const headWarningCountRef = useRef(0);
  const tabSwitchCountRef = useRef(0);
  const [headWarningCount, setHeadWarningCount] = useState(0);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);

  // Face detection state
  const calRef = useRef({
    samples: [],
    calibrated: false,
    baseYaw: 0,
    basePitch: 0,
    baseRoll: 0,
    filteredYaw: null,
    filteredPitch: null,
    poseConfirmStreak: 0,
  });
  const landmarkerRef = useRef(null);
  const rafIdRef = useRef(null);

  const showWarning = useCallback((msg) => {
    setActiveWarning({ text: msg, t: Date.now() });
    setShowRedFlash(true);

    clearTimeout(warningDismissTimerRef.current);
    clearTimeout(redFlashTimerRef.current);

    warningDismissTimerRef.current = setTimeout(() => setActiveWarning(null), WARNING_DISPLAY_MS);
    redFlashTimerRef.current = setTimeout(() => setShowRedFlash(false), WARNING_DISPLAY_MS);
  }, []);

  const attachStream = useCallback((el, stream) => {
    if (!el || !stream) return;
    el.srcObject = stream;
    const p = el.play();
    if (p !== undefined) p.catch(() => { setTimeout(() => el.play().catch(() => {}), 100); });
  }, []);

  const videoCallbackRef = useCallback((el) => {
    videoRef.current = el;
    if (el && webcamStreamRef.current) attachStream(el, webcamStreamRef.current);
  }, [attachStream]);

  useEffect(() => {
    if (videoRef.current && webcamStream) attachStream(videoRef.current, webcamStream);
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
        tabSwitchCountRef.current++;
        setTabSwitchCount(tabSwitchCountRef.current);
        showWarning("Screen sharing stopped! Please share your screen again.");
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
    if (cam && screen) setPermissionsReady(true);
  }

  // ─── Head tracking using MediaPipe Face Landmarker ───
  // Loads the MediaPipe Tasks-Vision Face Landmarker, which gives
  // 478 3D facial landmarks AND a facial transformation matrix from
  // which we extract head pose (yaw / pitch / roll) directly.
  // This is what proper proctoring tools use.
  useEffect(() => {
    if (!permissionsReady || !webcamStream) return;

    let cancelled = false;
    let lastVideoTime = -1;

    async function init() {
      calRef.current = {
        samples: [],
        calibrated: false,
        baseYaw: 0,
        basePitch: 0,
        baseRoll: 0,
        filteredYaw: null,
        filteredPitch: null,
        poseConfirmStreak: 0,
      };

      try {
        const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");

        const fileset = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm"
        );

        const landmarker = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numFaces: 3, // detect up to 3 to catch "multiple faces in frame"
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: true,
        });

        if (cancelled) {
          landmarker.close();
          return;
        }

        landmarkerRef.current = landmarker;
        setHeadTrackingActive(true);

        const cal = calRef.current;
        let noFaceStreak = 0;

        function loop() {
          if (cancelled) return;
          const video = videoRef.current;
          if (!video || video.readyState < 2 || !video.videoWidth) {
            rafIdRef.current = requestAnimationFrame(loop);
            return;
          }

          if (video.currentTime === lastVideoTime) {
            rafIdRef.current = requestAnimationFrame(loop);
            return;
          }
          lastVideoTime = video.currentTime;

          let result;
          try {
            result = landmarker.detectForVideo(video, performance.now());
          } catch {
            rafIdRef.current = requestAnimationFrame(loop);
            return;
          }

          const numFaces = result?.faceLandmarks?.length || 0;

          // ── No face ──
          if (numFaces === 0) {
            noFaceStreak++;
            if (noFaceStreak > 8 && cal.calibrated) {
              const now = Date.now();
              if (now - lastHeadWarnRef.current > HEAD_WARN_COOLDOWN_MS) {
                headWarningCountRef.current++;
                setHeadWarningCount(headWarningCountRef.current);
                showWarning("⚠️ No face detected! Please stay visible on camera.");
                lastHeadWarnRef.current = now;
              }
            }
            rafIdRef.current = requestAnimationFrame(loop);
            return;
          }

          noFaceStreak = 0;

          // ── Multiple faces ──
          if (numFaces > 1 && cal.calibrated) {
            const now = Date.now();
            if (now - lastHeadWarnRef.current > HEAD_WARN_COOLDOWN_MS) {
              headWarningCountRef.current++;
              setHeadWarningCount(headWarningCountRef.current);
              showWarning(`⚠️ ${numFaces} faces detected! Only the candidate should be visible.`);
              lastHeadWarnRef.current = now;
            }
            rafIdRef.current = requestAnimationFrame(loop);
            return;
          }

          // ── Single face: extract head pose from transformation matrix ──
          // The matrix is a 4x4 column-major rotation+translation from the
          // canonical face mesh to the detected face. Euler angles (XYZ) give yaw/pitch/roll.
          const matrix = result?.facialTransformationMatrixes?.[0]?.data;
          if (!matrix || matrix.length < 16) {
            rafIdRef.current = requestAnimationFrame(loop);
            return;
          }

          // Extract Euler angles from rotation matrix (column-major).
          // m[0]=R00, m[1]=R10, m[2]=R20, m[4]=R01, m[5]=R11, m[6]=R21,
          // m[8]=R02, m[9]=R12, m[10]=R22
          const r00 = matrix[0],  r10 = matrix[1],  r20 = matrix[2];
          const r01 = matrix[4],  r11 = matrix[5],  r21 = matrix[6];
          const r02 = matrix[8],  r12 = matrix[9],  r22 = matrix[10];
          // Yaw (Y axis): rotation around vertical axis — looking left/right
          // Pitch (X axis): rotation around horizontal axis — looking up/down
          // Roll (Z axis): tilt
          const pitch = Math.atan2(-r12, Math.sqrt(r02 * r02 + r22 * r22)) * (180 / Math.PI);
          const yaw   = Math.atan2(r02, r22) * (180 / Math.PI);
          const roll  = Math.atan2(r10, r11) * (180 / Math.PI);

          // ── Calibration ──
          if (!cal.calibrated) {
            cal.samples.push({ yaw, pitch, roll });
            if (cal.samples.length >= CALIBRATION_FRAMES) {
              cal.baseYaw   = cal.samples.reduce((s, p) => s + p.yaw,   0) / cal.samples.length;
              cal.basePitch = cal.samples.reduce((s, p) => s + p.pitch, 0) / cal.samples.length;
              cal.baseRoll  = cal.samples.reduce((s, p) => s + p.roll,  0) / cal.samples.length;
              cal.calibrated = true;
              cal.filteredYaw = cal.baseYaw;
              cal.filteredPitch = cal.basePitch;
              cal.poseConfirmStreak = 0;
            }
            rafIdRef.current = requestAnimationFrame(loop);
            return;
          }

          // Smooth pose — reduces single-frame spikes from the mesh tracker
          const a = HEAD_POSE_SMOOTH_ALPHA;
          cal.filteredYaw = cal.filteredYaw * (1 - a) + yaw * a;
          cal.filteredPitch = cal.filteredPitch * (1 - a) + pitch * a;

          const dYaw   = cal.filteredYaw   - cal.baseYaw;
          const dPitch = cal.filteredPitch - cal.basePitch;

          let warnMsg = "";
          if (dYaw > HEAD_YAW_WARN_DEG) {
            warnMsg = "⚠️ You're looking right! Keep your eyes on the screen.";
          } else if (dYaw < -HEAD_YAW_WARN_DEG) {
            warnMsg = "⚠️ You're looking left! Keep your eyes on the screen.";
          } else if (dPitch > HEAD_PITCH_WARN_DEG) {
            warnMsg = "⚠️ You're looking down! Face the screen directly.";
          } else if (dPitch < -HEAD_PITCH_WARN_DEG) {
            warnMsg = "⚠️ You're looking up! Face the screen directly.";
          }

          if (warnMsg) {
            cal.poseConfirmStreak = (cal.poseConfirmStreak || 0) + 1;
          } else {
            cal.poseConfirmStreak = 0;
          }

          if (
            warnMsg &&
            cal.poseConfirmStreak >= HEAD_POSE_CONFIRM_FRAMES
          ) {
            const now = Date.now();
            if (now - lastHeadWarnRef.current > HEAD_WARN_COOLDOWN_MS) {
              headWarningCountRef.current++;
              setHeadWarningCount(headWarningCountRef.current);
              showWarning(warnMsg);
              lastHeadWarnRef.current = now;
              cal.poseConfirmStreak = 0;
            }
          }

          rafIdRef.current = requestAnimationFrame(loop);
        }

        loop();
      } catch (err) {
        console.error("[PressureMode] MediaPipe init failed:", err);
        setHeadTrackingActive(false);
      }
    }

    init();

    return () => {
      cancelled = true;
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      if (landmarkerRef.current) {
        try { landmarkerRef.current.close(); } catch { /* ignore */ }
        landmarkerRef.current = null;
      }
      setHeadTrackingActive(false);
    };
  }, [permissionsReady, webcamStream, showWarning]);

  // ─── Tab visibility / window blur detection ───
  useEffect(() => {
    if (!permissionsReady) return;

    function handleVisibilityChange() {
      if (document.hidden) {
        warningTimerRef.current = setTimeout(() => {
          tabSwitchCountRef.current++;
          setTabSwitchCount(tabSwitchCountRef.current);
          showWarning("🚫 Tab switching detected! Stay on this tab during the interview.");
        }, VISIBILITY_WARN_DELAY_MS);
      } else {
        if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      }
    }

    function handleBlur() {
      tabSwitchCountRef.current++;
      setTabSwitchCount(tabSwitchCountRef.current);
      showWarning("🚫 Window focus lost! Do not switch to other applications.");
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
  }, [permissionsReady, showWarning]);

  // ─── Cleanup streams on unmount ───
  const webcamStreamCleanupRef = useRef(null);
  const screenStreamCleanupRef = useRef(null);
  useEffect(() => { webcamStreamCleanupRef.current = webcamStream; }, [webcamStream]);
  useEffect(() => { screenStreamCleanupRef.current = screenStream; }, [screenStream]);
  useEffect(() => {
    return () => {
      webcamStreamCleanupRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamCleanupRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function handleEnd() {
    webcamStream?.getTracks().forEach((t) => t.stop());
    screenStream?.getTracks().forEach((t) => t.stop());
    clearTimeout(warningDismissTimerRef.current);
    clearTimeout(redFlashTimerRef.current);
    try { document.exitFullscreen?.(); } catch { /* ignore */ }
    onEnd?.();
  }

  // Intercept report from RecruiterInterviewUI and apply pressure-mode deductions
  function handleReport(baseReport) {
    const hw = headWarningCountRef.current;
    const ts = tabSwitchCountRef.current;

    let deduction = 0;
    const deductionReasons = [];

    if (hw > HEAD_WARN_DEDUCT_THRESHOLD) {
      const excess = hw - HEAD_WARN_DEDUCT_THRESHOLD;
      const penalty = Math.min(15, excess * 2);
      deduction += penalty;
      deductionReasons.push(`Head movement warnings exceeded limit (${hw} warnings, −${penalty} points)`);
    }

    if (ts > TAB_SWITCH_DEDUCT_THRESHOLD) {
      const excess = ts - TAB_SWITCH_DEDUCT_THRESHOLD;
      const penalty = Math.min(15, excess * 3);
      deduction += penalty;
      deductionReasons.push(`Tab/window switches exceeded limit (${ts} switches, −${penalty} points)`);
    }

    const adjustedScore = Math.max(0, (baseReport.interviewScore || 0) - deduction);
    const adjustedConfidence = Math.max(0, (baseReport.confidenceScore || 0) - Math.round(deduction * 0.5));

    const adjustedSuggestions = [...(baseReport.suggestions || [])];
    if (deductionReasons.length > 0) {
      deductionReasons.forEach((r) => adjustedSuggestions.unshift(`[Pressure Mode Penalty] ${r}`));
    }

    onReport?.({
      ...baseReport,
      interviewScore: adjustedScore,
      confidenceScore: adjustedConfidence,
      suggestions: adjustedSuggestions,
      pressureViolations: {
        headWarnings: hw,
        tabSwitches: ts,
        totalDeduction: deduction,
        reasons: deductionReasons,
      },
    });
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
      {/* Red flash overlay — 3s duration */}
      {showRedFlash && (
        <div
          className="fixed inset-0 z-[60] pointer-events-none transition-opacity duration-300"
          style={{ background: "radial-gradient(ellipse at center, rgba(220,38,38,0.18) 0%, rgba(220,38,38,0.35) 100%)" }}
        />
      )}

      {/* Warning banner — auto-dismisses after 3s */}
      {activeWarning && (
        <div className="absolute top-14 left-0 right-0 z-40 px-4">
          <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-red-500/15 border border-red-500/40 backdrop-blur-sm shadow-lg">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span className="text-sm text-red-200 font-medium flex-1">{activeWarning.text}</span>
            <span className="text-[10px] text-red-400/70 tabular-nums shrink-0">
              Head: {headWarningCount} · Tab: {tabSwitchCount}
            </span>
          </div>
        </div>
      )}

      {/* Camera preview */}
      <div className="absolute bottom-20 right-4 z-50 w-52 h-40 rounded-2xl overflow-hidden border-2 border-slate-500 bg-black shadow-2xl">
        <video
          ref={videoCallbackRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
          style={{ transform: "scaleX(-1)" }}
        />
        <div className="absolute top-1.5 left-2 right-2 flex items-center justify-between pointer-events-none">
          <span className="text-[10px] font-semibold text-white bg-black/70 rounded px-1.5 py-0.5">You</span>
          <div className="flex items-center gap-1 bg-black/70 rounded px-1.5 py-0.5">
            <div className={`w-1.5 h-1.5 rounded-full ${headTrackingActive ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
            <span className="text-[10px] text-white">{headTrackingActive ? "Tracking" : "..."}</span>
          </div>
        </div>

        {/* Violation counter badges */}
        {(headWarningCount > 0 || tabSwitchCount > 0) && (
          <div className="absolute bottom-1.5 left-2 right-2 flex items-center gap-1.5 pointer-events-none">
            {headWarningCount > 0 && (
              <span className={`text-[9px] font-semibold rounded px-1.5 py-0.5 ${
                headWarningCount > HEAD_WARN_DEDUCT_THRESHOLD
                  ? "bg-red-500/80 text-white"
                  : "bg-amber-500/60 text-amber-100"
              }`}>
                👁 {headWarningCount}/{HEAD_WARN_DEDUCT_THRESHOLD}
              </span>
            )}
            {tabSwitchCount > 0 && (
              <span className={`text-[9px] font-semibold rounded px-1.5 py-0.5 ${
                tabSwitchCount > TAB_SWITCH_DEDUCT_THRESHOLD
                  ? "bg-red-500/80 text-white"
                  : "bg-amber-500/60 text-amber-100"
              }`}>
                🔀 {tabSwitchCount}/{TAB_SWITCH_DEDUCT_THRESHOLD}
              </span>
            )}
          </div>
        )}

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
        onReport={handleReport}
      />
    </div>
  );
}

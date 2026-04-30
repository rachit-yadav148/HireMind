import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, Monitor, AlertTriangle, Eye } from "lucide-react";
import RecruiterInterviewUI from "./RecruiterInterviewUI";

/** Tab hidden ≥ this duration counts as leaving (still suppressed during Safari setup/grace periods) */
const PAGE_HIDDEN_DEBOUNCE_MS = 600;
/** Enough to reject stray flashes; catches real tab/window switches outside grace */
const BLUR_PENALTY_DEBOUNCE_MS = 700;
/** While in fullscreen, poll for document.hasFocus() — catches some macOS multi-touch space switches */
const PROCTOR_FOCUS_POLL_MS = 320;
/** Ignore tab/blur penalties while pressure UI + Safari permission flow settles */
const PROCTOR_SURFACE_SUPPRESS_MS = 120_000;
/** Extra window after microphone is granted — covers focus return + opening TTS */
const PROCTOR_MIC_SETTLE_SUPPRESS_MS = 55_000;
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
const HEAD_WARN_DEDUCT_THRESHOLD = 5;
const TAB_SWITCH_DEDUCT_THRESHOLD = 3;
const SCREEN_SHARE_GRACE_SEC = 20;
const SCREEN_SHARE_MAX_STOPS = 3;

const CAM_CONSTRAINTS = {
  video: {
    facingMode: "user",
    width: { ideal: 320 },
    height: { ideal: 240 },
  },
  audio: false,
};

const DISPLAY_CONSTRAINTS = (() => {
  const base = { video: true, audio: false };
  if (typeof navigator === "undefined") return base;
  const ua = navigator.userAgent || "";
  /** True WebKit Safari (not Chrome/Edge/Chromium) — use only well-supported keys */
  const safariOnly = /Safari/i.test(ua) && !/(Chrome|Chromium|Edg)\//i.test(ua);
  if (safariOnly) return base;
  return { ...base, preferCurrentTab: true };
})();

function exitFullscreenDocument() {
  const doc = document;
  const fsEl = doc.fullscreenElement ?? doc.webkitFullscreenElement;
  if (!fsEl) return;
  const exit =
    doc.exitFullscreen ||
    doc.webkitExitFullscreen ||
    doc.webkitCancelFullScreen;
  try {
    const p = exit?.call(doc);
    if (p?.catch) p.catch(() => {});
  } catch {
    /* ignore — Safari throws "Not in fullscreen" if racing with user exit */
  }
}

/** Sync call from trusted click handler — browsers require a gesture for fullscreen in many cases */
function requestFullscreenFromUserGesture(root = document.documentElement) {
  if (!root || typeof root !== "object") return;
  const req = root.requestFullscreen || root.webkitRequestFullscreen;
  if (typeof req !== "function") return;
  try {
    const out = req.call(root);
    if (out?.catch) out.catch(() => {});
  } catch {
    /* unsupported / declined */
  }
}

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
  const [screenGrantBusy, setScreenGrantBusy] = useState(false);
  const [cameraGrantBusy, setCameraGrantBusy] = useState(false);
  const [headTrackingActive, setHeadTrackingActive] = useState(false);

  const webcamStreamRef = useRef(null);
  const videoRef = useRef(null);
  const lastHeadWarnRef = useRef(0);
  const warningDismissTimerRef = useRef(null);
  const redFlashTimerRef = useRef(null);
  const recruiterUiRef = useRef(null);
  /** Dedupe simultaneous blur + visibility spikes (Safari shows both on permission / sheet close) */
  const lastTabPenaltyAtRef = useRef(0);
  const blurPenaltyTimerRef = useRef(null);
  const hiddenPenaltyTimerRef = useRef(null);
  /** Timestamp (ms): do not penalize blur/hidden tab switches until this moment */
  const suppressProctorUntilRef = useRef(0);
  /** Ignore ended/inactive while we intentionally stop tracks (End click / unmount). */
  const ignoreScreenTrackEndRef = useRef(false);
  /** Strict Mode runs unmount cleanup once; refs persist — re-allow detection on the next mount. */
  useLayoutEffect(() => {
    ignoreScreenTrackEndRef.current = false;
  }, []);
  /** Dedupe: track ended, stream inactive, poll, and <video ended> often fire together. */
  const lastScreenShareStopAtRef = useRef(0);
  const screenCaptureVideoRef = useRef(null);

  // Violation counters (persisted in refs so closures always see latest)
  const headWarningCountRef = useRef(0);
  const tabSwitchCountRef = useRef(0);
  /** Each time the user stops screen share via the browser UI (not tab switch). */
  const screenShareStopCountRef = useRef(0);
  const [headWarningCount, setHeadWarningCount] = useState(0);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [screenShareGate, setScreenShareGate] = useState(null);
  /** { token, strike, secondsLeft } — token resets countdown effect */
  const [reshareBusy, setReshareBusy] = useState(false);

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

  const handleScreenShareEnded = useCallback(() => {
    if (ignoreScreenTrackEndRef.current) return;
    const now = Date.now();
    if (now - lastScreenShareStopAtRef.current < 900) return;
    lastScreenShareStopAtRef.current = now;

    setScreenStream(null);
    screenShareStopCountRef.current += 1;
    const strike = screenShareStopCountRef.current;

    if (strike >= SCREEN_SHARE_MAX_STOPS) {
      setScreenShareGate(null);
      showWarning("Interview terminated: screen sharing was stopped repeatedly (misconduct).");
      recruiterUiRef.current?.endInterview?.({ misconduct: true });
      return;
    }

    showWarning("Screen sharing stopped — restore it within 20 seconds or this interview will end.");
    setScreenShareGate({
      token: Date.now(),
      strike,
      secondsLeft: SCREEN_SHARE_GRACE_SEC,
    });
  }, [showWarning]);

  const handleScreenShareEndedRef = useRef(handleScreenShareEnded);
  useEffect(() => {
    handleScreenShareEndedRef.current = handleScreenShareEnded;
  }, [handleScreenShareEnded]);

  /**
   * Keep a playing <video> fed with the display stream — Safari/Chrome fire `ended` here reliably.
   */
  useEffect(() => {
    const el = screenCaptureVideoRef.current;
    if (!permissionsReady || !screenStream || !el) {
      if (el) el.srcObject = null;
      return;
    }

    const onVideoEnded = () => handleScreenShareEndedRef.current();
    el.srcObject = screenStream;
    el.muted = true;
    el.setAttribute("playsinline", "");
    el.play().catch(() => {});
    el.addEventListener("ended", onVideoEnded);

    return () => {
      el.removeEventListener("ended", onVideoEnded);
      el.srcObject = null;
    };
  }, [permissionsReady, screenStream]);

  /**
   * Also listen on the track + stream (behavior differs: Chrome pill vs Safari menu bar).
   */
  useEffect(() => {
    if (!permissionsReady || !screenStream) return;

    const stream = screenStream;
    const armedAt = Date.now();
    const ARM_MS = 1200;

    let fired = false;
    const notify = () => {
      if (Date.now() - armedAt < ARM_MS) return;
      if (fired || ignoreScreenTrackEndRef.current) return;
      fired = true;
      handleScreenShareEndedRef.current();
    };

    const mainTrack = stream.getVideoTracks()[0];
    if (!mainTrack) return;

    mainTrack.addEventListener("ended", notify);
    try {
      stream.addEventListener("inactive", notify);
    } catch {
      /* very old browsers */
    }
    mainTrack.onended = notify;
    try {
      stream.oninactive = notify;
    } catch {
      /* ignore */
    }

    const poll = window.setInterval(() => {
      if (Date.now() - armedAt < ARM_MS) return;
      if (ignoreScreenTrackEndRef.current) return;
      const v = stream.getVideoTracks()[0];
      if (!stream.active || !v || v.readyState === "ended") notify();
    }, 300);

    return () => {
      window.clearInterval(poll);
      mainTrack.removeEventListener("ended", notify);
      try {
        stream.removeEventListener("inactive", notify);
      } catch {
        /* ignore */
      }
      if (mainTrack.onended === notify) mainTrack.onended = null;
      try {
        if (stream.oninactive === notify) stream.oninactive = null;
      } catch {
        /* ignore */
      }
    };
  }, [permissionsReady, screenStream]);

  const requestScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia(DISPLAY_CONSTRAINTS);
      setScreenStream(stream);
      setScreenError("");
      return stream;
    } catch {
      setScreenError("Screen sharing denied. You must share your screen for this mode.");
      return null;
    }
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

  /**
   * WebKit deadlock: invoking getUserMedia and getDisplayMedia in parallel Promise.all(Settled)
   * can leave one or both promises pending forever → UI stuck on "Opening…".
   * Each capture must run from its own user gesture (Safari/Chromium-stable).
   *
   * IMPORTANT (Safari): do NOT enter fullscreen before the screen-share or camera dialogs.
   * requestFullscreen pushes the browser into a separate full-screen Space; WebKit often shows
   * the picker away from your tab so it feels like “another blank window/tab”. Fullscreen runs
   * only from "Start Pressure Interview" after both streams are granted.
   */
  async function grantScreenOnly() {
    if (screenGrantBusy || screenStream) return;
    setScreenGrantBusy(true);
    try {
      await requestScreenShare();
    } finally {
      setScreenGrantBusy(false);
    }
  }

  async function grantCameraOnly() {
    if (cameraGrantBusy || webcamStream) return;
    setWebcamError("");
    setCameraGrantBusy(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia(CAM_CONSTRAINTS);
      webcamStreamRef.current = stream;
      setWebcamStream(stream);
      setWebcamError("");
      return stream;
    } catch {
      setWebcamError("Camera permission denied. Check site/browser settings for camera access.");
      return null;
    } finally {
      setCameraGrantBusy(false);
    }
  }

  function beginInterviewAfterDevicesReady() {
    if (!screenStream || !webcamStream) return;
    requestFullscreenFromUserGesture(document.documentElement);
    setPermissionsReady(true);
  }

  /** Stop orphaned tracks if user granted one device then abandons refresh */
  function resetSetupStreams() {
    webcamStream?.getTracks().forEach((t) => t.stop());
    screenStream?.getTracks().forEach((t) => t.stop());
    webcamStreamRef.current = null;
    setWebcamStream(null);
    setScreenStream(null);
    setWebcamError("");
    setScreenError("");
  }

  async function handleReshareFromModal() {
    /* Do not fullscreen before picker — same Safari Space/picker separation as setup flow. */
    setReshareBusy(true);
    setScreenError("");
    try {
      const stream = await requestScreenShare();
      requestFullscreenFromUserGesture(document.documentElement);
      if (stream) setScreenShareGate(null);
    } finally {
      setReshareBusy(false);
    }
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

        async function createLandmarker(delegate) {
          return FaceLandmarker.createFromOptions(fileset, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
              delegate,
            },
            runningMode: "VIDEO",
            numFaces: 3, // detect up to 3 to catch "multiple faces in frame"
            outputFaceBlendshapes: false,
            outputFacialTransformationMatrixes: true,
          });
        }

        let landmarker;
        try {
          landmarker = await createLandmarker("GPU");
        } catch {
          landmarker = await createLandmarker("CPU");
        }

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

  const handleInterviewMicReady = useCallback(() => {
    suppressProctorUntilRef.current = Date.now() + PROCTOR_MIC_SETTLE_SUPPRESS_MS;
  }, []);

  useEffect(() => {
    if (!permissionsReady) return;
    suppressProctorUntilRef.current = Date.now() + PROCTOR_SURFACE_SUPPRESS_MS;
  }, [permissionsReady]);

  function shouldSuppressProctorSignals() {
    return Date.now() < suppressProctorUntilRef.current;
  }

  // ─── Tab visibility / window blur detection ───
  useEffect(() => {
    if (!permissionsReady) return;

    function clearDeferTimers() {
      clearTimeout(blurPenaltyTimerRef.current);
      clearTimeout(hiddenPenaltyTimerRef.current);
      blurPenaltyTimerRef.current = null;
      hiddenPenaltyTimerRef.current = null;
    }

    function applyTabPenalty(reason) {
      if (shouldSuppressProctorSignals()) return;
      const now = Date.now();
      if (now - lastTabPenaltyAtRef.current < 2600) return;
      lastTabPenaltyAtRef.current = now;

      tabSwitchCountRef.current++;
      setTabSwitchCount(tabSwitchCountRef.current);
      showWarning(
        reason === "hidden"
          ? "🚫 Tab switching detected! Stay on this HireMind tab during Pressure mode."
          : reason === "fullscreen"
            ? "🚫 You left fullscreen — return to fullscreen and this tab or penalties will continue to apply."
            : "🚫 HireMind lost window focus (another tab, desktop, or swipe). Return immediately — violation recorded toward your score.",
      );
    }

    function handleVisibilityChange() {
      if (!document.hidden) {
        clearTimeout(hiddenPenaltyTimerRef.current);
        hiddenPenaltyTimerRef.current = null;
        clearTimeout(blurPenaltyTimerRef.current);
        blurPenaltyTimerRef.current = null;
        return;
      }

      hiddenPenaltyTimerRef.current = setTimeout(() => {
        hiddenPenaltyTimerRef.current = null;
        if (!document.hidden) return;
        if (shouldSuppressProctorSignals()) return;
        applyTabPenalty("hidden");
      }, PAGE_HIDDEN_DEBOUNCE_MS);
    }

    function handleBlur() {
      clearTimeout(blurPenaltyTimerRef.current);
      blurPenaltyTimerRef.current = setTimeout(() => {
        blurPenaltyTimerRef.current = null;
        if (shouldSuppressProctorSignals()) return;
        if (!document.hidden && document.visibilityState === "visible" && document.hasFocus?.()) return;
        applyTabPenalty("blur");
      }, BLUR_PENALTY_DEBOUNCE_MS);
    }

    function handleFocusOrGain() {
      clearTimeout(blurPenaltyTimerRef.current);
      blurPenaltyTimerRef.current = null;
    }

    /** Warn if candidate exits fullscreen during proctoring (often means leaving focus). Ignore intentional endInterview. */
    let wasFullscreen = !!(document.fullscreenElement ?? document.webkitFullscreenElement);
    function handleFullscreenChange() {
      const nowFs = !!(document.fullscreenElement ?? document.webkitFullscreenElement);
      if (wasFullscreen && !nowFs && !ignoreScreenTrackEndRef.current && !shouldSuppressProctorSignals()) {
        applyTabPenalty("fullscreen");
      }
      wasFullscreen = nowFs;
    }

    /** macOS: three-finger / Mission Control style switches sometimes skip blur but drop hasFocus while staying "visible". */
    const focusPollId = window.setInterval(() => {
      if (shouldSuppressProctorSignals()) return;
      if (!(document.fullscreenElement ?? document.webkitFullscreenElement)) return;
      if (document.hidden || document.visibilityState !== "visible") return;
      if (typeof document.hasFocus !== "function" || document.hasFocus()) return;
      applyTabPenalty("blur");
    }, PROCTOR_FOCUS_POLL_MS);

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocusOrGain);
    document.addEventListener("pointerdown", handleFocusOrGain, true);

    return () => {
      window.clearInterval(focusPollId);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocusOrGain);
      document.removeEventListener("pointerdown", handleFocusOrGain, true);
      clearDeferTimers();
      exitFullscreenDocument();
    };
  }, [permissionsReady, showWarning]);

  // ─── Cleanup streams on unmount ───
  const webcamStreamCleanupRef = useRef(null);
  const screenStreamCleanupRef = useRef(null);
  useEffect(() => { webcamStreamCleanupRef.current = webcamStream; }, [webcamStream]);
  useEffect(() => { screenStreamCleanupRef.current = screenStream; }, [screenStream]);
  useEffect(() => {
    return () => {
      ignoreScreenTrackEndRef.current = true;
      webcamStreamCleanupRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamCleanupRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (!screenShareGate?.token) return;
    const id = setInterval(() => {
      setScreenShareGate((g) => {
        if (!g) return null;
        const next = (g.secondsLeft ?? SCREEN_SHARE_GRACE_SEC) - 1;
        if (next <= 0) {
          recruiterUiRef.current?.endInterview?.({ reason: "screen_share_timeout" });
          return null;
        }
        return { ...g, secondsLeft: next };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [screenShareGate?.token]);

  function handleEnd() {
    ignoreScreenTrackEndRef.current = true;
    webcamStream?.getTracks().forEach((t) => t.stop());
    screenStream?.getTracks().forEach((t) => t.stop());
    clearTimeout(warningDismissTimerRef.current);
    clearTimeout(redFlashTimerRef.current);
    exitFullscreenDocument();
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
        screenShareStops: screenShareStopCountRef.current,
        totalDeduction: deduction,
        reasons: deductionReasons,
      },
    });
  }

  // ─── Permission gate + interview — hidden capture <video> must always be in DOM for ref + ended events ───
  return (
    <>
      <video
        ref={screenCaptureVideoRef}
        muted
        playsInline
        autoPlay
        className="pointer-events-none fixed left-0 top-0 h-px w-px max-h-px max-w-px overflow-hidden opacity-0"
        aria-hidden
      />
      {!permissionsReady ? (
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

        <p className="text-xs text-slate-500 mb-5 text-left leading-relaxed">
          <span className="text-slate-400">Safari:</span> use <strong className="text-slate-300">Share screen</strong> and{" "}
          <strong className="text-slate-300">Allow camera</strong> here in <strong className="text-slate-300">this same tab</strong> (we wait until you tap{" "}
          <strong className="text-slate-300">Start Pressure Interview</strong> before fullscreen so system prompts are not split across a blank Safari window).{" "}
          After the interview starts, stay in fullscreen on this tab until you tap <strong className="text-slate-300">End</strong> — switching away is logged.
        </p>

        <div className="flex flex-col gap-3 mb-5">
          <button
            type="button"
            onClick={() => void grantScreenOnly()}
            disabled={screenGrantBusy || Boolean(screenStream)}
            className="w-full font-semibold rounded-xl py-3 px-4 transition-all bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white border border-slate-600"
          >
            {screenGrantBusy
              ? "Opening screen picker…"
              : screenStream
                ? "Screen sharing ✓"
                : "① Share screen"}
          </button>
          <button
            type="button"
            onClick={() => void grantCameraOnly()}
            disabled={cameraGrantBusy || Boolean(webcamStream)}
            className="w-full font-semibold rounded-xl py-3 px-4 transition-all bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white border border-slate-600"
          >
            {cameraGrantBusy
              ? "Opening camera…"
              : webcamStream
                ? "Camera ✓"
                : "② Allow camera"}
          </button>
        </div>

        <button
          type="button"
          onClick={() => beginInterviewAfterDevicesReady()}
          disabled={!screenStream || !webcamStream}
          className="w-full font-semibold bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-400 hover:to-orange-400 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-xl transition-all"
        >
          Start Pressure Interview
        </button>

        <button
          type="button"
          onClick={() => resetSetupStreams()}
          className="mt-3 text-xs text-slate-500 hover:text-slate-300 underline-offset-2 hover:underline"
        >
          Reset and try again
        </button>
      </div>
      ) : (
    <div className="relative">
      {screenShareGate &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/85 p-4"
            style={{ isolation: "isolate" }}
          >
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="screen-share-gate-title"
              className="w-full max-w-md rounded-2xl border-2 border-red-500 bg-gradient-to-b from-red-950 to-slate-950 p-6 shadow-2xl shadow-red-900/40"
            >
              <h3 id="screen-share-gate-title" className="text-lg font-bold text-red-200 mb-2">
                Screen sharing required
              </h3>
              <p className="text-sm text-red-100/95 mb-1">
                You stopped sharing your screen. You must share again to continue this proctored interview.
              </p>
              <p className="text-3xl font-mono font-bold text-white text-center my-4 tabular-nums">
                {screenShareGate.secondsLeft}s
              </p>
              <p className="text-xs text-amber-200/90 mb-4">
                Incident {screenShareGate.strike} of {SCREEN_SHARE_MAX_STOPS}. Stopping screen share{" "}
                {SCREEN_SHARE_MAX_STOPS} times ends the interview for misconduct.
              </p>
              {screenError && <p className="text-xs text-red-300 mb-3">{screenError}</p>}
              <button
                type="button"
                onClick={() => void handleReshareFromModal()}
                disabled={reshareBusy}
                className="w-full font-semibold bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white py-3 rounded-xl transition-colors"
              >
                {reshareBusy ? "Opening picker…" : "Share screen again now"}
              </button>
            </div>
          </div>,
          document.body
        )}

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
        ref={recruiterUiRef}
        sessionId={sessionId}
        initialAiMessage={initialAiMessage}
        candidateName={candidateName}
        durationMinutes={durationMinutes}
        mode="pressure"
        onInterviewMicReady={handleInterviewMicReady}
        onEnd={handleEnd}
        onReport={handleReport}
      />
    </div>
      )}
    </>
  );
}

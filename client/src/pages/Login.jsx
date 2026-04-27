import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { getApiErrorMessage } from "../services/api";
import { Eye, EyeOff } from "../components/Icons";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] },
  }),
};

/* ── Typing text hook ───────────────────────────────────────────────────── */
function useTypingText(text, speed = 38, startDelay = 0) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    setDisplayed("");
    setDone(false);
    let i = 0;
    const start = setTimeout(() => {
      const id = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) { clearInterval(id); setDone(true); }
      }, speed);
      return () => clearInterval(id);
    }, startDelay);
    return () => clearTimeout(start);
  }, [text, speed, startDelay]);
  return { displayed, done };
}

/* ── Mini circular progress ─────────────────────────────────────────────── */
function CircleProgress({ pct, color, size = 40, stroke = 4 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} fill="none" />
      <motion.circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
        strokeLinecap="round" strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ * (1 - pct / 100) }}
        transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1], delay: 0.6 }}
      />
    </svg>
  );
}

/* ── Application pipeline ───────────────────────────────────────────────── */
const APPS = [
  { company: "Google", role: "SWE II", stage: "Interview", stageColor: "#8b5cf6", dot: "#8b5cf6" },
  { company: "Meta", role: "Frontend Eng", stage: "OA Sent", stageColor: "#f59e0b", dot: "#f59e0b" },
  { company: "Stripe", role: "Full Stack", stage: "Applied", stageColor: "#06b6d4", dot: "#06b6d4" },
  { company: "Figma", role: "SWE Intern", stage: "Offer", stageColor: "#10b981", dot: "#10b981" },
];

/* ── AI question that types itself ─────────────────────────────────────── */
const QUESTIONS = [
  "Explain the difference between TCP and UDP.",
  "Design a URL shortener like bit.ly.",
  "What is memoization and when to use it?",
  "How does React's virtual DOM work?",
];

function QuestionTyper() {
  const [idx, setIdx] = useState(0);
  const { displayed, done } = useTypingText(QUESTIONS[idx], 30, 200);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setIdx((i) => (i + 1) % QUESTIONS.length), 2000);
    return () => clearTimeout(t);
  }, [done]);
  return (
    <span className="text-white text-[11px] leading-snug font-medium">
      {displayed}
      <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.7, repeat: Infinity }}
        className="inline-block w-[2px] h-3 bg-brand-400 ml-[1px] align-middle rounded-full" />
    </span>
  );
}

/* ── Main "Welcome Back" panel visual ──────────────────────────────────── */
function WelcomeBackScene() {
  const [activeFeature, setActiveFeature] = useState(0);
  const [atsScore] = useState(87);
  const [appIdx, setAppIdx] = useState(0);

  // Cycle highlight through 4 feature cards
  useEffect(() => {
    const id = setInterval(() => setActiveFeature((i) => (i + 1) % 4), 2800);
    return () => clearInterval(id);
  }, []);

  // Scroll apps
  useEffect(() => {
    const id = setInterval(() => setAppIdx((i) => (i + 1) % APPS.length), 2200);
    return () => clearInterval(id);
  }, []);

  const features = [
    { id: 0, label: "Resume Analysis",    icon: "📄", accent: "#06b6d4" },
    { id: 1, label: "AI Interview",        icon: "🎙️", accent: "#8b5cf6" },
    { id: 2, label: "Question Generator", icon: "💡", accent: "#f59e0b" },
    { id: 3, label: "App Tracker",         icon: "📋", accent: "#10b981" },
  ];

  return (
    <div className="w-full max-w-sm mx-auto space-y-3.5">

      {/* ── Greeting card ── */}
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.65, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-2xl border border-white/10 px-5 py-4 flex items-center gap-4"
        style={{ background: "rgba(10,16,30,0.9)", backdropFilter: "blur(20px)" }}
      >
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-500 to-fuchsia-500 flex items-center justify-center text-white font-bold text-lg shadow-glow">
            A
          </div>
          <motion.div animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }} transition={{ duration: 2, repeat: Infinity }}
            className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-slate-900"
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm leading-tight">Welcome back, Akshat 👋</p>
          <p className="text-slate-500 text-[11px] mt-0.5">Continue your prep streak — Day 12 🔥</p>
        </div>
        {/* Streak badge */}
        <div className="shrink-0 text-center">
          <p className="text-amber-400 font-bold text-lg leading-none">12</p>
          <p className="text-[9px] text-slate-600 uppercase tracking-wide mt-0.5">Streak</p>
        </div>
      </motion.div>

      {/* ── 4-feature grid ── */}
      <div className="grid grid-cols-2 gap-2.5">

        {/* Resume Analysis */}
        <motion.div
          initial={{ opacity: 0, scale: 0.93 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="rounded-2xl border p-4 relative overflow-hidden transition-all duration-500"
          style={{
            background: activeFeature === 0 ? "rgba(6,182,212,0.1)" : "rgba(10,16,30,0.85)",
            borderColor: activeFeature === 0 ? "rgba(6,182,212,0.4)" : "rgba(255,255,255,0.08)",
            backdropFilter: "blur(16px)",
            boxShadow: activeFeature === 0 ? "0 0 24px rgba(6,182,212,0.15)" : "none",
          }}
        >
          {activeFeature === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 pointer-events-none"
              style={{ background: "radial-gradient(circle at 20% 20%, rgba(6,182,212,0.12), transparent 70%)" }} />
          )}
          <div className="flex items-start justify-between mb-3">
            <span className="text-base">📄</span>
            <div className="relative">
              <CircleProgress pct={atsScore} color="#06b6d4" size={36} stroke={3.5} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[9px] font-bold text-cyan-400">{atsScore}</span>
              </div>
            </div>
          </div>
          <p className="text-white text-[11px] font-semibold leading-tight">Resume Score</p>
          <p className="text-slate-500 text-[10px] mt-0.5">87/100 · ATS ready</p>
          {/* Mini bar */}
          <div className="mt-2.5 h-1 rounded-full bg-white/6 overflow-hidden">
            <motion.div className="h-full rounded-full bg-cyan-400"
              initial={{ width: 0 }} animate={{ width: "87%" }}
              transition={{ duration: 1.2, delay: 0.8, ease: [0.22, 1, 0.36, 1] }} />
          </div>
        </motion.div>

        {/* AI Interview */}
        <motion.div
          initial={{ opacity: 0, scale: 0.93 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.45, duration: 0.5 }}
          className="rounded-2xl border p-4 relative overflow-hidden transition-all duration-500"
          style={{
            background: activeFeature === 1 ? "rgba(139,92,246,0.1)" : "rgba(10,16,30,0.85)",
            borderColor: activeFeature === 1 ? "rgba(139,92,246,0.4)" : "rgba(255,255,255,0.08)",
            backdropFilter: "blur(16px)",
            boxShadow: activeFeature === 1 ? "0 0 24px rgba(139,92,246,0.15)" : "none",
          }}
        >
          {activeFeature === 1 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 pointer-events-none"
              style={{ background: "radial-gradient(circle at 80% 20%, rgba(139,92,246,0.12), transparent 70%)" }} />
          )}
          <div className="flex items-start justify-between mb-3">
            <span className="text-base">🎙️</span>
            {/* Mini orb */}
            <div className="relative w-9 h-9 flex items-center justify-center">
              {[0, 1].map((i) => (
                <motion.div key={i} className="absolute rounded-full border border-violet-400/30"
                  style={{ width: 14 + i * 10, height: 14 + i * 10 }}
                  animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4] }}
                  transition={{ duration: 1.4 + i * 0.3, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
              <motion.div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-brand-600"
                animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>
                <div className="w-full h-full flex items-center justify-center gap-[1.5px]">
                  {[0, 1, 2].map((i) => (
                    <motion.div key={i} className="w-[2px] rounded-full bg-white/80"
                      animate={{ height: ["3px", "8px", "3px"] }}
                      transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }} />
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
          <p className="text-white text-[11px] font-semibold leading-tight">AI Interview</p>
          <p className="text-slate-500 text-[10px] mt-0.5">6 sessions · Avg 92/100</p>
          <div className="mt-2.5 flex gap-1">
            {[88, 90, 85, 92, 94, 92].map((s, i) => (
              <motion.div key={i} className="flex-1 rounded-sm bg-violet-500/60"
                initial={{ height: 4 }} animate={{ height: `${Math.max(4, (s - 80) * 1.8)}px` }}
                transition={{ delay: 0.9 + i * 0.08, duration: 0.5 }}
                style={{ minHeight: 4, maxHeight: 16 }} />
            ))}
          </div>
        </motion.div>

        {/* Question Generator */}
        <motion.div
          initial={{ opacity: 0, scale: 0.93 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.55, duration: 0.5 }}
          className="rounded-2xl border p-4 relative overflow-hidden transition-all duration-500"
          style={{
            background: activeFeature === 2 ? "rgba(245,158,11,0.08)" : "rgba(10,16,30,0.85)",
            borderColor: activeFeature === 2 ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.08)",
            backdropFilter: "blur(16px)",
            boxShadow: activeFeature === 2 ? "0 0 24px rgba(245,158,11,0.12)" : "none",
          }}
        >
          {activeFeature === 2 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 pointer-events-none"
              style={{ background: "radial-gradient(circle at 20% 80%, rgba(245,158,11,0.1), transparent 70%)" }} />
          )}
          <div className="flex items-start justify-between mb-2">
            <span className="text-base">💡</span>
            <span className="text-[9px] text-amber-400 font-bold bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded-full">AI</span>
          </div>
          <p className="text-white text-[11px] font-semibold leading-tight mb-2">Question Gen</p>
          <div className="min-h-[36px]">
            <QuestionTyper />
          </div>
        </motion.div>

        {/* Application Tracker */}
        <motion.div
          initial={{ opacity: 0, scale: 0.93 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.65, duration: 0.5 }}
          className="rounded-2xl border p-4 relative overflow-hidden transition-all duration-500"
          style={{
            background: activeFeature === 3 ? "rgba(16,185,129,0.08)" : "rgba(10,16,30,0.85)",
            borderColor: activeFeature === 3 ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.08)",
            backdropFilter: "blur(16px)",
            boxShadow: activeFeature === 3 ? "0 0 24px rgba(16,185,129,0.12)" : "none",
          }}
        >
          {activeFeature === 3 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 pointer-events-none"
              style={{ background: "radial-gradient(circle at 80% 80%, rgba(16,185,129,0.1), transparent 70%)" }} />
          )}
          <div className="flex items-start justify-between mb-2">
            <span className="text-base">📋</span>
            <span className="text-[9px] text-emerald-400 font-bold">{APPS.length} apps</span>
          </div>
          <p className="text-white text-[11px] font-semibold leading-tight mb-2">App Tracker</p>
          <AnimatePresence mode="wait">
            <motion.div key={appIdx}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="flex items-center justify-between"
            >
              <div>
                <p className="text-white text-[11px] font-bold leading-none">{APPS[appIdx].company}</p>
                <p className="text-slate-500 text-[10px] mt-0.5 truncate">{APPS[appIdx].role}</p>
              </div>
              <span className="text-[9px] font-bold px-2 py-1 rounded-full border"
                style={{ color: APPS[appIdx].stageColor, borderColor: `${APPS[appIdx].stageColor}40`, background: `${APPS[appIdx].stageColor}12` }}>
                {APPS[appIdx].stage}
              </span>
            </motion.div>
          </AnimatePresence>
          {/* Pipeline dots */}
          <div className="mt-2.5 flex items-center gap-1.5">
            {["Applied", "OA", "Interview", "Offer"].map((s, i) => {
              const active = i <= ["Applied", "OA Sent", "Interview", "Offer"].indexOf(APPS[appIdx].stage);
              return (
                <div key={s} className="flex items-center gap-1.5 flex-1">
                  <motion.div className="w-1.5 h-1.5 rounded-full shrink-0"
                    animate={{ scale: active ? [1, 1.3, 1] : 1 }}
                    transition={{ duration: 1.5, repeat: active ? Infinity : 0 }}
                    style={{ background: active ? APPS[appIdx].stageColor : "rgba(255,255,255,0.1)" }} />
                  {i < 3 && <div className="flex-1 h-[1px]" style={{ background: active ? `${APPS[appIdx].stageColor}60` : "rgba(255,255,255,0.07)" }} />}
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* ── Feature nav dots ── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}
        className="flex items-center justify-center gap-2"
      >
        {features.map((f, i) => (
          <motion.button key={f.id} onClick={() => setActiveFeature(i)}
            className="relative flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all duration-300"
            style={{
              background: activeFeature === i ? `${f.accent}18` : "transparent",
              color: activeFeature === i ? f.accent : "rgba(148,163,184,0.6)",
              border: `1px solid ${activeFeature === i ? `${f.accent}40` : "transparent"}`,
            }}
          >
            <span>{f.icon}</span>
            <AnimatePresence>
              {activeFeature === i && (
                <motion.span key="label" initial={{ width: 0, opacity: 0 }} animate={{ width: "auto", opacity: 1 }} exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }} className="overflow-hidden whitespace-nowrap">
                  {f.label.split(" ")[0]}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}

/* ─── Login page ─────────────────────────────────────────────────────────── */
export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, "Login failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex" style={{ background: "#020617" }}>

      {/* ── Left panel ── */}
      <div className="hidden lg:flex flex-col w-[52%] relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0" style={{
          background: "linear-gradient(135deg, #020617 0%, #0c1628 45%, #0f0a24 75%, #150520 100%)"
        }} />
        {/* Animated blobs */}
        <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-80px] left-[-60px] w-[380px] h-[380px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(14,165,233,0.16) 0%, transparent 70%)" }} />
        <motion.div animate={{ scale: [1, 1.12, 1], opacity: [0.35, 0.6, 0.35] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 2.5 }}
          className="absolute bottom-[-80px] right-[-60px] w-[420px] h-[420px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)" }} />
        <motion.div animate={{ x: [0, 18, 0], y: [0, -12, 0] }}
          transition={{ duration: 13, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute top-1/2 left-1/3 w-[260px] h-[260px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(217,70,239,0.08) 0%, transparent 70%)" }} />
        <div className="absolute inset-0 bg-grid opacity-[0.15] pointer-events-none" />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full p-10 xl:p-14">
          {/* Logo */}
          <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
            <Link to="/" className="font-display font-bold text-2xl text-white">
              Hire<span className="bg-gradient-to-r from-cyan-300 via-brand-400 to-fuchsia-400 bg-clip-text text-transparent">Mind</span>
            </Link>
          </motion.div>

          {/* Headline */}
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.6 }} className="mt-9 mb-7"
          >
            <p className="text-[10px] text-brand-400 font-bold uppercase tracking-[0.2em] mb-3">Your Prep Dashboard</p>
            <h2 className="font-display text-3xl xl:text-[2.1rem] font-bold text-white leading-tight">
              Everything you need<br />
              <span className="bg-gradient-to-r from-cyan-300 via-brand-400 to-fuchsia-400 bg-clip-text text-transparent">
                to land the role.
              </span>
            </h2>
            <p className="text-slate-400 text-sm mt-3 leading-relaxed max-w-[300px]">
              Resume scoring, AI interviews, question practice, and application tracking — all in one place.
            </p>
          </motion.div>

          {/* Dashboard visual */}
          <div className="flex-1 flex items-center">
            <WelcomeBackScene />
          </div>

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
            className="text-xs text-slate-600 mt-5"
          >
            Trusted by students at IIT, NIT & top universities
          </motion.p>
        </div>
      </div>

      {/* ── Right panel — white card ── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-10 relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #0d1b3e 0%, #0a0f28 35%, #120828 65%, #0d1224 100%)" }}
      >
        {/* Grid */}
        <div className="absolute inset-0 bg-grid opacity-[0.12] pointer-events-none" />
        {/* Animated orbs */}
        <div className="pointer-events-none absolute inset-0">
          <motion.div animate={{ scale: [1, 1.25, 1], opacity: [0.55, 0.85, 0.55] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-20 -right-20 w-72 h-72 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(99,102,241,0.22) 0%, transparent 70%)" }} />
          <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.45, 0.75, 0.45] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            className="absolute -bottom-24 -left-16 w-80 h-80 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(14,165,233,0.2) 0%, transparent 70%)" }} />
          <motion.div animate={{ x: [0, 16, 0], y: [0, -12, 0] }}
            transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(217,70,239,0.1) 0%, transparent 60%)" }} />
          {/* Corner accent lines */}
          <div className="absolute top-0 right-0 w-40 h-40 opacity-20"
            style={{ background: "linear-gradient(225deg, rgba(99,102,241,0.5) 0%, transparent 60%)" }} />
          <div className="absolute bottom-0 left-0 w-40 h-40 opacity-20"
            style={{ background: "linear-gradient(45deg, rgba(14,165,233,0.4) 0%, transparent 60%)" }} />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md relative z-10"
        >
          {/* Mobile logo */}
          <div className="lg:hidden mb-7 text-center">
            <Link to="/" className="font-display font-bold text-2xl text-white inline-block">
              Hire<span className="bg-gradient-to-r from-cyan-300 via-brand-400 to-fuchsia-400 bg-clip-text text-transparent">Mind</span>
            </Link>
          </div>

          {/* White card */}
          <div className="bg-white rounded-3xl shadow-[0_24px_80px_rgba(0,0,0,0.5)] overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-cyan-400 via-brand-500 to-fuchsia-500" />

            <div className="px-8 py-9">
              <div className="mb-7">
                <h1 className="font-display text-2xl font-bold text-slate-900">Welcome back</h1>
                <p className="text-slate-500 mt-1 text-sm">Sign in to continue your prep</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 flex items-start gap-2"
                  >
                    <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {error}
                  </motion.div>
                )}

                <motion.div custom={0} variants={fadeUp} initial="hidden" animate="show">
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Email</label>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 transition-all duration-200"
                    placeholder="you@email.com"
                  />
                </motion.div>

                <motion.div custom={1} variants={fadeUp} initial="hidden" animate="show">
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Password</label>
                  <div className="relative">
                    <input type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl bg-slate-50 border border-slate-200 pl-4 pr-12 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 transition-all duration-200"
                    />
                    <button type="button" onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 px-4 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="mt-2 text-right">
                    <Link to="/forgot-password" className="text-xs text-brand-500 hover:text-brand-600 font-medium transition-colors">
                      Forgot password?
                    </Link>
                  </div>
                </motion.div>

                <motion.div custom={2} variants={fadeUp} initial="hidden" animate="show">
                  <motion.button type="submit" disabled={loading}
                    whileHover={!loading ? { scale: 1.02 } : {}} whileTap={!loading ? { scale: 0.98 } : {}}
                    className="w-full font-semibold bg-gradient-to-r from-brand-500 to-fuchsia-500 disabled:opacity-50 text-white py-3.5 rounded-xl shadow-glow hover:shadow-glow-lg transition-shadow duration-200 text-sm"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Signing in…
                      </span>
                    ) : "Sign in"}
                  </motion.button>
                </motion.div>
              </form>

              <motion.p custom={3} variants={fadeUp} initial="hidden" animate="show"
                className="text-center text-sm text-slate-500 mt-6"
              >
                Don&apos;t have an account?{" "}
                <Link to="/register" className="text-brand-500 hover:text-brand-600 font-semibold transition-colors">
                  Create one free
                </Link>
              </motion.p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

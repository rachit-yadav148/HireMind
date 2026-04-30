import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { getApiErrorMessage } from "../services/api";
import { Eye, EyeOff } from "../components/Icons";
import BrandLogo, { BrandWordmarkText } from "../components/BrandLogo";

const OTP_RESEND_COOLDOWN_SECONDS = Math.max(
  10,
  Math.min(300, Number(import.meta.env.VITE_OTP_RESEND_COOLDOWN || 30))
);

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] },
  }),
};

/* ─── ATS Resume visual for Register left panel ──────────────────────────── */
const SKILLS = [
  { name: "React / Next.js", pct: 92, color: "#06b6d4" },
  { name: "System Design", pct: 78, color: "#8b5cf6" },
  { name: "Data Structures", pct: 85, color: "#10b981" },
  { name: "Communication", pct: 88, color: "#f59e0b" },
];

const FEEDBACK = [
  { icon: "✓", text: "Strong technical keywords detected", color: "text-emerald-400", border: "border-emerald-500/25", bg: "bg-emerald-500/8" },
  { icon: "✓", text: "Quantified achievements found", color: "text-emerald-400", border: "border-emerald-500/25", bg: "bg-emerald-500/8" },
  { icon: "!", text: "Add leadership experience section", color: "text-amber-400", border: "border-amber-500/25", bg: "bg-amber-500/8" },
];

function ATSBar({ pct, color, delay }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), delay);
    return () => clearTimeout(t);
  }, [pct, delay]);
  return (
    <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
      <motion.div className="h-full rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${width}%` }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: delay / 1000 }}
        style={{ background: color }}
      />
    </div>
  );
}

function ResumeScene() {
  const [score, setScore] = useState(0);
  const [feedbackIdx, setFeedbackIdx] = useState(0);
  const [scanning, setScanning] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setScanning(false);
      // Count up to 87
      let current = 0;
      const inc = setInterval(() => {
        current += 3;
        if (current >= 87) { setScore(87); clearInterval(inc); }
        else setScore(current);
      }, 30);
    }, 900);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setFeedbackIdx((i) => (i + 1) % FEEDBACK.length), 2800);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="w-full max-w-sm mx-auto space-y-4">
      {/* Resume card */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-2xl overflow-hidden border border-white/10"
        style={{ background: "rgba(10,16,30,0.85)", backdropFilter: "blur(20px)" }}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8">
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ opacity: scanning ? [1, 0.3, 1] : 1 }}
              transition={{ duration: 0.9, repeat: scanning ? Infinity : 0 }}
              className={`w-2 h-2 rounded-full ${scanning ? "bg-amber-400" : "bg-emerald-400"}`}
              style={{ boxShadow: scanning ? "0 0 6px 2px rgba(251,191,36,0.5)" : "0 0 6px 2px rgba(74,222,128,0.5)" }}
            />
            <span className="text-[11px] font-medium text-slate-300">
              {scanning ? "Scanning resume…" : "ATS Analysis Complete"}
            </span>
          </div>
          <span className="text-[10px] text-slate-600 font-mono">resume_v3.pdf</span>
        </div>

        {/* Score display */}
        <div className="px-5 py-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] text-slate-500 uppercase tracking-widest font-semibold mb-1">ATS Compatibility</p>
              <div className="flex items-baseline gap-1">
                <motion.span
                  key={score}
                  className="font-display text-4xl font-bold"
                  style={{ color: score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444" }}
                >
                  {score}
                </motion.span>
                <span className="text-slate-500 text-lg font-bold">/100</span>
              </div>
            </div>
            {/* Circle progress */}
            <div className="relative w-16 h-16">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="26" stroke="rgba(255,255,255,0.06)" strokeWidth="6" fill="none" />
                <motion.circle cx="32" cy="32" r="26" stroke="url(#scoreGrad)" strokeWidth="6" fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 26}`}
                  initial={{ strokeDashoffset: 2 * Math.PI * 26 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 26 * (1 - score / 100) }}
                  transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1], delay: 0.9 }}
                />
                <defs>
                  <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[9px] text-slate-400 font-bold">SCORE</span>
              </div>
            </div>
          </div>

          {/* Skill bars */}
          <div className="space-y-3">
            {SKILLS.map((s, i) => (
              <div key={s.name}>
                <div className="flex justify-between mb-1">
                  <span className="text-[11px] text-slate-400">{s.name}</span>
                  <span className="text-[11px] font-bold" style={{ color: s.color }}>{s.pct}%</span>
                </div>
                <ATSBar pct={s.pct} color={s.color} delay={1000 + i * 150} />
              </div>
            ))}
          </div>
        </div>

        {/* Scan line overlay during scanning */}
        <AnimatePresence>
          {scanning && (
            <motion.div key="scan"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl"
            >
              <motion.div
                animate={{ top: ["-4px", "100%"] }}
                transition={{ duration: 0.9, ease: "linear" }}
                className="absolute left-0 right-0 h-[2px] opacity-60"
                style={{ background: "linear-gradient(90deg, transparent, #06b6d4, transparent)" }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Cycling feedback pill */}
      <AnimatePresence mode="wait">
        {[FEEDBACK[feedbackIdx]].map((f) => (
          <motion.div key={feedbackIdx}
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm ${f.border} ${f.bg}`}
            style={{ backdropFilter: "blur(12px)" }}
          >
            <span className={`font-bold text-base ${f.color}`}>{f.icon}</span>
            <span className="text-slate-300 text-[12px]">{f.text}</span>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Mini company logos row */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}
        className="flex items-center gap-2"
      >
        <span className="text-[10px] text-slate-600 whitespace-nowrap">Top picks:</span>
        {["Google", "Meta", "Amazon", "Netflix", "Apple"].map((c, i) => (
          <motion.div key={c}
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.5 + i * 0.08 }}
            className="flex-1 rounded-lg border border-white/8 py-1.5 text-center text-[10px] font-bold text-slate-500"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            {c}
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

/* ─── Register page ──────────────────────────────────────────────────────── */
export default function Register() {
  const { register, verifySignupOtp, resendSignupOtp } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpStep, setOtpStep] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);

  useEffect(() => {
    if (!otpStep || otpCooldown <= 0) return;
    const timer = setInterval(() => setOtpCooldown((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [otpStep, otpCooldown]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setMessage(""); setLoading(true);
    try {
      if (!otpStep) {
        const data = await register(name, email, password);
        if (data?.requiresOtp) {
          setOtpStep(true);
          setOtpCooldown(OTP_RESEND_COOLDOWN_SECONDS);
          setMessage(data?.message || "OTP sent to your email. Enter it below.");
        } else {
          navigate("/dashboard", { replace: true });
        }
      } else {
        await verifySignupOtp(email, otp);
        navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Registration failed"));
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    setError(""); setMessage(""); setResendingOtp(true);
    try {
      const data = await resendSignupOtp(email);
      setOtpCooldown(OTP_RESEND_COOLDOWN_SECONDS);
      setMessage(data?.message || "OTP resent successfully.");
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to resend OTP"));
    } finally {
      setResendingOtp(false);
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex" style={{ background: "#020617" }}>
      {/* ── Left panel — ATS Resume visual ── */}
      <div className="hidden lg:flex flex-col w-[52%] relative overflow-hidden">
        {/* Rich gradient background — different from Login (more emerald/violet) */}
        <div className="absolute inset-0" style={{
          background: "linear-gradient(135deg, #020617 0%, #071220 40%, #0d1a0e 70%, #120a1e 100%)"
        }} />
        {/* Colour blobs */}
        <motion.div animate={{ scale: [1, 1.18, 1], opacity: [0.45, 0.75, 0.45] }} transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-60px] right-[-80px] w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(16,185,129,0.18) 0%, transparent 70%)" }} />
        <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0.65, 0.4] }} transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 3 }}
          className="absolute bottom-[-120px] left-[-60px] w-[460px] h-[460px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)" }} />
        <motion.div animate={{ x: [0, -18, 0], y: [0, 20, 0] }} transition={{ duration: 13, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
          className="absolute top-1/3 right-1/4 w-[280px] h-[280px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 70%)" }} />
        {/* Grid overlay */}
        <div className="absolute inset-0 bg-grid opacity-20 pointer-events-none" />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full p-10 xl:p-14">
          {/* Logo */}
          <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
            <Link to="/" className="inline-flex items-center gap-1" aria-label="HireMind home">
              <BrandLogo className="h-12 w-12 shrink-0" alt="" />
              <BrandWordmarkText className="font-display font-bold text-2xl text-white" />
            </Link>
          </motion.div>

          {/* Headline */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6 }}
            className="mt-10 mb-8"
          >
            <p className="text-xs text-emerald-400 font-semibold uppercase tracking-widest mb-3">AI Resume Analysis</p>
            <h2 className="font-display text-3xl xl:text-4xl font-bold text-white leading-tight">
              Beat the ATS.<br />
              <span className="bg-gradient-to-r from-emerald-300 via-cyan-400 to-brand-400 bg-clip-text text-transparent">Land the interview.</span>
            </h2>
            <p className="text-slate-400 text-sm mt-3 leading-relaxed max-w-xs">
              Get instant ATS scores, skill gap analysis, and personalised resume feedback powered by AI.
            </p>
          </motion.div>

          {/* ATS visual */}
          <div className="flex-1 flex items-center">
            <ResumeScene />
          </div>

          {/* Bottom tag */}
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
            className="text-xs text-slate-600 mt-6"
          >
            Join the top students already preparing smarter.
          </motion.p>
        </div>
      </div>

      {/* ── Right panel — white form card ── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-10 relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #0b1f18 0%, #0a1428 35%, #120828 65%, #0a1420 100%)" }}
      >
        {/* Grid */}
        <div className="absolute inset-0 bg-grid opacity-[0.12] pointer-events-none" />
        {/* Animated orbs — emerald theme for Register */}
        <div className="pointer-events-none absolute inset-0">
          <motion.div animate={{ scale: [1, 1.22, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-16 -right-16 w-72 h-72 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(16,185,129,0.2) 0%, transparent 70%)" }} />
          <motion.div animate={{ scale: [1, 1.18, 1], opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2.5 }}
            className="absolute -bottom-20 -left-12 w-80 h-80 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(6,182,212,0.18) 0%, transparent 70%)" }} />
          <motion.div animate={{ x: [0, -14, 0], y: [0, 14, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(139,92,246,0.09) 0%, transparent 60%)" }} />
          {/* Corner accents */}
          <div className="absolute top-0 right-0 w-40 h-40 opacity-20"
            style={{ background: "linear-gradient(225deg, rgba(16,185,129,0.45) 0%, transparent 60%)" }} />
          <div className="absolute bottom-0 left-0 w-40 h-40 opacity-20"
            style={{ background: "linear-gradient(45deg, rgba(6,182,212,0.35) 0%, transparent 60%)" }} />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md relative z-10"
        >
          {/* Mobile logo */}
          <div className="lg:hidden mb-7 text-center">
            <Link to="/" className="inline-flex items-center justify-center gap-1" aria-label="HireMind home">
              <BrandLogo className="h-12 w-12 shrink-0" alt="" />
              <BrandWordmarkText className="font-display font-bold text-2xl text-white inline-block" />
            </Link>
          </div>

          {/* White card */}
          <div className="bg-white rounded-3xl shadow-[0_24px_80px_rgba(0,0,0,0.5)] overflow-hidden">
            {/* Card gradient top bar — different from Login (emerald) */}
            <div className="h-1 bg-gradient-to-r from-emerald-400 via-cyan-500 to-brand-500" />

            <div className="px-8 py-9">
              <AnimatePresence mode="wait">
                {!otpStep ? (
                  <motion.div key="register-form"
                    initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="mb-7">
                      <h1 className="font-display text-2xl font-bold text-slate-900">Create account</h1>
                      <p className="text-slate-500 mt-1 text-sm">Free forever. Upgrade when you&apos;re ready.</p>
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

                      {[
                        { label: "Full name", type: "text", val: name, set: setName, placeholder: "Alex Johnson" },
                        { label: "Email", type: "email", val: email, set: setEmail, placeholder: "alex@email.com" },
                      ].map((f, i) => (
                        <motion.div key={f.label} custom={i} variants={fadeUp} initial="hidden" animate="show">
                          <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">{f.label}</label>
                          <input type={f.type} required value={f.val} onChange={(e) => f.set(e.target.value)} placeholder={f.placeholder}
                            className="w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all duration-200"
                          />
                        </motion.div>
                      ))}

                      <motion.div custom={2} variants={fadeUp} initial="hidden" animate="show">
                        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Password</label>
                        <div className="relative">
                          <input type={showPassword ? "text" : "password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                            className="w-full rounded-xl bg-slate-50 border border-slate-200 pl-4 pr-12 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all duration-200"
                          />
                          <button type="button" onClick={() => setShowPassword((v) => !v)}
                            className="absolute inset-y-0 right-0 px-4 text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <p className="text-xs text-slate-400 mt-1.5">At least 6 characters</p>
                      </motion.div>

                      <motion.div custom={3} variants={fadeUp} initial="hidden" animate="show">
                        <motion.button type="submit" disabled={loading}
                          whileHover={!loading ? { scale: 1.02 } : {}} whileTap={!loading ? { scale: 0.98 } : {}}
                          className="w-full font-semibold bg-gradient-to-r from-emerald-500 to-brand-500 disabled:opacity-50 text-white py-3.5 rounded-xl shadow-glow hover:shadow-glow-lg transition-shadow duration-200 text-sm"
                        >
                          <span>
                            {loading ? (
                              <span className="flex items-center justify-center gap-2">
                                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Creating account…
                              </span>
                            ) : "Create free account"}
                          </span>
                        </motion.button>
                      </motion.div>
                    </form>

                    <p className="text-center text-sm text-slate-500 mt-6">
                      Already have an account?{" "}
                      <Link to="/login" className="text-emerald-600 hover:text-emerald-700 font-semibold transition-colors">Sign in</Link>
                    </p>
                  </motion.div>
                ) : (
                  <motion.div key="otp-form"
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="mb-7">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center mb-5">
                        <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <h1 className="font-display text-2xl font-bold text-slate-900">Check your email</h1>
                      <p className="text-slate-500 mt-1.5 text-sm">
                        We sent a 6-digit code to <span className="text-slate-700 font-medium">{email}</span>
                      </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                      {(error || message) && (
                        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                          className={`rounded-xl border px-4 py-3 text-sm ${error ? "bg-red-50 border-red-200 text-red-600" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}
                        >
                          {error || message}
                        </motion.div>
                      )}

                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">6-digit OTP</label>
                        <input type="text" required maxLength={6} value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          className="w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-4 text-2xl text-slate-900 text-center tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all duration-200"
                          placeholder="······" autoFocus
                        />
                      </div>

                      <motion.button type="submit" disabled={loading || otp.length !== 6}
                        whileHover={!loading && otp.length === 6 ? { scale: 1.02 } : {}}
                        whileTap={!loading && otp.length === 6 ? { scale: 0.98 } : {}}
                        className="w-full font-semibold bg-gradient-to-r from-emerald-500 to-brand-500 disabled:opacity-50 text-white py-3.5 rounded-xl shadow-glow hover:shadow-glow-lg transition-shadow duration-200 text-sm"
                      >
                        {loading ? (
                          <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Verifying…
                          </span>
                        ) : "Verify & continue"}
                      </motion.button>

                      <button type="button" onClick={handleResendOtp}
                        disabled={resendingOtp || loading || otpCooldown > 0}
                        className="w-full border border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 disabled:opacity-40 py-3 rounded-xl text-sm transition-all duration-200"
                      >
                        {resendingOtp ? "Resending…" : otpCooldown > 0 ? `Resend in ${otpCooldown}s` : "Resend OTP"}
                      </button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useInView, useScroll, useTransform, AnimatePresence } from "framer-motion";
import {
  trackAiInterviewTryFreeClicked,
  trackResumeAnalysisTryFreeClicked,
} from "../utils/tryFreeAnalytics";

/* ─── Animation variants ─────────────────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const stagger = (delayChildren = 0.1) => ({
  hidden: {},
  show: { transition: { staggerChildren: delayChildren } },
});

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: [0.34, 1.56, 0.64, 1] } },
};

/* ─── Interview demo data ────────────────────────────────────────────────── */
const DEMO_ROUNDS = [
  {
    phase: "ai",
    question: "Hi Akshat! Could you briefly introduce yourself and walk me through your recent experience?",
  },
  {
    phase: "user",
    question: "Hi Akshat! Could you briefly introduce yourself and walk me through your recent experience?",
    transcript: "Sure! I'm a final-year CS student. I've built full-stack apps using the MERN stack and interned at a startup where I worked on a real-time data pipeline...",
  },
  {
    phase: "ai",
    question: "Nice! You mentioned a real-time pipeline — what was the biggest technical challenge you faced there?",
  },
  {
    phase: "user",
    question: "Nice! You mentioned a real-time pipeline — what was the biggest technical challenge you faced there?",
    transcript: "Handling backpressure when the event queue exceeded 50K messages per second. I solved it using a sliding-window buffer and exponential back-off...",
  },
  {
    phase: "ai",
    question: "Good. Can you walk me through how you'd design a URL shortener like bit.ly from scratch?",
  },
  {
    phase: "user",
    question: "Good. Can you walk me through how you'd design a URL shortener like bit.ly from scratch?",
    transcript: "I'd use a hash function like MD5 on the original URL, take the first 7 characters, store the mapping in a key-value store like Redis for fast reads...",
  },
  {
    phase: "ai",
    question: "Interesting approach. Tell me about a time you had a conflict with a teammate — how did you handle it?",
  },
  {
    phase: "user",
    question: "Interesting approach. Tell me about a time you had a conflict with a teammate — how did you handle it?",
    transcript: "During our capstone project, we disagreed on the architecture. I set up a quick sync, we listed pros and cons together and aligned on a shared decision...",
  },
  {
    phase: "ai",
    question: "That's a great example. Finally — why do you want to join Google specifically, over other top companies?",
  },
  {
    phase: "user",
    question: "That's a great example. Finally — why do you want to join Google specifically, over other top companies?",
    transcript: "Google's scale of impact is unmatched. I want to work on problems that touch billions of users, and the engineering culture here pushes me to grow faster...",
  },
];

/* ─── Animated audio visualizer orb ─────────────────────────────────────── */
function VisualizerOrb({ isListening }) {
  return (
    <div className="relative flex items-center justify-center w-28 h-28">
      {/* Outer pulsing rings */}
      {[1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full border ${
            isListening
              ? "border-emerald-400/30"
              : "border-brand-400/25"
          }`}
          style={{ width: 40 + i * 22, height: 40 + i * 22 }}
          animate={{
            scale: [1, 1.12 + i * 0.04, 1],
            opacity: [0.5, isListening ? 0.7 : 0.3, 0.5],
          }}
          transition={{
            duration: isListening ? 1.0 + i * 0.2 : 1.8 + i * 0.3,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.18,
          }}
        />
      ))}
      {/* Core orb */}
      <motion.div
        className={`w-14 h-14 rounded-full relative overflow-hidden ${
          isListening
            ? "bg-gradient-to-br from-emerald-500/80 to-cyan-500/80"
            : "bg-gradient-to-br from-brand-500/80 to-violet-600/80"
        }`}
        animate={{
          scale: isListening ? [1, 1.08, 1.04, 1.1, 1] : [1, 1.05, 1],
          boxShadow: isListening
            ? [
                "0 0 20px 4px rgba(52,211,153,0.35)",
                "0 0 35px 8px rgba(52,211,153,0.5)",
                "0 0 20px 4px rgba(52,211,153,0.35)",
              ]
            : [
                "0 0 20px 4px rgba(99,102,241,0.35)",
                "0 0 32px 8px rgba(99,102,241,0.5)",
                "0 0 20px 4px rgba(99,102,241,0.35)",
              ],
        }}
        transition={{ duration: isListening ? 0.8 : 1.6, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Inner shimmer */}
        <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent rounded-full" />
        {/* Sound bars inside orb */}
        <div className="absolute inset-0 flex items-center justify-center gap-[3px]">
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.div
              key={i}
              className="w-[3px] rounded-full bg-white/70"
              animate={{ height: isListening ? ["6px", `${10 + Math.random() * 16}px`, "6px"] : ["3px", "5px", "3px"] }}
              transition={{
                duration: isListening ? 0.4 + i * 0.08 : 0.9,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.07,
              }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Live-typing transcript text ────────────────────────────────────────── */
function TypedText({ text, active }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!active) { setShown(0); return; }
    setShown(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(i);
      if (i >= text.length) clearInterval(id);
    }, 42);
    return () => clearInterval(id);
  }, [text, active]);

  if (!active || shown === 0) return null;
  return (
    <motion.p
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-[11px] text-slate-400 italic text-center max-w-[85%] leading-relaxed"
    >
      &ldquo;{text.slice(0, shown)}{shown < text.length ? <span className="cursor-blink" /> : null}&rdquo;
    </motion.p>
  );
}

/* ─── Full interview demo card ───────────────────────────────────────────── */
const DEMO_START_SECONDS = 29 * 60 + 54; // 29:54

function formatTimer(secs) {
  const s = Math.max(0, secs);
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function HeroInterviewDemo() {
  const [roundIdx, setRoundIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DEMO_START_SECONDS);
  const round = DEMO_ROUNDS[roundIdx];
  const isAI = round.phase === "ai";

  // Live countdown — ticks every real second regardless of phase
  useEffect(() => {
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 0) { clearInterval(id); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Phase durations: AI speaking = 3.5s, user speaking = 7s (typing is ~24 chars/sec, longest answer ~155 chars)
  useEffect(() => {
    const dur = isAI ? 3500 : 7000;
    const t = setTimeout(() => {
      setRoundIdx((i) => {
        const next = (i + 1) % DEMO_ROUNDS.length;
        if (next === 0) setTimeLeft(DEMO_START_SECONDS);
        return next;
      });
    }, dur);
    return () => clearTimeout(t);
  }, [roundIdx, isAI]);

  return (
    <div className="glass rounded-3xl overflow-hidden shadow-glass-lg border border-white/8 select-none">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/6 bg-white/3">
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            className="w-2 h-2 rounded-full bg-emerald-400"
            style={{ boxShadow: "0 0 6px 2px rgba(74,222,128,0.5)" }}
          />
          <span className="text-[11px] font-medium text-slate-300">Recruiter Interview</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Volume icon */}
          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M12 6v12m-3.536-9.536a5 5 0 000 7.072M8.464 8.464a5 5 0 010 7.072" />
          </svg>
          {/* Timer */}
          <div className="flex items-center gap-1 text-amber-400">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <motion.span
              key={timeLeft}
              initial={{ opacity: 0.4 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
              className={`text-[11px] font-mono font-semibold tabular-nums ${timeLeft < 300 ? "text-red-400" : "text-amber-400"}`}
            >
              {formatTimer(timeLeft)}
            </motion.span>
          </div>
          {/* End button */}
          <div className="flex items-center gap-1 bg-red-600/80 text-white text-[10px] font-semibold px-2.5 py-1 rounded-lg">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
            </svg>
            End
          </div>
        </div>
      </div>

      {/* ── Main area ── */}
      <div className="bg-slate-950/70 flex flex-col items-center justify-center px-5 py-7 gap-4 min-h-[280px]">

        {/* Status label + question */}
        <div className="text-center max-w-[92%]">
          <AnimatePresence mode="wait">
            <motion.div
              key={`status-${roundIdx}`}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.3 }}
              className="flex items-center justify-center gap-1.5 mb-2"
            >
              {isAI ? (
                /* Bouncing sound bars — AI speaking */
                <span className="flex items-end gap-[3px]">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="w-[3px] rounded-full bg-brand-400 inline-block"
                      animate={{ height: ["8px", "14px", "8px"] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
                    />
                  ))}
                </span>
              ) : (
                /* Mic dot — user speaking */
                <motion.span
                  animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 0.9, repeat: Infinity }}
                  className="w-2 h-2 rounded-full bg-emerald-400 inline-block"
                  style={{ boxShadow: "0 0 6px 2px rgba(52,211,153,0.5)" }}
                />
              )}
              <span className={`text-[11px] font-medium ${isAI ? "text-brand-400" : "text-emerald-400"}`}>
                {isAI ? "Interviewer is speaking..." : "The interviewer asks..."}
              </span>
            </motion.div>
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.p
              key={`q-${roundIdx}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="text-[13px] sm:text-sm font-semibold text-white leading-snug"
            >
              {round.question}
            </motion.p>
          </AnimatePresence>

          {!isAI && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-1.5 text-[10px] text-slate-500 underline underline-offset-2"
            >
              🔊 Replay question
            </motion.button>
          )}
        </div>

        {/* Orb */}
        <VisualizerOrb isListening={!isAI} />

        {/* Listening / AI speaking pill */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`pill-${roundIdx}`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold border ${
              isAI
                ? "bg-slate-800/80 border-slate-700/60 text-slate-300"
                : "bg-emerald-600/15 border-emerald-500/35 text-emerald-300"
            }`}
          >
            {isAI ? (
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M12 6v12m-3.536-9.536a5 5 0 000 7.072" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            )}
            {isAI ? "AI speaking..." : "Listening..."}
          </motion.div>
        </AnimatePresence>

        {/* Live transcript text while user speaks */}
        <TypedText text={round.transcript ?? ""} active={!isAI} />
      </div>

      {/* ── Transcript drawer footer ── */}
      <div className="border-t border-white/6 flex items-center justify-center gap-2 py-2.5 text-[11px] text-slate-500">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        Transcript
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}

/* ─── Mobile hero visual — compact interview status cards (sm screens only) ─ */
function MobileHeroVisual() {
  const [phase, setPhase] = useState(0); // 0 = AI speaking, 1 = Listening
  const [timeLeft, setTimeLeft] = useState(DEMO_START_SECONDS - 42); // starts slightly later than desktop card

  useEffect(() => {
    const t = setInterval(() => setPhase((p) => 1 - p), 2800);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="mt-8 sm:hidden"
    >
      {/* Mini interview card */}
      <div className="glass rounded-2xl overflow-hidden border border-white/8">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/6 bg-white/3">
          <div className="flex items-center gap-1.5">
            <motion.div
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.8, repeat: Infinity }}
              className="w-1.5 h-1.5 rounded-full bg-emerald-400"
            />
            <span className="text-[10px] text-slate-400 font-medium">Recruiter Interview</span>
          </div>
          <div className="flex items-center gap-1 text-amber-400">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span className="text-[10px] font-mono font-semibold tabular-nums">{formatTimer(timeLeft)}</span>
          </div>
        </div>

        {/* Status row */}
        <div className="px-4 py-4 flex items-center gap-4">
          {/* Mini orb */}
          <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
            <motion.div
              className={`w-10 h-10 rounded-full ${phase === 0 ? "bg-gradient-to-br from-brand-500/70 to-violet-600/70" : "bg-gradient-to-br from-emerald-500/70 to-cyan-500/70"}`}
              animate={{ scale: [1, 1.08, 1], boxShadow: phase === 0
                ? ["0 0 12px 3px rgba(99,102,241,0.4)", "0 0 22px 6px rgba(99,102,241,0.55)", "0 0 12px 3px rgba(99,102,241,0.4)"]
                : ["0 0 12px 3px rgba(52,211,153,0.4)", "0 0 22px 6px rgba(52,211,153,0.55)", "0 0 12px 3px rgba(52,211,153,0.4)"]
              }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="absolute inset-0 flex items-center justify-center gap-[2px]">
                {[0, 1, 2].map((i) => (
                  <motion.div key={i} className="w-[2.5px] rounded-full bg-white/70"
                    animate={{ height: phase === 0 ? ["4px", "10px", "4px"] : ["5px", "13px", "5px"] }}
                    transition={{ duration: phase === 0 ? 0.8 : 0.5, repeat: Infinity, delay: i * 0.1, ease: "easeInOut" }}
                  />
                ))}
              </div>
            </motion.div>
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.p
                key={phase}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25 }}
                className={`text-[10px] font-semibold mb-1 ${phase === 0 ? "text-brand-400" : "text-emerald-400"}`}
              >
                {phase === 0 ? "Interviewer is speaking..." : "Listening to your answer..."}
              </motion.p>
            </AnimatePresence>
            <p className="text-xs text-white font-medium leading-snug line-clamp-2">
              {phase === 0
                ? "Tell me about a challenging project you've worked on."
                : "At my internship, I built a real-time data pipeline..."}
            </p>
          </div>
        </div>

        {/* Pill */}
        <div className="px-4 pb-4 flex justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={`pill-${phase}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold border ${
                phase === 0
                  ? "bg-slate-800/60 border-slate-700/50 text-slate-400"
                  : "bg-emerald-600/12 border-emerald-500/30 text-emerald-300"
              }`}
            >
              {phase === 0
                ? <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M12 6v12" /></svg>
                : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
              }
              {phase === 0 ? "AI speaking..." : "Listening..."}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Mini stat badges below the card */}
      <div className="grid grid-cols-2 gap-2 mt-3">
        {[
          { label: "ATS Score", value: "87/100", color: "text-emerald-400", bg: "border-emerald-500/18 bg-emerald-500/6" },
          { label: "Interview score", value: "9.2/10", color: "text-violet-400", bg: "border-violet-500/18 bg-violet-500/6" },
        ].map((s) => (
          <div key={s.label} className={`glass rounded-xl px-3 py-2.5 border ${s.bg} text-center`}>
            <p className={`font-display font-bold text-base ${s.color}`}>{s.value}</p>
            <p className="text-[9px] text-slate-600 uppercase tracking-wide mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ─── Feature cards data ──────────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>),
    title: "Resume Analyzer",
    desc: "ATS scoring, missing skills, and bullet-level improvements against real JDs.",
    color: "from-cyan-500/15 to-transparent",
    accent: "text-cyan-400", iconBg: "bg-cyan-500/15 border-cyan-500/20",
    border: "hover:border-cyan-500/30",
  },
  {
    icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>),
    title: "Voice Interview",
    desc: "AI voice interviews in recruiter or pressure mode with scoring and reports.",
    color: "from-violet-500/15 to-transparent",
    accent: "text-violet-400", iconBg: "bg-violet-500/15 border-violet-500/20",
    border: "hover:border-violet-500/30",
  },
  {
    icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>),
    title: "Question Generator",
    desc: "Technical, behavioral, and HR questions tailored to your resume and role.",
    color: "from-amber-500/15 to-transparent",
    accent: "text-amber-400", iconBg: "bg-amber-500/15 border-amber-500/20",
    border: "hover:border-amber-500/30",
  },
  {
    icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>),
    title: "Application Tracker",
    desc: "Track companies, roles, statuses, and notes — your job hunt in one place.",
    color: "from-emerald-500/15 to-transparent",
    accent: "text-emerald-400", iconBg: "bg-emerald-500/15 border-emerald-500/20",
    border: "hover:border-emerald-500/30",
  },
];

const STATS = [
  { value: "500+", label: "Sessions" },
  { value: "94%", label: "Satisfaction" },
  { value: "3 min", label: "Free trial" },
  { value: "∞", label: "Practice" },
];

/* ─── Reusable fade-in-on-scroll section ─────────────────────────────────── */
function FadeSection({ children, className = "" }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px 0px" });
  return (
    <motion.div ref={ref} initial="hidden" animate={inView ? "show" : "hidden"} className={className}>
      {children}
    </motion.div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */
export default function Landing() {
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 60]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <div className="min-h-screen bg-chromatic bg-grid relative overflow-hidden">

      {/* Ambient orbs — pointer-events-none so they never block taps */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <motion.div
          animate={{ x: [0, 25, 0], y: [0, -18, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-32 -left-32 w-[400px] h-[400px] rounded-full bg-cyan-500/10 blur-[80px]"
        />
        <motion.div
          animate={{ x: [0, -20, 0], y: [0, 22, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute top-10 right-0 w-[380px] h-[380px] rounded-full bg-fuchsia-500/10 blur-[80px]"
        />
        <motion.div
          animate={{ x: [0, 16, 0], y: [0, 12, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 4 }}
          className="absolute bottom-0 left-1/3 w-[350px] h-[350px] rounded-full bg-violet-500/8 blur-[80px]"
        />
      </div>

      {/* ── Navbar ─────────────────────────────────────────── */}
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="sticky top-0 z-50 border-b border-white/5 bg-surface-900/75 backdrop-blur-xl"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          <motion.span
            whileHover={{ scale: 1.04 }}
            className="font-display font-bold text-xl text-white cursor-default select-none shrink-0"
          >
            Hire<span className="bg-gradient-to-r from-cyan-300 via-brand-400 to-fuchsia-400 bg-clip-text text-transparent">Mind</span>
          </motion.span>

          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="text-sm font-medium text-slate-400 hover:text-white px-3 sm:px-4 py-2 rounded-xl hover:bg-white/5 transition-all duration-200 whitespace-nowrap"
            >
              Log in
            </Link>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
              <Link
                to="/register"
                className="text-xs sm:text-sm font-semibold bg-gradient-to-r from-brand-500 to-fuchsia-500 text-white px-3.5 sm:px-5 py-2 rounded-xl shadow-glow transition-shadow duration-300 inline-block whitespace-nowrap"
              >
                <span className="hidden sm:inline">Get started free</span>
                <span className="sm:hidden">Sign up</span>
              </Link>
            </motion.div>
          </div>
        </div>
      </motion.header>

      {/* ── Hero ───────────────────────────────────────────── */}
      <motion.section
        ref={heroRef}
        style={{ y: heroY, opacity: heroOpacity }}
        className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-12 md:pt-24 md:pb-20"
      >
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">

          {/* Left — copy */}
          <motion.div variants={stagger(0.1)} initial="hidden" animate="show">
            <motion.div variants={fadeUp}>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-[11px] font-semibold uppercase tracking-wider mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" style={{ boxShadow: "0 0 6px 2px rgba(34,211,238,0.5)", animation: "pulseGlow 2s ease-in-out infinite" }} />
                AI-powered career prep
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="font-display text-[2.2rem] sm:text-5xl md:text-[3.4rem] lg:text-[3.8rem] xl:text-[68px] font-bold text-white leading-[1.1] tracking-tight"
            >
              Land Your{" "}
              <span className="relative inline-block">
                <span className="text-gradient">Dream Job</span>
                <motion.span
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute -bottom-1 left-0 right-0 h-px bg-gradient-to-r from-cyan-400/0 via-cyan-400/80 to-cyan-400/0 origin-left"
                />
              </span>
              <br />With{" "}
              <span className="bg-gradient-to-r from-cyan-300 via-brand-400 to-fuchsia-400 bg-clip-text text-transparent">HireMind</span>{" "}AI
            </motion.h1>

            <motion.p variants={fadeUp} className="mt-5 text-base sm:text-lg text-slate-400 leading-relaxed max-w-xl">
              Practice real interviews with HireMind AI that adapts to your resume, role, and target company — Get ATS feedback on your resume before you even apply.
            </motion.p>

            {/* CTAs — stack on mobile, row on sm+ */}
            <motion.div variants={fadeUp} className="mt-8 flex flex-col sm:flex-row gap-3">
              <motion.div whileTap={{ scale: 0.97 }} whileHover={{ scale: 1.03 }} className="w-full sm:w-auto">
                <Link
                  to="/resume"
                  onClick={trackResumeAnalysisTryFreeClicked}
                  className="flex items-center justify-center gap-2 font-semibold bg-gradient-to-r from-brand-500 to-fuchsia-500 text-white px-6 py-3.5 rounded-2xl shadow-glow hover:shadow-glow-lg transition-shadow duration-300 text-sm w-full sm:w-auto"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  Analyze my resume free
                </Link>
              </motion.div>
              <motion.div whileTap={{ scale: 0.97 }} whileHover={{ scale: 1.03 }} className="w-full sm:w-auto">
                <Link
                  to="/interview"
                  onClick={trackAiInterviewTryFreeClicked}
                  className="flex items-center justify-center gap-2 font-semibold border border-white/15 text-slate-200 hover:border-white/30 hover:bg-white/5 px-6 py-3.5 rounded-2xl transition-all duration-200 text-sm w-full sm:w-auto backdrop-blur-sm active:bg-white/8"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                  Try AI interview free
                </Link>
              </motion.div>
            </motion.div>

            <motion.p variants={fadeUp} className="mt-4 text-xs text-slate-600">
             No credits required · 1 free resume analysis · 3-min free AI interview
            </motion.p>

            {/* Mobile-only visual (2×2 stats grid) */}
            <MobileHeroVisual />
          </motion.div>

          {/* Right — actual interview UI demo (sm+) */}
          <motion.div
            initial={{ opacity: 0, x: 36, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative hidden sm:block"
          >
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
              className="relative"
            >
              <HeroInterviewDemo />

              {/* Floating score badge */}
              <motion.div
                animate={{ y: [0, -7, 0] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute -bottom-4 -left-7 glass rounded-2xl px-3.5 py-2.5 border border-emerald-500/25 shadow-glass"
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-white">ATS Score</p>
                    <p className="text-xs text-emerald-400 font-bold">87 / 100</p>
                  </div>
                </div>
              </motion.div>

              {/* Floating interview score */}
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                className="absolute -top-4 -right-6 glass rounded-2xl px-3.5 py-2.5 border border-violet-500/25 shadow-glass"
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-violet-500/15 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-white">Interview</p>
                    <p className="text-xs text-violet-400 font-bold">92 / 100</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </motion.section>

      {/* ── Stats strip ─────────────────────────────────────── */}
      <FadeSection>
        <motion.div variants={stagger(0.07)} className="max-w-6xl mx-auto px-4 sm:px-6 pb-12 md:pb-16">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {STATS.map((s) => (
              <motion.div
                key={s.label}
                variants={scaleIn}
                className="glass rounded-2xl px-4 py-4 text-center border border-white/6 hover:border-white/12 transition-colors duration-200"
              >
                <p className="font-display text-2xl sm:text-3xl font-bold text-gradient mb-0.5">{s.value}</p>
                <p className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-wider">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </FadeSection>

      {/* ── Features ────────────────────────────────────────── */}
      <FadeSection className="max-w-6xl mx-auto px-4 sm:px-6 pb-16 md:pb-24">
        <motion.div variants={fadeUp} className="text-center mb-10 sm:mb-14">
          <p className="text-cyan-400 text-xs font-semibold uppercase tracking-widest mb-3">Everything you need</p>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-white">
            Your complete <span className="text-gradient-warm">prep toolkit</span>
          </h2>
          <p className="mt-3 text-slate-400 text-base max-w-xl mx-auto">
            From resume to offer — HireMind covers every step of your job search.
          </p>
        </motion.div>

        <motion.div variants={stagger(0.08)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f) => (
            <motion.div
              key={f.title}
              variants={fadeUp}
              whileHover={{ y: -5, transition: { duration: 0.28, ease: [0.34, 1.56, 0.64, 1] } }}
              className={`group relative rounded-3xl overflow-hidden border border-white/8 bg-gradient-to-br ${f.color} p-5 transition-all duration-300 ${f.border} active:scale-[0.98]`}
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400 bg-gradient-to-br from-white/3 to-transparent rounded-3xl pointer-events-none" />
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-4 ${f.iconBg} ${f.accent}`}>
                {f.icon}
              </div>
              <h3 className="font-display font-semibold text-white text-base mb-2">{f.title}</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </FadeSection>

      {/* ── How it works ────────────────────────────────────── */}
      <FadeSection className="max-w-6xl mx-auto px-4 sm:px-6 pb-16 md:pb-28">
        <motion.div variants={fadeUp} className="text-center mb-10 sm:mb-14">
          <p className="text-fuchsia-400 text-xs font-semibold uppercase tracking-widest mb-3">Simple process</p>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-white">
            From upload to <span className="text-gradient">offer-ready</span>
          </h2>
        </motion.div>

        <motion.div variants={stagger(0.1)} className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          {[
            { step: "01", title: "Upload your resume", desc: "Drop your PDF — HireMind parses it and extracts your skills and experience instantly.", color: "text-cyan-400", bg: "bg-cyan-400/10 border-cyan-400/25" },
            { step: "02", title: "Start the AI interview", desc: "Choose your company and role. The AI adapts questions to your background in real time.", color: "text-violet-400", bg: "bg-violet-400/10 border-violet-400/25" },
            { step: "03", title: "Get your report", desc: "Receive a detailed scorecard — ATS rating, interview performance, and next steps.", color: "text-fuchsia-400", bg: "bg-fuchsia-400/10 border-fuchsia-400/25" },
          ].map((s) => (
            <motion.div
              key={s.step}
              variants={fadeUp}
              whileHover={{ y: -4 }}
              className="glass rounded-3xl p-6 border border-white/8 hover:border-white/15 transition-all duration-300 active:scale-[0.99]"
            >
              <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl border text-sm font-bold font-mono mb-4 ${s.bg} ${s.color}`}>
                {s.step}
              </div>
              <h3 className="font-display font-semibold text-white text-lg mb-2">{s.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </FadeSection>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <FadeSection className="max-w-6xl mx-auto px-4 sm:px-6 pb-16 md:pb-28">
        <motion.div
          variants={scaleIn}
          className="relative rounded-3xl overflow-hidden border border-white/10 p-8 sm:p-12 md:p-16 text-center"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-brand-500/15 via-violet-500/10 to-fuchsia-500/15" />
          <div className="absolute inset-0 bg-grid opacity-40" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-32 bg-gradient-to-b from-cyan-500/20 to-transparent blur-3xl" />

          <div className="relative z-10">
            <motion.p variants={fadeUp} className="text-cyan-400 text-xs font-semibold uppercase tracking-widest mb-4">
              Start for free today
            </motion.p>
            <motion.h2 variants={fadeUp} className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
              Your next offer starts here
            </motion.h2>
            <motion.p variants={fadeUp} className="text-slate-300 text-base sm:text-lg mb-8 max-w-lg mx-auto">
              No extra credits needed. Get 1 free resume analysis and a 3-minute AI mock interview now.
            </motion.p>

            {/* Stack on mobile, row on sm+ */}
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} className="w-full sm:w-auto">
                <Link
                  to="/register"
                  className="flex items-center justify-center gap-2 font-semibold bg-gradient-to-r from-brand-400 to-fuchsia-400 text-white px-7 py-4 rounded-2xl shadow-glow-lg transition-shadow duration-300 text-sm w-full sm:w-auto"
                >
                  Create free account
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="w-full sm:w-auto">
                <Link
                  to="/interview"
                  onClick={trackAiInterviewTryFreeClicked}
                  className="flex items-center justify-center gap-2 font-semibold border border-white/20 text-white hover:bg-white/8 active:bg-white/12 px-7 py-4 rounded-2xl transition-all duration-200 text-sm w-full sm:w-auto backdrop-blur-sm"
                >
                  Try without sign up
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      </FadeSection>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-white/5 bg-surface-900/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <span className="font-display font-bold text-lg text-white select-none">
            Hire<span className="bg-gradient-to-r from-cyan-300 via-brand-400 to-fuchsia-400 bg-clip-text text-transparent">Mind</span>
          </span>
          <div className="flex items-center gap-5 text-sm text-slate-500 flex-wrap justify-center">
            <Link to="/resume" className="hover:text-slate-300 transition-colors py-1">Resume Analyzer</Link>
            <Link to="/interview" className="hover:text-slate-300 transition-colors py-1">AI Interview</Link>
            <Link to="/login" className="hover:text-slate-300 transition-colors py-1">Sign in</Link>
          </div>
          <p className="text-xs text-slate-600">© {new Date().getFullYear()} HireMind</p>
        </div>
      </footer>
    </div>
  );
}

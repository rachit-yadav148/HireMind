import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import { api } from "../services/api";
import { FileSearch, Mic, ListChecks, Briefcase } from "../components/Icons";
import DashboardCreditCard from "../components/DashboardCreditCard";
import { useAuth } from "../context/AuthContext";

/* ─── Animation variants ─────────────────────────────────────────────────── */
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

/* ─── Animated count-up number ───────────────────────────────────────────── */
function CountUp({ value }) {
  const [displayed, setDisplayed] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    const target = Number(value) || 0;
    if (target === 0) { setDisplayed(0); return; }
    let start = 0;
    const step = Math.ceil(target / 30);
    const id = setInterval(() => {
      start += step;
      if (start >= target) { setDisplayed(target); clearInterval(id); }
      else setDisplayed(start);
    }, 30);
    return () => clearInterval(id);
  }, [inView, value]);

  return <span ref={ref}>{displayed}</span>;
}

/* ─── Feature cards data ─────────────────────────────────────────────────── */
const cards = [
  {
    to: "/dashboard/resume",
    title: "Resume Analyzer",
    desc: "Upload a PDF and get ATS insights, missing skills, and bullet-level improvements.",
    icon: FileSearch,
    gradient: "from-cyan-500/20 via-brand-500/8 to-transparent",
    iconBg: "bg-cyan-500/15 border-cyan-500/25 text-cyan-400",
    hoverBorder: "hover:border-cyan-500/35",
    hoverGlow: "hover:shadow-glow-cyan",
    badge: "Resume",
    badgeColor: "bg-cyan-500/15 text-cyan-300 border-cyan-500/25",
  },
  {
    to: "/dashboard/interview",
    title: "AI Interview Simulator",
    desc: "Voice mock interview with an adaptive AI — recruiter or pressure mode with full report.",
    icon: Mic,
    gradient: "from-violet-500/20 via-fuchsia-500/8 to-transparent",
    iconBg: "bg-violet-500/15 border-violet-500/25 text-violet-400",
    hoverBorder: "hover:border-violet-500/35",
    hoverGlow: "hover:shadow-glow-violet",
    badge: "Interview",
    badgeColor: "bg-violet-500/15 text-violet-300 border-violet-500/25",
  },
  {
    to: "/dashboard/questions",
    title: "Question Generator",
    desc: "Technical, behavioral, and HR questions tailored to your resume and target role.",
    icon: ListChecks,
    gradient: "from-amber-500/20 via-orange-500/8 to-transparent",
    iconBg: "bg-amber-500/15 border-amber-500/25 text-amber-400",
    hoverBorder: "hover:border-amber-500/35",
    hoverGlow: "hover:shadow-[0_0_40px_-10px_rgba(245,158,11,0.35)]",
    badge: "Questions",
    badgeColor: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  },
  {
    to: "/dashboard/applications",
    title: "Application Tracker",
    desc: "Track applications, interviews, and offers — your job hunt in one organized place.",
    icon: Briefcase,
    gradient: "from-emerald-500/20 via-teal-500/8 to-transparent",
    iconBg: "bg-emerald-500/15 border-emerald-500/25 text-emerald-400",
    hoverBorder: "hover:border-emerald-500/35",
    hoverGlow: "hover:shadow-[0_0_40px_-10px_rgba(16,185,129,0.35)]",
    badge: "Tracker",
    badgeColor: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  },
];

/* ─── Main component ─────────────────────────────────────────────────────── */
export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get("/analytics")
      .then((res) => setStats(res.data))
      .catch(() => setErr("Could not load analytics"));
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="min-w-0"
    >
      {/* Header */}
      <motion.div variants={item} className="mb-8">
        <p className="text-sm text-slate-500 mb-1">{greeting()},</p>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
          {user?.name?.split(" ")[0] || "there"} 👋
        </h1>
        <p className="text-slate-500 mt-1 text-sm">Ready to prep? Your AI career coach is standing by.</p>
      </motion.div>

      {err && (
        <motion.p variants={item} className="text-amber-400/90 text-sm mb-5 px-3 py-2 rounded-xl bg-amber-500/8 border border-amber-500/20">
          {err}
        </motion.p>
      )}

      {/* Credit card */}
      <motion.div variants={item} className="mb-7">
        <DashboardCreditCard />
      </motion.div>

      {/* Stats row */}
      {stats && (
        <motion.div
          variants={container}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-7"
        >
          {[
            { label: "Resumes analyzed", value: stats.resumesAnalyzed, icon: "📄", color: "text-cyan-400", dot: "#22d3ee" },
            { label: "Interviews completed", value: stats.interviewsCompleted, icon: "🎙️", color: "text-violet-400", dot: "#a78bfa" },
            { label: "Question banks", value: stats.questionsGenerated, icon: "❓", color: "text-amber-400", dot: "#fbbf24" },
          ].map((s) => (
            <motion.div
              key={s.label}
              variants={item}
              whileHover={{ y: -3, transition: { duration: 0.25, ease: [0.34, 1.56, 0.64, 1] } }}
              className="rounded-2xl border border-white/8 bg-white/3 px-5 py-5 backdrop-blur-sm hover:border-white/15 hover:bg-white/5 transition-colors duration-200"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-2xl">{s.icon}</span>
                <div className="w-2 h-2 rounded-full opacity-70" style={{ backgroundColor: s.dot }} />
              </div>
              <p className={`text-3xl font-bold font-display tabular-nums ${s.color}`}>
                <CountUp value={s.value} />
              </p>
              <p className="text-xs text-slate-500 uppercase tracking-wide mt-1.5">{s.label}</p>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Feature cards */}
      <motion.div
        variants={container}
        className="grid md:grid-cols-2 gap-4"
      >
        {cards.map((c) => (
          <motion.div
            key={c.to}
            variants={item}
            whileHover={{
              y: -5,
              transition: { duration: 0.3, ease: [0.34, 1.56, 0.64, 1] },
            }}
          >
            <Link
              to={c.to}
              className={`group relative flex items-start gap-4 rounded-2xl border border-white/8 bg-gradient-to-br ${c.gradient} p-5 sm:p-6 transition-all duration-300 min-w-0 block ${c.hoverBorder} ${c.hoverGlow}`}
            >
              {/* Hover inner glow */}
              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-400 bg-gradient-to-br from-white/2 to-transparent pointer-events-none" />

              <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${c.iconBg} transition-transform duration-300 group-hover:scale-110`}>
                <c.icon className="w-5 h-5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <h2 className="font-display font-semibold text-base text-white group-hover:text-white/90 transition-colors">
                    {c.title}
                  </h2>
                  <span className={`hidden sm:inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full border ${c.badgeColor} uppercase tracking-wide`}>
                    {c.badge}
                  </span>
                </div>
                <p className="text-sm text-slate-500 leading-relaxed">{c.desc}</p>
              </div>

              {/* Arrow — always visible on touch, animated on hover for pointer devices */}
              <div className="shrink-0 w-7 h-7 rounded-full border border-white/10 flex items-center justify-center self-center opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300 md:opacity-0 md:group-hover:opacity-100">
                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
            </Link>
          </motion.div>
        ))}
      </motion.div>

      {/* Quick tip footer */}
      <motion.div
        variants={item}
        className="mt-6 rounded-2xl border border-brand-500/15 bg-brand-500/5 px-5 py-4 flex items-start gap-3"
      >
        <div className="w-8 h-8 rounded-xl bg-brand-500/15 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-brand-300">Pro tip</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Upload your resume first — then start an AI interview tailored to your specific experience.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

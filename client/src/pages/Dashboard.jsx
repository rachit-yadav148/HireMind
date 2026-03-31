import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import { FileSearch, Mic, ListChecks, Briefcase } from "../components/Icons";

const cards = [
  {
    to: "/dashboard/resume",
    title: "Resume Analyzer",
    desc: "Upload a PDF and get ATS insights and improvements.",
    icon: FileSearch,
    color: "from-sky-500/20 to-cyan-500/10",
  },
  {
    to: "/dashboard/interview",
    title: "AI Interview Simulator",
    desc: "Voice mock interview with real-time feedback.",
    icon: Mic,
    color: "from-violet-500/20 to-fuchsia-500/10",
  },
  {
    to: "/dashboard/questions",
    title: "Question Generator",
    desc: "Technical, behavioral, and HR questions for any role.",
    icon: ListChecks,
    color: "from-amber-500/20 to-orange-500/10",
  },
  {
    to: "/dashboard/applications",
    title: "Application Tracker",
    desc: "Track applications, interviews, and offers.",
    icon: Briefcase,
    color: "from-emerald-500/20 to-teal-500/10",
  },
];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api
      .get("/analytics")
      .then((res) => setStats(res.data))
      .catch(() => setErr("Could not load analytics"));
  }, []);

  return (
    <div>
      <div className="mb-10">
        <h1 className="font-display text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 mt-1">Your AI career prep hub</p>
      </div>

      {err && (
        <p className="text-amber-400/90 text-sm mb-4">{err}</p>
      )}

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {[
            { label: "Resumes analyzed", value: stats.resumesAnalyzed },
            { label: "Interviews completed", value: stats.interviewsCompleted },
            { label: "Question banks generated", value: stats.questionsGenerated },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-slate-800 bg-slate-900/50 px-5 py-4"
            >
              <p className="text-2xl font-bold text-white tabular-nums">{s.value}</p>
              <p className="text-xs text-slate-500 uppercase tracking-wide mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-5">
        {cards.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className={`group rounded-2xl border border-slate-800 bg-gradient-to-br ${c.color} p-6 hover:border-brand-500/40 transition-all shadow-card`}
          >
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-slate-950/50 p-3 text-brand-400 border border-slate-700/80">
                <c.icon className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-display font-semibold text-lg text-white group-hover:text-brand-200 transition-colors">
                  {c.title}
                </h2>
                <p className="text-sm text-slate-400 mt-1 leading-relaxed">{c.desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="min-h-screen bg-chromatic relative overflow-hidden">
      <div className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 bg-cyan-400/20 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute top-20 right-0 w-80 h-80 bg-fuchsia-500/20 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl" />

      <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="font-display font-bold text-xl text-white">
            Hire
            <span className="bg-gradient-to-r from-cyan-300 via-brand-400 to-fuchsia-400 bg-clip-text text-transparent">
              Mind
            </span>
          </span>
          <div className="flex gap-3">
            <Link
              to="/login"
              className="text-sm font-medium text-slate-300 hover:text-white px-3 py-2 rounded-lg hover:bg-slate-800/50 transition-colors"
            >
              Log in
            </Link>
            <Link
              to="/register"
              className="text-sm font-semibold bg-gradient-to-r from-brand-500 to-fuchsia-500 hover:from-brand-400 hover:to-fuchsia-400 text-white px-4 py-2 rounded-lg shadow-glow transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-20 pb-24 md:pt-28 md:pb-32">
        <div className="max-w-2xl">
          <p className="text-cyan-300 font-semibold text-sm uppercase tracking-wider mb-4">
            AI-powered career prep
          </p>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight">
            Prepare for internships &amp; jobs with confidence
          </h1>
          <p className="mt-6 text-lg text-slate-400 leading-relaxed">
            HireMind analyzes your resume, runs voice mock interviews, generates targeted question banks,
            and tracks every application — powered by advanced AI.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              to="/register"
              className="inline-flex items-center justify-center font-semibold bg-gradient-to-r from-brand-500 to-fuchsia-500 hover:from-brand-400 hover:to-fuchsia-400 text-white px-6 py-3 rounded-xl shadow-glow transition-colors"
            >
              Create free account
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center font-semibold border border-slate-600 text-slate-200 hover:bg-slate-800/80 px-6 py-3 rounded-xl transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>

        <div className="mt-20 grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              title: "Resume Analyzer",
              desc: "ATS-style scoring, weaknesses, and bullet-level improvements from your Resume.",
            },
            {
              title: "Voice Interview",
              desc: "Personalized voice interview questions based on your resume and job description, with staged feedback.",
            },
            {
              title: "Question Generator",
              desc: "Personalized technical, behavioral, and HR questions aligned with your resume skills and target job description.",
            },
            {
              title: "Application Tracker",
              desc: "Keep companies, roles, and statuses in one place with notes.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-slate-800 bg-slate-900/45 backdrop-blur-sm p-6 shadow-card hover:border-fuchsia-500/40 hover:bg-slate-900/60 transition-all"
            >
              <h3 className="font-display font-semibold text-white text-lg">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

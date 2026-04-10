export default function FounderSection() {
  return (
    <section className="max-w-6xl mx-auto px-6 pb-20">
      <h2 className="text-center font-display text-2xl md:text-3xl font-bold text-white">Built by</h2>
      <div className="mt-6 flex justify-center">
        <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900/50 p-6 md:p-8 text-center shadow-card">
          <div className="mx-auto h-16 w-16 rounded-full border border-slate-700 bg-gradient-to-br from-brand-500/30 to-cyan-400/20" />
          <h3 className="mt-4 font-display text-2xl font-semibold text-white">Rachit Yadav</h3>
          <p className="mt-2 text-slate-300">Undergraduate Student, National Institute of Technology (NIT) Allahabad</p>
          <p className="text-slate-400 text-sm mt-1">Batch: 2022–2026</p>
          <p className="mt-4 text-slate-300">AI product builder focused on helping students prepare for real interviews using intelligent tools.</p>
          <p className="mt-2 text-slate-400">Creator of HireMind — an AI-powered platform for resume analysis, mock interviews, and application tracking.</p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <a
              href="https://www.linkedin.com/in/rachit-yadav-mnnit"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center font-semibold border border-slate-600 text-slate-200 hover:bg-slate-800/80 px-5 py-2.5 rounded-xl"
            >
              LinkedIn
            </a>
            <a
              href="https://github.com/rachit-yadav148"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center font-semibold bg-gradient-to-r from-brand-500 to-fuchsia-500 hover:from-brand-400 hover:to-fuchsia-400 text-white px-5 py-2.5 rounded-xl"
            >
              GitHub
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

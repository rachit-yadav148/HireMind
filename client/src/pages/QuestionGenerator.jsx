import { useState } from "react";
import { api } from "../services/api";

const difficultyColors = {
  easy: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  medium: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  hard: "bg-red-500/15 text-red-300 border-red-500/30",
};

export default function QuestionGenerator() {
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [jdFile, setJdFile] = useState(null);
  const [resumeFile, setResumeFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [bank, setBank] = useState(null);

  async function handleGenerate(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setBank(null);
    try {
      const fd = new FormData();
      fd.append("company", company);
      fd.append("role", role);
      if (jdFile) fd.append("jobDescription", jdFile);
      if (resumeFile) fd.append("resume", resumeFile);

      const { data } = await api.post("/questions/generate", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setBank(data);
    } catch (err) {
      setError(err.response?.data?.message || "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-white">Interview Question Generator</h1>
        <p className="text-slate-400 mt-1">
          Get categorized technical, behavioral, and HR questions tailored to the company and role.
        </p>
      </div>

      <form
        onSubmit={handleGenerate}
        className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 mb-8 grid md:grid-cols-3 gap-4 max-w-4xl"
      >
        {error && (
          <div className="md:col-span-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm px-3 py-2">
            {error}
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Company</label>
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            required
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white"
            placeholder="e.g. Stripe"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Role</label>
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            required
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white"
            placeholder="e.g. Software Engineer Intern"
          />
        </div>

        <div className="md:col-span-3">
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Job Description (optional)
          </label>
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
            onChange={(e) => setJdFile(e.target.files?.[0] || null)}
            className="w-full text-sm text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:bg-brand-500/20 file:text-brand-200"
          />
          {jdFile && (
            <p className="mt-2 text-xs text-slate-500">Selected: {jdFile.name}</p>
          )}
        </div>
        <div className="md:col-span-3">
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Resume (optional)
          </label>
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
            onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
            className="w-full text-sm text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:bg-brand-500/20 file:text-brand-200"
          />
          {resumeFile && (
            <p className="mt-2 text-xs text-slate-500">Selected: {resumeFile.name}</p>
          )}
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading}
            className="w-full font-semibold bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-white py-2 rounded-xl"
          >
            {loading ? "Generating…" : "Generate"}
          </button>
        </div>
      </form>

      {loading && (
        <div className="flex items-center gap-3 text-slate-400 text-sm mb-6">
          <div className="h-5 w-5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
          Building your question bank…
        </div>
      )}

      {bank && (
        <div className="space-y-10">
          <Section
            title="Technical"
            subtitle="Question, short answer, difficulty"
            items={bank.technical}
            render={(q) => (
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-white font-medium">{q.question}</p>
                <span
                  className={`text-xs px-2 py-0.5 rounded border shrink-0 ${
                    difficultyColors[q.difficulty] || "bg-slate-700/50 text-slate-300"
                  }`}
                >
                  {q.difficulty}
                </span>
              </div>
            )}
            extra={(q) => (
              <p className="text-sm text-slate-400 mt-2">
                <span className="text-slate-500">Answer: </span>
                {q.shortAnswer}
              </p>
            )}
          />
          <Section
            title="Behavioral"
            subtitle="Question and answer framework"
            items={bank.behavioral}
            render={(q) => <p className="text-white font-medium">{q.question}</p>}
            extra={(q) => (
              <p className="text-sm text-slate-400 mt-2">
                <span className="text-slate-500">Framework: </span>
                {q.answerFramework}
              </p>
            )}
          />
          <Section
            title="HR"
            subtitle="Question and suggested answer"
            items={bank.hr}
            render={(q) => <p className="text-white font-medium">{q.question}</p>}
            extra={(q) => (
              <p className="text-sm text-slate-400 mt-2">
                <span className="text-slate-500">Suggested: </span>
                {q.suggestedAnswer}
              </p>
            )}
          />
        </div>
      )}
    </div>
  );
}

function Section({ title, subtitle, items, render, extra }) {
  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-white">{title}</h2>
      <p className="text-sm text-slate-500 mb-4">{subtitle}</p>
      <div className="grid gap-4">
        {(items || []).map((q, i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 hover:border-slate-700 transition-colors"
          >
            {render(q)}
            {extra && extra(q)}
          </div>
        ))}
      </div>
    </div>
  );
}

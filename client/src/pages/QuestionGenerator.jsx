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
  const [activeTab, setActiveTab] = useState("technical");

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
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="flex flex-wrap gap-2">
              <FilterButton
                active={activeTab === "technical"}
                onClick={() => setActiveTab("technical")}
                label={`Technical (${bank.technical?.length || 0})`}
              />
              <FilterButton
                active={activeTab === "behavioral"}
                onClick={() => setActiveTab("behavioral")}
                label={`Behavioral (${bank.behavioral?.length || 0})`}
              />
              <FilterButton
                active={activeTab === "hr"}
                onClick={() => setActiveTab("hr")}
                label={`HR (${bank.hr?.length || 0})`}
              />
            </div>
          </div>

          <Section
            title="Technical"
            subtitle="Question + short answer + difficulty"
            items={bank.technical}
            visible={activeTab === "technical"}
            render={(q) => (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="text-white font-medium leading-snug">{q.question}</p>
                <span
                  className={`text-xs px-2 py-0.5 rounded border shrink-0 capitalize ${
                    difficultyColors[q.difficulty] || "bg-slate-700/50 text-slate-300"
                  }`}
                >
                  {q.difficulty}
                </span>
              </div>
            )}
            extra={(q) => (
              <BulletLines title="Answer points" value={q.shortAnswer} />
            )}
          />
          <Section
            title="Behavioral"
            subtitle="Question + answer framework"
            items={bank.behavioral}
            visible={activeTab === "behavioral"}
            render={(q) => <p className="text-white font-medium">{q.question}</p>}
            extra={(q) => <BulletLines title="Framework points" value={q.answerFramework} />}
          />
          <Section
            title="HR"
            subtitle="Question and suggested answer"
            items={bank.hr}
            visible={activeTab === "hr"}
            render={(q) => <p className="text-white font-medium">{q.question}</p>}
            extra={(q) => <BulletLines title="Suggested points" value={q.suggestedAnswer} />}
          />
        </div>
      )}
    </div>
  );
}

function FilterButton({ active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
        active
          ? "border-brand-400/50 bg-brand-500/20 text-brand-100"
          : "border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-500"
      }`}
    >
      {label}
    </button>
  );
}

function Section({ title, subtitle, items, render, extra, visible }) {
  if (!visible) return null;

  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-white">{title}</h2>
      <p className="text-sm text-slate-500 mb-4">{subtitle}</p>
      <div className="grid gap-4">
        {(items || []).map((q, i) => (
          <details
            key={i}
            className="group rounded-xl border border-slate-800 bg-slate-900/50 hover:border-slate-700 transition-colors open:border-brand-500/40"
          >
            <summary className="cursor-pointer list-none p-5">
              <div className="flex items-start gap-2">
                <span className="text-brand-400 mt-0.5">•</span>
                <div className="flex-1">{render(q)}</div>
                <span className="text-xs text-slate-500 group-open:rotate-180 transition-transform">⌄</span>
              </div>
            </summary>
            {extra && <div className="px-9 pb-5 pt-0">{extra(q)}</div>}
          </details>
        ))}
      </div>
    </div>
  );
}

function BulletLines({ title, value }) {
  const points = toBulletPoints(value);
  return (
    <div className="mt-1">
      <p className="text-xs text-slate-500 uppercase tracking-wide">{title}</p>
      <ul className="mt-2 space-y-1 text-sm text-slate-300">
        {points.map((point, idx) => (
          <li key={idx} className="flex gap-2">
            <span className="text-brand-400">•</span>
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function toBulletPoints(text) {
  if (!text || typeof text !== "string") return ["No answer generated."];
  const normalized = text.replace(/\s+/g, " ").trim();
  const splitByMarkers = normalized
    .split(/(?<=\.)\s+|;\s+|,\s+(?=[A-Z])/)
    .map((item) => item.trim())
    .filter(Boolean);
  return splitByMarkers.length > 0 ? splitByMarkers.slice(0, 5) : [normalized];
}

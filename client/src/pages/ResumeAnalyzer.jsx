import { useRef, useState } from "react";
import { api } from "../services/api";

const EMPLOYMENT_TYPES = ["Full-time", "Internship", "Contract", "Part-time"];

export default function ResumeAnalyzer() {
  const resumeInputRef = useRef(null);
  const jdInputRef = useRef(null);

  const [resumeFile, setResumeFile] = useState(null);
  const [jdFile, setJdFile] = useState(null);

  const [jobTitle, setJobTitle] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [jobSummary, setJobSummary] = useState("");
  const [keyResponsibilities, setKeyResponsibilities] = useState("");
  const [requiredSkills, setRequiredSkills] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  function buildFormData() {
    const fd = new FormData();
    fd.append("resume", resumeFile);
    if (jdFile) fd.append("jobDescription", jdFile);

    fd.append("jobTitle", jobTitle);
    fd.append("employmentType", employmentType);
    fd.append("companyName", companyName);
    fd.append("jobSummary", jobSummary);
    fd.append("keyResponsibilities", keyResponsibilities);
    fd.append("requiredSkills", requiredSkills);
    return fd;
  }

  async function handleAnalyze(e) {
    e.preventDefault();
    if (!resumeFile) {
      setError("Choose a PDF resume");
      return;
    }
    setError("");
    setLoading(true);
    setResult(null);
    try {
      const { data } = await api.post("/resumes/analyze", buildFormData(), {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-white">Resume Analyzer</h1>
        <p className="text-slate-400 mt-1">
          Upload a PDF. We extract text, score ATS fit, and suggest improvements via HireMind AI.
        </p>
      </div>

      <form onSubmit={handleAnalyze} className="space-y-8 max-w-3xl">
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm px-3 py-2">
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-sm font-semibold text-slate-200 mb-3">Your resume</h2>
          <input
            ref={resumeInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => resumeInputRef.current?.click()}
              className="font-semibold bg-brand-500 hover:bg-brand-400 text-white px-5 py-2.5 rounded-xl transition-colors"
            >
              Choose resume (PDF)
            </button>
            <span className="text-sm text-slate-400 truncate max-w-[min(100%,280px)]">
              {resumeFile ? resumeFile.name : "No file selected"}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-5">
          <div>
            <h2 className="text-base font-display font-semibold text-white leading-snug">
              For better resume correction suggestions and more optimal ATS Score on the basis of Job
              Description, fill these fields too.
            </h2>
            <p className="text-xs text-slate-500 mt-2">
              All fields are optional. You can paste a job description below, upload a JD as PDF or
              image, or both — or skip entirely for a general ATS review.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Job Title</label>
              <input
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-600"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Employment Type</label>
              <select
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value)}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white"
              >
                <option value="">Select (optional)</option>
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5">Company Name</label>
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-600"
                placeholder="Optional"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5">Job Summary</label>
              <textarea
                value={jobSummary}
                onChange={(e) => setJobSummary(e.target.value)}
                rows={3}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-600 resize-y min-h-[80px]"
                placeholder="Optional"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5">Key Responsibilities</label>
              <textarea
                value={keyResponsibilities}
                onChange={(e) => setKeyResponsibilities(e.target.value)}
                rows={4}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-600 resize-y min-h-[96px]"
                placeholder="Optional"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-400 mb-1.5">Required Skills</label>
              <textarea
                value={requiredSkills}
                onChange={(e) => setRequiredSkills(e.target.value)}
                rows={3}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-600 resize-y min-h-[80px]"
                placeholder="Optional — e.g. Python, SQL, communication"
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-sm font-semibold text-slate-200 mb-1">Job Description</h2>
          <p className="text-xs text-slate-500 mb-3">
            Upload the job posting as PDF or image (JPEG, PNG, WebP, GIF). Optional.
          </p>
          <input
            ref={jdInputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => setJdFile(e.target.files?.[0] || null)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => jdInputRef.current?.click()}
              className="font-semibold bg-brand-500 hover:bg-brand-400 text-white px-5 py-2.5 rounded-xl transition-colors"
            >
              Choose job description file
            </button>
            <span className="text-sm text-slate-400 truncate max-w-[min(100%,280px)]">
              {jdFile ? jdFile.name : "No file selected"}
            </span>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !resumeFile}
          className="font-semibold bg-brand-500 hover:bg-brand-400 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl"
        >
          {loading ? "Analyzing…" : "Analyze resume"}
        </button>
      </form>

      {loading && (
        <div className="mt-6 flex items-center gap-3 text-slate-400 text-sm">
          <div className="h-5 w-5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
          HireMind AI is reviewing your resume…
        </div>
      )}

      {result && (
        <div className="space-y-6 mt-10">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-card">
            <div className="flex items-baseline gap-4">
              <h2 className="font-display text-lg font-semibold text-white">ATS score</h2>
              <span className="text-4xl font-bold text-brand-400 tabular-nums">{result.atsScore}</span>
              <span className="text-slate-500">/ 100</span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <Card title="Weaknesses" items={result.weaknesses} accent="border-red-500/20" />
            <Card title="Missing skills" items={result.missingSkills} accent="border-amber-500/20" />
            <Card
              title="Bullet improvements"
              items={result.bulletImprovements}
              accent="border-sky-500/20"
            />
            <Card title="Suggestions" items={result.suggestions} accent="border-emerald-500/20" />
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ title, items, accent }) {
  return (
    <div className={`rounded-2xl border ${accent} bg-slate-900/40 p-5`}>
      <h3 className="font-display font-semibold text-white mb-3">{title}</h3>
      <ul className="space-y-2 text-sm text-slate-300">
        {(items || []).map((x, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-brand-500 shrink-0">•</span>
            <span>{x}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

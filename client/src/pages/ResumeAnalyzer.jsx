import { useMemo, useRef, useState } from "react";
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
  const [activeSection, setActiveSection] = useState("suggestions");
  const [resumeId, setResumeId] = useState(null);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

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
      setResumeId(data.resumeId);
      setFeedbackSubmitted(false);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleFeedback(feedbackUseful) {
    if (!resumeId) return;
    try {
      await api.post("/resumes/feedback", { resumeId, feedbackUseful });
      setFeedbackSubmitted(true);
    } catch (err) {
      console.error("Failed to submit feedback:", err);
    }
  }

  const atsScore = useMemo(() => {
    const rawScore = Number(result?.atsScore);
    if (Number.isNaN(rawScore)) return 0;
    return Math.max(0, Math.min(100, rawScore));
  }, [result]);

  const scoreTone =
    atsScore >= 80
      ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/10"
      : atsScore >= 60
      ? "text-amber-300 border-amber-500/30 bg-amber-500/10"
      : "text-red-300 border-red-500/30 bg-red-500/10";

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
          <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-900/80 p-6 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-semibold text-white">ATS score</h2>
                <p className="text-sm text-slate-400 mt-1">Scan this first, then review fixes below.</p>
              </div>
              <div className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${scoreTone}`}>
                {atsScore >= 80 ? "Strong match" : atsScore >= 60 ? "Needs polish" : "High improvement needed"}
              </div>
            </div>
            <div className="mt-5 flex items-end gap-3">
              <span className="text-5xl font-bold text-brand-300 tabular-nums">{atsScore}</span>
              <span className="text-slate-500 mb-1">/ 100</span>
            </div>
            <div className="mt-4 h-2 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-brand-500 to-cyan-300" style={{ width: `${atsScore}%` }} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { id: "suggestions", label: "Suggestions", count: result.suggestions?.length || 0 },
              { id: "weaknesses", label: "Weaknesses", count: result.weaknesses?.length || 0 },
              { id: "skills", label: "Missing skills", count: result.missingSkills?.length || 0 },
              { id: "bullets", label: "Bullet improvements", count: result.bulletImprovements?.length || 0 },
            ].map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setActiveSection(chip.id)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  activeSection === chip.id
                    ? "border-brand-400/50 bg-brand-500/20 text-brand-100"
                    : "border-slate-700 bg-slate-900/50 text-slate-300 hover:border-slate-500"
                }`}
              >
                {chip.label} ({chip.count})
              </button>
            ))}
          </div>

          <div className="max-w-5xl">
            {activeSection === "suggestions" && (
              <Card title="Suggestions" items={result.suggestions} accent="border-emerald-500/20" active />
            )}
            {activeSection === "weaknesses" && (
              <Card title="Weaknesses" items={result.weaknesses} accent="border-red-500/20" active />
            )}
            {activeSection === "skills" && (
              <Card title="Missing skills" items={result.missingSkills} accent="border-amber-500/20" active />
            )}
            {activeSection === "bullets" && (
              <Card
                title="Bullet improvements"
                items={result.bulletImprovements}
                accent="border-sky-500/20"
                active
              />
            )}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 max-w-xl mt-8">
            <h3 className="font-display text-lg font-semibold text-white mb-3">Was this feedback useful?</h3>
            {!feedbackSubmitted ? (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => handleFeedback("yes")}
                  className="flex-1 font-medium bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl transition-colors"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => handleFeedback("no")}
                  className="flex-1 font-medium bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-xl transition-colors"
                >
                  No
                </button>
              </div>
            ) : (
              <p className="text-sm text-emerald-400">Thank you for your feedback!</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ title, items, accent, active }) {
  return (
    <div
      className={`rounded-2xl border ${accent} bg-slate-900/40 p-6 transition-all ${
        active ? "ring-1 ring-brand-400/30 shadow-glow" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="font-display text-xl font-semibold text-white">{title}</h3>
        <span className="text-sm rounded-md border border-slate-700 bg-slate-800/80 text-slate-200 px-2.5 py-1">
          {(items || []).length}
        </span>
      </div>
      <div className="space-y-3">
        {(items || []).length === 0 && <p className="text-base text-slate-400">No items found.</p>}
        {(items || []).map((x, i) => {
          const parsed = parseSuggestionText(x);
          return (
            <details
              key={i}
              className="group rounded-xl border border-slate-800 bg-slate-950/40 open:bg-slate-900/70"
            >
              <summary className="cursor-pointer list-none px-4 py-3 flex items-start gap-3">
                <span className="text-brand-400 shrink-0 mt-1 text-lg leading-none">•</span>
                <span className="text-base leading-relaxed text-slate-100">
                  {renderInlineBold(parsed.title)}
                </span>
                <span className="ml-auto text-sm text-slate-400 group-open:rotate-180 transition-transform">⌄</span>
              </summary>
              {parsed.points.length > 0 && (
                <ul className="px-10 pb-4 space-y-2 text-sm leading-relaxed text-slate-300">
                  {parsed.points.map((point, idx) => (
                    <li key={idx} className="list-disc">
                      {renderInlineBold(point)}
                    </li>
                  ))}
                </ul>
              )}
            </details>
          );
        })}
      </div>
    </div>
  );
}

function renderInlineBold(text) {
  const input = String(text || "");
  const parts = input.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);

  return parts.map((part, idx) => {
    const m = part.match(/^\*\*([^*]+)\*\*$/);
    if (m) {
      return (
        <strong key={idx} className="font-semibold text-white">
          {m[1]}
        </strong>
      );
    }
    return part.replace(/\*\*/g, "");
  });
}

function parseSuggestionText(text) {
  if (!text || typeof text !== "string") return { title: "No content", points: [] };

  const compact = text.replace(/\s+/g, " ").trim().replace(/^\*\s*/, "");
  const withBullets = compact
    .replace(/Original:/gi, "| Original:")
    .replace(/Improved:/gi, "| Improved:")
    .replace(/Tip:/gi, "| Tip:");
  const parts = withBullets
    .split("|")
    .map((part) => part.trim().replace(/^\*\s*/, ""))
    .filter(Boolean);

  if (parts.length <= 1) {
    const colonIndex = compact.indexOf(":");
    if (colonIndex > 0 && colonIndex < compact.length - 1) {
      const heading = compact.slice(0, colonIndex).trim();
      const detail = compact
        .slice(colonIndex + 1)
        .trim()
        .replace(/^['"]+|['"]+$/g, "");
      if (detail) {
        return { title: heading, points: [detail] };
      }
    }
    return { title: compact, points: [compact] };
  }

  return {
    title: parts[0],
    points: parts.slice(1).map((part) => part.replace(/\.$/, "")),
  };
}

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api, getApiErrorMessage } from "../services/api";
import posthog from "../posthog";
import { useAuth } from "../context/AuthContext";
import { useCredits } from "../context/CreditContext";
import SignupPromptModal from "../components/SignupPromptModal";
import CreditQuotaModal from "../components/CreditQuotaModal";
import {
  FREE_RESUME_ANALYSIS_LIMIT,
  getFreeResumeAnalysisUsed,
  markFreeResumeAnalysisUsed,
} from "../utils/freeTrial";
import { trackResumeAnalysisFreeCompleted } from "../utils/tryFreeAnalytics";

const EMPLOYMENT_TYPES = ["Full-time", "Internship", "Contract", "Part-time"];

const LOADING_STAGES = [
  "Parsing resume structure…",
  "Evaluating ATS keyword density…",
  "Detecting red flags and weak verbs…",
  "Analysing bullet impact scores…",
  "Generating personalised rewrites…",
  "Computing final ATS score…",
];

export default function ResumeAnalyzer() {
  const { isAuthenticated } = useAuth();
  const { refreshCredits } = useCredits();
  const resumeInputRef = useRef(null);
  const jdInputRef = useRef(null);

  const [resumeFile, setResumeFile] = useState(null);
  const [jdFile, setJdFile] = useState(null);
  const [jdOpen, setJdOpen] = useState(false);

  const [jobTitle, setJobTitle] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [jobSummary, setJobSummary] = useState("");
  const [keyResponsibilities, setKeyResponsibilities] = useState("");
  const [requiredSkills, setRequiredSkills] = useState("");

  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [activeSection, setActiveSection] = useState("suggestions");
  const [resumeId, setResumeId] = useState(null);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [trialStatus, setTrialStatus] = useState(null);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [creditError, setCreditError] = useState(null);
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    let active = true;
    async function loadTrialStatus() {
      try {
        const { data } = await api.get("/trial/status");
        if (!active) return;
        setTrialStatus(data || null);
      } catch {
        if (!active) return;
        setTrialStatus(null);
      }
    }
    loadTrialStatus();
    return () => { active = false; };
  }, []);

  // Cycle through loading stage messages
  useEffect(() => {
    if (!loading) { setLoadingStage(0); return; }
    const id = setInterval(() => setLoadingStage((s) => (s + 1) % LOADING_STAGES.length), 2800);
    return () => clearInterval(id);
  }, [loading]);

  const atsScore = useMemo(() => {
    const rawScore = Number(result?.atsScore);
    if (Number.isNaN(rawScore)) return 0;
    return Math.max(0, Math.min(100, rawScore));
  }, [result]);

  // Animated count-up for score
  useEffect(() => {
    if (!result) { setDisplayScore(0); return; }
    const target = atsScore;
    const start = Date.now();
    const duration = 1400;
    const frame = () => {
      const elapsed = Date.now() - start;
      const p = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplayScore(Math.round(eased * target));
      if (p < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, [result, atsScore]);

  const scoreTone =
    atsScore >= 80
      ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/10"
      : atsScore >= 60
      ? "text-amber-300 border-amber-500/30 bg-amber-500/10"
      : "text-red-300 border-red-500/30 bg-red-500/10";

  const remainingFreeAnalyses =
    trialStatus?.mode === "guest"
      ? Math.max(0, Number(trialStatus.resumeAnalysesLeft ?? 0))
      : !isAuthenticated
      ? Math.max(0, FREE_RESUME_ANALYSIS_LIMIT - getFreeResumeAnalysisUsed())
      : null;

  const guestMode = !isAuthenticated;
  const pageShellClass = guestMode
    ? "-mx-4 sm:-mx-6 md:-mx-10 min-h-screen bg-chromatic px-4 py-6 sm:px-6 md:px-10"
    : "";
  const innerShellClass = guestMode
    ? "relative mx-auto w-full max-w-5xl overflow-hidden pb-14"
    : "mx-auto w-full max-w-5xl pb-10";
  const surfaceClass = guestMode
    ? "rounded-3xl border border-slate-700/60 bg-slate-900/35 backdrop-blur-sm shadow-card"
    : "rounded-2xl border border-slate-800 bg-slate-900/40";

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
    if (!resumeFile) { setError("Choose a PDF resume"); return; }
    const remainingFromServer =
      trialStatus?.mode === "guest" ? Number(trialStatus.resumeAnalysesLeft ?? 0) : null;
    if (!isAuthenticated && remainingFromServer !== null && remainingFromServer <= 0) {
      setShowSignupPrompt(true);
      setError("Create a free account to continue practicing with HireMind");
      return;
    }
    if (!isAuthenticated && remainingFromServer === null && getFreeResumeAnalysisUsed() >= FREE_RESUME_ANALYSIS_LIMIT) {
      setShowSignupPrompt(true);
      setError("Create a free account to continue practicing with HireMind");
      return;
    }
    setError("");
    setLoading(true);
    setResult(null);
    try {
      const { data } = await api.post("/resumes/analyze", buildFormData(), {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000,
      });
      setResult(data);
      setResumeId(data.resumeId);
      setFeedbackSubmitted(false);
      setActiveSection("suggestions");
      const extension = resumeFile?.name?.split(".").pop()?.toLowerCase();
      posthog.capture("resume_uploaded", { file_type: extension || "unknown" });
      posthog.capture("resume_analysis_generated");
      if (isAuthenticated) {
        posthog.capture("credit_used", { feature: "resume_analysis", amount: 3 });
        refreshCredits();
      }
      if (!isAuthenticated) {
        markFreeResumeAnalysisUsed();
        trackResumeAnalysisFreeCompleted({
          resume_uploaded: true,
          job_description_present: Boolean(jdFile),
          target_company: companyName || "",
          target_role: jobTitle || "",
        });
        try {
          const { data: status } = await api.get("/trial/status");
          setTrialStatus(status || null);
        } catch { /* noop */ }
      }
    } catch (err) {
      const errorCode = err?.response?.data?.code;
      if (isAuthenticated && (errorCode === "INSUFFICIENT_CREDITS" || errorCode === "UNLIMITED_CAP_REACHED")) {
        setCreditError(err.response.data);
        setShowCreditModal(true);
        setError(err.response.data.message);
      } else {
        setError(getApiErrorMessage(err, "Resume analysis failed"));
        if (errorCode === "FREE_LIMIT_REACHED") setShowSignupPrompt(true);
      }
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

  const TABS = [
    { id: "suggestions", label: "Suggestions", icon: "💡", count: result?.suggestions?.length || 0, accent: "border-emerald-500/30", bullet: "💡", iconColor: "text-emerald-400" },
    { id: "weaknesses",  label: "Red Flags",   icon: "🚩", count: result?.weaknesses?.length || 0,  accent: "border-red-500/30",     bullet: "🚩", iconColor: "text-red-400" },
    { id: "skills",      label: "Missing Skills", icon: "🎯", count: result?.missingSkills?.length || 0, accent: "border-amber-500/30", bullet: "🎯", iconColor: "text-amber-400" },
    { id: "bullets",     label: "Bullet Rewrites", icon: "✏️", count: result?.bulletImprovements?.length || 0, accent: "border-sky-500/30", bullet: "✏️", iconColor: "text-sky-400" },
  ];

  const activeTab = TABS.find((t) => t.id === activeSection);

  return (
    <div className={pageShellClass}>
      <div className={innerShellClass}>
        {guestMode && <div className="pointer-events-none absolute -top-14 -left-14 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />}
        {guestMode && <div className="pointer-events-none absolute top-1/3 -right-16 h-60 w-60 rounded-full bg-fuchsia-500/18 blur-3xl" />}
        {guestMode && <div className="pointer-events-none absolute bottom-0 left-1/4 h-56 w-56 rounded-full bg-indigo-400/16 blur-3xl" />}

        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className={`relative z-10 mb-5 p-5 md:p-6 ${surfaceClass}`}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-cyan-400 flex items-center justify-center shadow-lg shrink-0">
                <span className="text-xl">📄</span>
              </div>
              <div>
                <h1 className="font-display text-2xl md:text-3xl font-bold text-white">Resume Analyzer</h1>
                <p className="text-slate-400 mt-0.5 text-sm md:text-base max-w-xl">
                  Industry-grade ATS analysis · personalized red-flag detection · bullet rewrites
                </p>
              </div>
            </div>
            {remainingFreeAnalyses !== null && (
              <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-200 font-medium shrink-0">
                {remainingFreeAnalyses} free {remainingFreeAnalyses === 1 ? "scan" : "scans"} left
              </div>
            )}
          </div>
        </motion.div>

        <form onSubmit={handleAnalyze} className="relative z-10 space-y-4">
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-sm px-4 py-3"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step 1 — Upload resume */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.07 }}
            className={`p-5 md:p-6 ${surfaceClass}`}
          >
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-3">Step 1</p>
            <h2 className="text-base font-semibold text-white mb-4">Upload your resume</h2>
            <input
              ref={resumeInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
            />
            <button
              type="button"
              onClick={() => resumeInputRef.current?.click()}
              className={`w-full border-2 border-dashed rounded-2xl py-8 px-6 text-center transition-all duration-200 group ${
                resumeFile
                  ? "border-brand-500/60 bg-brand-500/5"
                  : "border-slate-700 hover:border-slate-500 bg-slate-900/30"
              }`}
            >
              <div className="text-4xl mb-3 transition-transform duration-200 group-hover:scale-110">
                {resumeFile ? "✅" : "📁"}
              </div>
              <p className={`text-sm font-semibold ${resumeFile ? "text-brand-300" : "text-slate-300"}`}>
                {resumeFile ? resumeFile.name : "Click to choose resume PDF"}
              </p>
              {!resumeFile && <p className="text-xs text-slate-600 mt-1.5">PDF only · max 10 MB</p>}
              {resumeFile && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setResumeFile(null); }}
                  className="mt-2 text-xs text-slate-500 hover:text-red-400 transition-colors"
                >
                  Remove
                </button>
              )}
            </button>
          </motion.div>

          {/* Step 2 — Job context (collapsible) */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.13 }}
            className={`${surfaceClass} overflow-hidden`}
          >
            <button
              type="button"
              onClick={() => setJdOpen((o) => !o)}
              className="w-full flex items-center justify-between p-5 md:px-6 text-left hover:bg-white/[0.02] transition-colors"
            >
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-0.5">Step 2 — Optional</p>
                <span className="text-base font-semibold text-white">Add Job Context</span>
                <span className="ml-2 text-xs text-slate-500 font-normal">boosts score accuracy</span>
              </div>
              <motion.span
                animate={{ rotate: jdOpen ? 180 : 0 }}
                transition={{ duration: 0.22 }}
                className="text-slate-400"
              >
                ⌄
              </motion.span>
            </button>

            <AnimatePresence>
              {jdOpen && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: "auto" }}
                  exit={{ height: 0 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-slate-800/80 px-5 md:px-6 pb-6 pt-4 space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1.5">Job Title</label>
                        <input
                          value={jobTitle}
                          onChange={(e) => setJobTitle(e.target.value)}
                          className="w-full rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-brand-500/60 transition-colors"
                          placeholder="e.g. Software Engineer"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1.5">Employment Type</label>
                        <select
                          value={employmentType}
                          onChange={(e) => setEmploymentType(e.target.value)}
                          className="w-full rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500/60 transition-colors"
                        >
                          <option value="">Select (optional)</option>
                          {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs text-slate-400 mb-1.5">Company Name</label>
                        <input
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          className="w-full rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-brand-500/60 transition-colors"
                          placeholder="e.g. Google"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs text-slate-400 mb-1.5">Job Summary</label>
                        <textarea
                          value={jobSummary}
                          onChange={(e) => setJobSummary(e.target.value)}
                          rows={3}
                          className="w-full rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-600 resize-y min-h-[72px] focus:outline-none focus:border-brand-500/60 transition-colors"
                          placeholder="Paste the job summary…"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs text-slate-400 mb-1.5">Key Responsibilities</label>
                        <textarea
                          value={keyResponsibilities}
                          onChange={(e) => setKeyResponsibilities(e.target.value)}
                          rows={3}
                          className="w-full rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-600 resize-y min-h-[72px] focus:outline-none focus:border-brand-500/60 transition-colors"
                          placeholder="Paste key responsibilities…"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs text-slate-400 mb-1.5">Required Skills</label>
                        <textarea
                          value={requiredSkills}
                          onChange={(e) => setRequiredSkills(e.target.value)}
                          rows={2}
                          className="w-full rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-600 resize-y min-h-[56px] focus:outline-none focus:border-brand-500/60 transition-colors"
                          placeholder="e.g. Python, SQL, React, communication"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-400 mb-2">Or upload JD as file</label>
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
                          className="font-medium border border-slate-600 text-slate-300 hover:bg-slate-800/80 hover:text-white px-4 py-2 rounded-xl transition-colors text-sm"
                        >
                          Choose file (PDF or image)
                        </button>
                        {jdFile && (
                          <span className="text-xs text-emerald-400 truncate max-w-[200px]">✓ {jdFile.name}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Submit */}
          <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.19 }}
            type="submit"
            disabled={loading || !resumeFile}
            whileHover={{ scale: resumeFile && !loading ? 1.015 : 1 }}
            whileTap={{ scale: 0.98 }}
            className={`font-semibold disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3.5 rounded-xl text-sm transition-shadow ${
              guestMode
                ? "bg-gradient-to-r from-brand-500 to-fuchsia-500 hover:from-brand-400 hover:to-fuchsia-400 shadow-glow"
                : "bg-gradient-to-r from-brand-500 to-cyan-500 hover:from-brand-400 hover:to-cyan-400 shadow-lg"
            }`}
          >
            {loading ? "Analysing…" : "Analyse resume →"}
          </motion.button>
        </form>

        {/* Loading animation */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mt-6 relative z-10 rounded-2xl border border-brand-500/20 bg-brand-500/5 px-5 py-4"
            >
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <div className="h-8 w-8 border-2 border-brand-400/30 rounded-full" />
                  <div className="absolute inset-0 h-8 w-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
                </div>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={loadingStage}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.25 }}
                    className="text-sm text-brand-200 font-medium"
                  >
                    {LOADING_STAGES[loadingStage]}
                  </motion.p>
                </AnimatePresence>
              </div>
              <div className="mt-3 h-0.5 rounded-full bg-slate-800 overflow-hidden">
                <motion.div
                  animate={{ x: ["-100%", "100%"] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                  className="h-full w-1/3 bg-gradient-to-r from-transparent via-brand-400 to-transparent"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="relative z-10 space-y-5 mt-10"
            >
              {/* ATS Score card */}
              <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-slate-900/90 p-6 shadow-card">
                <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                  {/* SVG ring */}
                  <div className="relative shrink-0 mx-auto sm:mx-0">
                    <ScoreRing score={atsScore} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-4xl font-bold text-white tabular-nums leading-none">{displayScore}</span>
                      <span className="text-xs text-slate-500 mt-0.5">/100</span>
                    </div>
                  </div>
                  {/* Text */}
                  <div className="flex-1 text-center sm:text-left">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mb-2">
                      <h2 className="font-display text-xl font-bold text-white">ATS Score</h2>
                      <span className={`rounded-lg border px-3 py-1 text-xs font-semibold ${scoreTone}`}>
                        {atsScore >= 80 ? "✅ Strong match" : atsScore >= 60 ? "⚠️ Needs polish" : "🚨 High improvement needed"}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 mb-4 leading-relaxed">
                      {atsScore >= 80
                        ? "Well optimised — review suggestions to push into the top tier."
                        : atsScore >= 60
                        ? "Solid foundation — focus on the red flags and bullet rewrites below."
                        : "Significant gaps detected. Start with weaknesses and bullet rewrites immediately."}
                    </p>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${atsScore}%` }}
                        transition={{ duration: 1.4, ease: [0.33, 1, 0.68, 1] }}
                        className={`h-full rounded-full ${
                          atsScore >= 80
                            ? "bg-gradient-to-r from-emerald-500 to-cyan-400"
                            : atsScore >= 60
                            ? "bg-gradient-to-r from-amber-500 to-orange-400"
                            : "bg-gradient-to-r from-red-500 to-rose-400"
                        }`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Tab chips */}
              <div className="flex flex-wrap gap-2">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveSection(tab.id)}
                    className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                      activeSection === tab.id
                        ? "border-brand-400/50 bg-brand-500/20 text-brand-100 shadow-sm"
                        : "border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                    }`}
                  >
                    <span className="mr-1.5">{tab.icon}</span>
                    {tab.label}
                    <span className={`ml-2 text-xs rounded-full px-1.5 py-0.5 ${
                      activeSection === tab.id ? "bg-brand-400/30 text-brand-200" : "bg-slate-800 text-slate-500"
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Active card */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeSection}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.22 }}
                >
                  {activeTab && (
                    <Card
                      title={activeTab.label === "Red Flags" ? "Red Flags Detected" : activeTab.label}
                      items={
                        activeSection === "suggestions" ? result.suggestions :
                        activeSection === "weaknesses" ? result.weaknesses :
                        activeSection === "skills" ? result.missingSkills :
                        result.bulletImprovements
                      }
                      accent={activeTab.accent}
                      iconColor={activeTab.iconColor}
                      bullet={activeTab.bullet}
                    />
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Feedback */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 max-w-lg">
                <h3 className="font-display text-base font-semibold text-white mb-3">Was this analysis helpful?</h3>
                {!feedbackSubmitted ? (
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => handleFeedback("yes")}
                      className="flex-1 font-medium bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 px-4 py-2.5 rounded-xl transition-colors text-sm"
                    >
                      👍 Helpful
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFeedback("no")}
                      className="flex-1 font-medium bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700 text-slate-300 px-4 py-2.5 rounded-xl transition-colors text-sm"
                    >
                      👎 Not helpful
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-emerald-400">Thanks for your feedback! 🙏</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <SignupPromptModal open={showSignupPrompt} onClose={() => setShowSignupPrompt(false)} feature="resume_analysis" />
        <CreditQuotaModalWrapper show={showCreditModal} onClose={() => setShowCreditModal(false)} error={creditError} />
      </div>
    </div>
  );
}

/* ── SVG score ring with CSS-transition animation ── */
function ScoreRing({ score, size = 130 }) {
  const strokeWidth = 9;
  const r = size / 2 - strokeWidth;
  const circ = 2 * Math.PI * r;
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";
  const glowColor = score >= 80 ? "rgba(16,185,129,0.25)" : score >= 60 ? "rgba(245,158,11,0.25)" : "rgba(239,68,68,0.25)";
  const [offset, setOffset] = useState(circ);

  useEffect(() => {
    const target = circ - (score / 100) * circ;
    const timer = setTimeout(() => setOffset(target), 120);
    return () => clearTimeout(timer);
  }, [score, circ]);

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", filter: `drop-shadow(0 0 8px ${glowColor})` }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e293b" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.33, 1, 0.68, 1)" }}
      />
    </svg>
  );
}

/* ── Result item card ── */
function Card({ title, items, accent, iconColor, bullet }) {
  return (
    <div className={`rounded-2xl border ${accent} bg-slate-900/35 backdrop-blur-sm p-6`}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="font-display text-lg font-semibold text-white">{title}</h3>
        <span className="text-xs rounded-lg border border-slate-700 bg-slate-800/80 text-slate-400 px-2.5 py-1">
          {(items || []).length} items
        </span>
      </div>
      <div className="space-y-2">
        {(items || []).length === 0 && <p className="text-sm text-slate-400">No items found.</p>}
        {(items || []).map((x, i) => {
          const parsed = parseSuggestionText(x);
          return (
            <motion.details
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.25 }}
              className="group rounded-xl border border-slate-700/60 bg-slate-900/50 open:bg-slate-900/80 open:border-slate-600/60 transition-colors"
            >
              <summary className="cursor-pointer list-none px-4 py-3.5 flex items-start gap-3">
                <span className={`${iconColor} shrink-0 mt-0.5 text-sm leading-5`}>{bullet}</span>
                <span className="text-sm leading-relaxed text-slate-100 flex-1">
                  {renderInlineBold(parsed.title)}
                </span>
                <span className="ml-auto text-xs text-slate-500 group-open:rotate-180 transition-transform shrink-0 mt-1">⌄</span>
              </summary>
              {parsed.points.length > 0 && (
                <ul className="px-10 pb-4 space-y-2 text-sm leading-relaxed text-slate-300">
                  {parsed.points.map((point, idx) => (
                    <li key={idx} className="flex gap-2">
                      <span className="text-slate-600 shrink-0">›</span>
                      <span>{renderInlineBold(point)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </motion.details>
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
    if (m) return <strong key={idx} className="font-semibold text-white">{m[1]}</strong>;
    return part.replace(/\*\*/g, "");
  });
}

function parseSuggestionText(text) {
  if (!text || typeof text !== "string") return { title: "No content", points: [] };

  const compact = text.replace(/\s+/g, " ").trim().replace(/^\*\s*/, "");

  const beforeAfterMatch = compact.match(/^Before\s*:\s*(.+?)\s*(?:→|->)\s*After\s*:\s*(.+)$/i);
  if (beforeAfterMatch) {
    const before = beforeAfterMatch[1].trim().replace(/^['"""]+|['"""]+$/g, "");
    const after = beforeAfterMatch[2].trim().replace(/^['"""]+|['"""]+$/g, "");
    return {
      title: "**Bullet rewrite** — tap to see before/after",
      points: [`**Before:** ${before}`, `**After:** ${after}`],
    };
  }

  const withBullets = compact
    .replace(/Original:/gi, "| Original:")
    .replace(/Improved:/gi, "| Improved:")
    .replace(/Before:/gi, "| Before:")
    .replace(/After:/gi, "| After:")
    .replace(/Tip:/gi, "| Tip:");
  const parts = withBullets.split("|").map((p) => p.trim().replace(/^\*\s*/, "")).filter(Boolean);

  if (parts.length <= 1) {
    const colonIndex = compact.indexOf(":");
    if (colonIndex > 0 && colonIndex < compact.length - 1) {
      const heading = compact.slice(0, colonIndex).trim();
      const detail = compact.slice(colonIndex + 1).trim().replace(/^['"]+|['"]+$/g, "");
      if (detail) return { title: heading, points: [detail] };
    }
    return { title: compact, points: [compact] };
  }

  return {
    title: parts[0],
    points: parts.slice(1).map((p) => p.replace(/\.$/, "")),
  };
}

function CreditQuotaModalWrapper({ show, onClose, error }) {
  if (!show || !error) return null;
  return (
    <CreditQuotaModal
      isOpen={show}
      onClose={onClose}
      reason={error.code}
      creditsNeeded={error.creditsNeeded || 0}
    />
  );
}

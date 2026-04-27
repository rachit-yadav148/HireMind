import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../services/api";
import posthog from "../posthog";
import { useCredits } from "../context/CreditContext";
import CreditQuotaModal from "../components/CreditQuotaModal";

const difficultyConfig = {
  easy:   { cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", label: "Easy" },
  medium: { cls: "bg-amber-500/15 text-amber-300 border-amber-500/30",       label: "Medium" },
  hard:   { cls: "bg-red-500/15 text-red-300 border-red-500/30",             label: "Hard" },
};

const TABS = [
  { id: "technical",  label: "Technical",  icon: "⚙️", subtitle: "DSA · system design · CS fundamentals" },
  { id: "behavioral", label: "Behavioral", icon: "🧠", subtitle: "STAR stories · leadership · teamwork" },
  { id: "hr",         label: "HR",         icon: "💼", subtitle: "Culture fit · goals · salary" },
];

export default function QuestionGenerator() {
  const { refreshCredits } = useCredits();
  const jdInputRef = useRef(null);
  const resumeInputRef = useRef(null);

  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [jdFile, setJdFile] = useState(null);
  const [resumeFile, setResumeFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [bank, setBank] = useState(null);
  const [activeTab, setActiveTab] = useState("technical");
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [creditError, setCreditError] = useState(null);

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
      setActiveTab("technical");
      posthog.capture("question_generated", { company, role });
      posthog.capture("credit_used", { feature: "question_generator", amount: 3 });
      refreshCredits();
    } catch (err) {
      const errorCode = err?.response?.data?.code;
      if (errorCode === "INSUFFICIENT_CREDITS" || errorCode === "UNLIMITED_CAP_REACHED") {
        setCreditError(err.response.data);
        setShowCreditModal(true);
        setError(err.response.data.message);
      } else {
        setError(err.response?.data?.message || "Generation failed");
      }
    } finally {
      setLoading(false);
    }
  }

  const activeTabConfig = TABS.find((t) => t.id === activeTab);
  const activeItems =
    activeTab === "technical" ? bank?.technical :
    activeTab === "behavioral" ? bank?.behavioral :
    bank?.hr;

  return (
    <div className="mx-auto w-full max-w-5xl pb-10">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38 }}
        className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-5 md:p-6"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-400 flex items-center justify-center shadow-lg shrink-0">
            <span className="text-xl">🎯</span>
          </div>
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-white">Question Generator</h1>
            <p className="text-slate-400 mt-0.5 text-sm md:text-base">
              Company-specific technical, behavioral & HR questions with answer guides
            </p>
          </div>
        </div>
      </motion.div>

      {/* Form */}
      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onSubmit={handleGenerate}
        className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 md:p-6 mb-6 space-y-5"
      >
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm px-4 py-3"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Company *</label>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              required
              className="w-full rounded-xl bg-slate-900/80 border border-slate-700 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-brand-500/60 transition-colors"
              placeholder="e.g. Google, Stripe, Flipkart"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Role *</label>
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
              className="w-full rounded-xl bg-slate-900/80 border border-slate-700 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-brand-500/60 transition-colors"
              placeholder="e.g. Software Engineer Intern"
            />
          </div>
        </div>

        {/* File uploads — custom styled */}
        <div className="grid sm:grid-cols-2 gap-4">
          {/* JD file */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Job Description</label>
            <input
              ref={jdInputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => setJdFile(e.target.files?.[0] || null)}
            />
            <button
              type="button"
              onClick={() => jdInputRef.current?.click()}
              className={`w-full rounded-xl border-2 border-dashed py-3 px-4 text-sm text-left transition-all ${
                jdFile
                  ? "border-amber-500/50 bg-amber-500/5 text-amber-300"
                  : "border-slate-700 hover:border-slate-500 text-slate-400"
              }`}
            >
              {jdFile ? `✓ ${jdFile.name}` : "📄 Upload JD (optional)"}
            </button>
          </div>

          {/* Resume file */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Resume</label>
            <input
              ref={resumeInputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
            />
            <button
              type="button"
              onClick={() => resumeInputRef.current?.click()}
              className={`w-full rounded-xl border-2 border-dashed py-3 px-4 text-sm text-left transition-all ${
                resumeFile
                  ? "border-brand-500/50 bg-brand-500/5 text-brand-300"
                  : "border-slate-700 hover:border-slate-500 text-slate-400"
              }`}
            >
              {resumeFile ? `✓ ${resumeFile.name}` : "📋 Upload Resume (optional)"}
            </button>
          </div>
        </div>

        <motion.button
          type="submit"
          disabled={loading}
          whileHover={{ scale: !loading ? 1.015 : 1 }}
          whileTap={{ scale: 0.98 }}
          className="font-semibold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 text-white py-3 px-8 rounded-xl text-sm shadow-lg transition-shadow"
        >
          {loading ? "Generating…" : "Generate questions →"}
        </motion.button>
      </motion.form>

      {/* Loading */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-5 py-4 flex items-center gap-3"
          >
            <div className="h-5 w-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin shrink-0" />
            <p className="text-sm text-amber-200 font-medium">Building your personalised question bank…</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence>
        {bank && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-4"
          >
            {/* Tab bar */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-3 flex flex-wrap gap-2">
              {TABS.map((tab) => {
                const count = tab.id === "technical" ? bank.technical?.length :
                              tab.id === "behavioral" ? bank.behavioral?.length :
                              bank.hr?.length;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 min-w-[100px] rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 text-left ${
                      activeTab === tab.id
                        ? "bg-brand-500/20 border border-brand-400/40 text-brand-100"
                        : "border border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                    }`}
                  >
                    <span className="mr-1.5">{tab.icon}</span>
                    {tab.label}
                    <span className={`ml-2 text-xs rounded-full px-1.5 py-0.5 ${
                      activeTab === tab.id ? "bg-brand-400/30 text-brand-200" : "bg-slate-800 text-slate-500"
                    }`}>
                      {count || 0}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Question cards */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.22 }}
              >
                {activeTabConfig && (
                  <div>
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <span className="text-lg">{activeTabConfig.icon}</span>
                      <div>
                        <h2 className="font-display text-lg font-semibold text-white">{activeTabConfig.label}</h2>
                        <p className="text-xs text-slate-500">{activeTabConfig.subtitle}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {(activeItems || []).map((q, i) => (
                        <motion.details
                          key={i}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.045, duration: 0.26 }}
                          className="group rounded-xl border border-slate-800 bg-slate-900/50 hover:border-slate-700 transition-colors open:border-brand-500/30 open:bg-slate-900/80"
                        >
                          <summary className="cursor-pointer list-none p-4 md:p-5">
                            <div className="flex items-start gap-3">
                              <span className="text-brand-400 mt-0.5 shrink-0 text-sm">Q{i + 1}</span>
                              <div className="flex-1">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <p className="text-white font-medium text-sm leading-snug flex-1">
                                    {q.question}
                                  </p>
                                  {q.difficulty && (
                                    <span className={`text-[11px] px-2 py-0.5 rounded border shrink-0 font-semibold ${
                                      difficultyConfig[q.difficulty]?.cls || "bg-slate-700/50 text-slate-300 border-slate-700"
                                    }`}>
                                      {difficultyConfig[q.difficulty]?.label || q.difficulty}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className="text-xs text-slate-500 group-open:rotate-180 transition-transform shrink-0 mt-0.5">⌄</span>
                            </div>
                          </summary>
                          <div className="px-5 md:px-6 pb-5 pt-1 border-t border-slate-800/80">
                            {q.shortAnswer && <BulletLines title="Answer guide" value={q.shortAnswer} />}
                            {q.answerFramework && <BulletLines title="STAR framework" value={q.answerFramework} />}
                            {q.suggestedAnswer && <BulletLines title="Suggested answer" value={q.suggestedAnswer} />}
                          </div>
                        </motion.details>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <CreditQuotaModalWrapper show={showCreditModal} onClose={() => setShowCreditModal(false)} error={creditError} />
    </div>
  );
}

function BulletLines({ title, value }) {
  const points = toBulletPoints(value);
  return (
    <div className="mt-3">
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">{title}</p>
      <ul className="space-y-1.5 text-sm text-slate-300">
        {points.map((point, idx) => (
          <li key={idx} className="flex gap-2">
            <span className="text-brand-400 shrink-0">›</span>
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CreditQuotaModalWrapper({ show, onClose, error }) {
  if (!show || !error) return null;
  return (
    <CreditQuotaModal isOpen={show} onClose={onClose} reason={error.code} creditsNeeded={error.creditsNeeded || 0} />
  );
}

function toBulletPoints(text) {
  if (!text || typeof text !== "string") return ["No answer generated."];
  const normalized = text.replace(/\s+/g, " ").trim();
  const split = normalized
    .split(/(?<=\.)\s+|;\s+|,\s+(?=[A-Z])/)
    .map((item) => item.trim())
    .filter(Boolean);
  return split.length > 0 ? split.slice(0, 5) : [normalized];
}

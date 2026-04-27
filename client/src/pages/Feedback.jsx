import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../services/api";

const CATEGORIES = [
  { value: "general", label: "General",  icon: "💬", desc: "Overall experience" },
  { value: "bug",     label: "Bug",       icon: "🐛", desc: "Report an issue" },
  { value: "feature", label: "Feature",   icon: "✨", desc: "Request something new" },
  { value: "ui",      label: "UI / UX",   icon: "🎨", desc: "Design feedback" },
  { value: "other",   label: "Other",     icon: "📎", desc: "Anything else" },
];

export default function Feedback() {
  const [feedbackText, setFeedbackText] = useState("");
  const [category, setCategory] = useState("general");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!feedbackText.trim()) { setError("Please enter your feedback"); return; }
    setError("");
    setLoading(true);
    setSuccess(false);
    try {
      await api.post("/feedback", { feedbackText, category });
      setSuccess(true);
      setFeedbackText("");
      setCategory("general");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit feedback");
    } finally {
      setLoading(false);
    }
  }

  const charCount = feedbackText.length;
  const charColor = charCount > 800 ? "text-amber-400" : charCount > 400 ? "text-slate-400" : "text-slate-600";

  return (
    <div className="mx-auto w-full max-w-2xl pb-10">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38 }}
        className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-5 md:p-6"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-lg shrink-0">
            <span className="text-xl">💌</span>
          </div>
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-white">Platform Feedback</h1>
            <p className="text-slate-400 mt-0.5 text-sm">
              Your thoughts help us build a better HireMind. We read every message.
            </p>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="mb-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 px-5 py-4 flex items-start gap-3"
          >
            <span className="text-2xl shrink-0">🙏</span>
            <div>
              <p className="text-sm font-semibold text-emerald-300">Thank you for your feedback!</p>
              <p className="text-xs text-emerald-400/80 mt-0.5">We appreciate your input and will review it carefully.</p>
            </div>
          </motion.div>
        )}
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="mb-5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm px-4 py-3"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 md:p-6 space-y-6"
      >
        {/* Category pills */}
        <div>
          <label className="block text-sm font-semibold text-slate-200 mb-3">Category</label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setCategory(cat.value)}
                className={`rounded-xl border p-3 text-left transition-all duration-200 ${
                  category === cat.value
                    ? "border-brand-400/50 bg-brand-500/15 ring-1 ring-brand-500/20"
                    : "border-slate-700 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-800/50"
                }`}
              >
                <span className="text-xl block mb-1">{cat.icon}</span>
                <p className={`text-xs font-semibold ${category === cat.value ? "text-brand-200" : "text-slate-300"}`}>
                  {cat.label}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-tight hidden sm:block">{cat.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Textarea */}
        <div>
          <label className="block text-sm font-semibold text-slate-200 mb-2">
            Your Feedback <span className="text-red-400">*</span>
          </label>
          <textarea
            required
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            rows={8}
            className="w-full rounded-xl bg-slate-900/80 border border-slate-700 px-4 py-3 text-sm text-white placeholder:text-slate-600 resize-y min-h-[160px] focus:outline-none focus:border-brand-500/60 transition-colors"
            placeholder="Be as specific as possible — the more detail you share, the faster we can improve…"
          />
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-xs text-slate-600">Tip: include steps to reproduce any bugs</p>
            <p className={`text-xs tabular-nums ${charColor}`}>{charCount} chars</p>
          </div>
        </div>

        <motion.button
          type="submit"
          disabled={loading || !feedbackText.trim()}
          whileHover={{ scale: !loading && feedbackText.trim() ? 1.015 : 1 }}
          whileTap={{ scale: 0.98 }}
          className="w-full font-semibold bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3.5 rounded-xl transition-shadow shadow-lg text-sm"
        >
          {loading ? "Submitting…" : "Send Feedback →"}
        </motion.button>
      </motion.form>

      {/* Tips */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="mt-5 rounded-2xl border border-slate-800/60 bg-slate-900/20 p-5"
      >
        <h3 className="font-display text-sm font-semibold text-white mb-3">What helps us most</h3>
        <ul className="space-y-2 text-sm text-slate-400">
          {[
            "Specific examples of what works well or what doesn't",
            "Suggestions for new features or improvements",
            "Steps to reproduce bugs you encountered",
            "Your overall experience using HireMind",
          ].map((tip, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="text-brand-500 shrink-0 mt-0.5">›</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </motion.div>
    </div>
  );
}

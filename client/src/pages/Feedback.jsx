import { useState } from "react";
import { api } from "../services/api";

export default function Feedback() {
  const [feedbackText, setFeedbackText] = useState("");
  const [category, setCategory] = useState("general");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!feedbackText.trim()) {
      setError("Please enter your feedback");
      return;
    }
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

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-white">Platform Feedback</h1>
        <p className="text-slate-400 mt-1 max-w-2xl">
          We value your feedback! Share your thoughts, suggestions, or report issues to help us improve HireMind.
        </p>
      </div>

      <div className="max-w-2xl">
        {success && (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm px-4 py-3 mb-6">
            Thank you for your feedback! We appreciate your input and will review it carefully.
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm px-4 py-3 mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white"
            >
              <option value="general">General Feedback</option>
              <option value="bug">Bug Report</option>
              <option value="feature">Feature Request</option>
              <option value="ui">UI/UX Improvement</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">
              Your Feedback <span className="text-red-400">*</span>
            </label>
            <textarea
              required
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              rows={10}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-4 py-3 text-sm text-white placeholder:text-slate-600 resize-y min-h-[200px]"
              placeholder="Share your detailed feedback here. Be as specific as possible to help us understand your experience..."
            />
            <p className="text-xs text-slate-500 mt-2">
              {feedbackText.length} characters
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !feedbackText.trim()}
            className="w-full font-semibold bg-brand-500 hover:bg-brand-400 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl transition-colors"
          >
            {loading ? "Submitting..." : "Submit Feedback"}
          </button>
        </form>

        <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/20 p-5">
          <h3 className="font-display font-semibold text-white mb-2">What kind of feedback helps us most?</h3>
          <ul className="space-y-2 text-sm text-slate-400">
            <li className="flex gap-2">
              <span className="text-brand-500">•</span>
              <span>Specific examples of what works well or what doesn't</span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand-500">•</span>
              <span>Suggestions for new features or improvements</span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand-500">•</span>
              <span>Details about bugs, including steps to reproduce them</span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand-500">•</span>
              <span>Your overall experience using HireMind</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

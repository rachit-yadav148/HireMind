import { useState } from "react";
import { Link } from "react-router-dom";
import { api, getApiErrorMessage } from "../services/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [resetUrl, setResetUrl] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    setResetUrl("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      setMessage(data?.message || "If an account exists, reset instructions have been sent.");
      if (data?.resetUrl) setResetUrl(data.resetUrl);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to submit forgot password request"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-chromatic relative overflow-hidden flex items-center justify-center p-6">
      <div className="pointer-events-none absolute -top-16 left-10 w-64 h-64 bg-cyan-400/20 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 right-10 w-72 h-72 bg-fuchsia-500/20 rounded-full blur-3xl" />

      <div className="w-full max-w-md rounded-2xl border border-slate-700/80 bg-slate-900/65 backdrop-blur-md p-8 shadow-card">
        <div className="text-center mb-8">
          <h1 className="font-display font-bold text-2xl text-white">Forgot password</h1>
          <p className="text-slate-400 text-sm mt-2">Enter your email to receive reset instructions.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm px-3 py-2">
              {error}
            </div>
          )}
          {message && (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm px-3 py-2">
              {message}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              placeholder="you@university.edu"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full font-semibold bg-gradient-to-r from-brand-500 to-fuchsia-500 hover:from-brand-400 hover:to-fuchsia-400 disabled:opacity-50 text-white py-3 rounded-xl transition-colors"
          >
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>

        {resetUrl && (
          <div className="mt-4 rounded-lg bg-slate-950/80 border border-slate-700 p-3 text-xs text-slate-300 break-all">
            <p className="font-semibold text-slate-200 mb-1">Dev reset link:</p>
            <a href={resetUrl} className="text-brand-300 hover:text-brand-200 underline">
              {resetUrl}
            </a>
          </div>
        )}

        <p className="text-center text-sm text-slate-500 mt-6">
          Back to{" "}
          <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}

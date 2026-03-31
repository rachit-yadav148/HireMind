import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getApiErrorMessage } from "../services/api";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, "Login failed"));
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
          <Link to="/" className="font-display font-bold text-2xl text-white inline-block">
            Hire
            <span className="bg-gradient-to-r from-cyan-300 via-brand-400 to-fuchsia-400 bg-clip-text text-transparent">
              Mind
            </span>
          </Link>
          <p className="text-slate-400 text-sm mt-2">Sign in to your account</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm px-3 py-2">
              {error}
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
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full font-semibold bg-gradient-to-r from-brand-500 to-fuchsia-500 hover:from-brand-400 hover:to-fuchsia-400 disabled:opacity-50 text-white py-3 rounded-xl transition-colors"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="text-center text-sm text-slate-500 mt-6">
          No account?{" "}
          <Link to="/register" className="text-brand-400 hover:text-brand-300 font-medium">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}

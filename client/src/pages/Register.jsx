import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getApiErrorMessage } from "../services/api";
import { Eye, EyeOff } from "../components/Icons";

const OTP_RESEND_COOLDOWN_SECONDS = Math.max(
  10,
  Math.min(300, Number(import.meta.env.VITE_OTP_RESEND_COOLDOWN || 30))
);

export default function Register() {
  const { register, verifySignupOtp, resendSignupOtp } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpStep, setOtpStep] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);

  useEffect(() => {
    if (!otpStep || otpCooldown <= 0) return;
    const timer = setInterval(() => {
      setOtpCooldown((v) => (v > 0 ? v - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpStep, otpCooldown]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      if (!otpStep) {
        const data = await register(name, email, password);
        setOtpStep(true);
        setOtpCooldown(OTP_RESEND_COOLDOWN_SECONDS);
        setMessage(data?.message || "OTP sent to your email. Enter it to verify your account.");
      } else {
        await verifySignupOtp(email, otp);
        navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Registration failed"));
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    setError("");
    setMessage("");
    setResendingOtp(true);
    try {
      const data = await resendSignupOtp(email);
      setOtpCooldown(OTP_RESEND_COOLDOWN_SECONDS);
      setMessage(data?.message || "OTP resent successfully.");
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to resend OTP"));
    } finally {
      setResendingOtp(false);
    }
  }

  return (
    <div className="min-h-screen bg-chromatic relative overflow-hidden flex items-center justify-center p-6">
      <div className="pointer-events-none absolute -top-16 left-12 w-64 h-64 bg-cyan-400/20 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 right-8 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl" />

      <div className="w-full max-w-md rounded-2xl border border-slate-700/80 bg-slate-900/65 backdrop-blur-md p-8 shadow-card">
        <div className="text-center mb-8">
          <Link to="/" className="font-display font-bold text-2xl text-white inline-block">
            Hire
            <span className="bg-gradient-to-r from-cyan-300 via-brand-400 to-fuchsia-400 bg-clip-text text-transparent">
              Mind
            </span>
          </Link>
          <p className="text-slate-400 text-sm mt-2">Create your account</p>
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
          {!otpStep && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                placeholder="Your name"
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              readOnly={otpStep}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 read-only:opacity-80"
            />
          </div>
          {!otpStep && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 pl-3 pr-11 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">At least 6 characters</p>
            </div>
          )}
          {otpStep && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Enter OTP</label>
              <input
                type="text"
                required
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2.5 text-sm text-white tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                placeholder="6-digit OTP"
              />
            </div>
          )}
          <button
            type="submit"
            disabled={loading || (otpStep && otp.length !== 6)}
            className="w-full font-semibold bg-gradient-to-r from-brand-500 to-fuchsia-500 hover:from-brand-400 hover:to-fuchsia-400 disabled:opacity-50 text-white py-3 rounded-xl transition-colors"
          >
            {loading ? (otpStep ? "Verifying…" : "Creating…") : otpStep ? "Verify OTP" : "Create account"}
          </button>
          {otpStep && (
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={resendingOtp || loading || otpCooldown > 0}
              className="w-full border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 disabled:opacity-50 py-2.5 rounded-xl text-sm transition-colors"
            >
              {resendingOtp ? "Resending OTP…" : otpCooldown > 0 ? `Resend OTP in ${otpCooldown}s` : "Resend OTP"}
            </button>
          )}
        </form>
        <p className="text-center text-sm text-slate-500 mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

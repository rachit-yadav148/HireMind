import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Zap, AlertCircle, CreditCard, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useCredits } from "../context/CreditContext";

/* ─── Animated progress bar ──────────────────────────────────────────────── */
function ProgressBar({ pct, gradient, delay = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  return (
    <div ref={ref} className="w-full h-1.5 bg-white/8 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={inView ? { width: `${Math.min(100, Math.max(0, pct))}%` } : { width: 0 }}
        transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
        className={`h-full rounded-full bg-gradient-to-r ${gradient}`}
      />
    </div>
  );
}

export default function DashboardCreditCard() {
  const { creditStatus, loading } = useCredits();

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/8 bg-white/3 p-6 animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-white/8 shimmer" />
          <div className="h-5 bg-white/8 rounded-lg w-36 shimmer" />
          <div className="ml-auto h-5 bg-white/8 rounded-full w-16 shimmer" />
        </div>
        <div className="h-16 bg-white/5 rounded-xl shimmer" />
      </div>
    );
  }

  if (!creditStatus) return null;

  const isUnlimited = creditStatus.subscriptionType === "unlimited_monthly";
  const isFree = creditStatus.subscriptionType === "free";
  const creditsLow = !isUnlimited && creditStatus.credits < 10;
  const creditsExhausted = !isUnlimited && creditStatus.credits === 0;

  const planMeta = {
    free: { label: "Free Tier", gradient: "from-slate-500 to-slate-600", icon: "✦", badge: "bg-slate-700/60 text-slate-400" },
    monthly: { label: "Monthly Plan", gradient: "from-brand-500 to-fuchsia-500", icon: "◈", badge: "bg-brand-500/20 text-brand-300" },
    quarterly: { label: "Quarterly Plan", gradient: "from-brand-500 to-fuchsia-500", icon: "◈", badge: "bg-brand-500/20 text-brand-300" },
    half_yearly: { label: "Half-Yearly Plan", gradient: "from-brand-500 to-violet-500", icon: "◈", badge: "bg-violet-500/20 text-violet-300" },
    yearly: { label: "Yearly Plan", gradient: "from-violet-500 to-fuchsia-500", icon: "◈", badge: "bg-violet-500/20 text-violet-300" },
    unlimited_monthly: { label: "Unlimited Plan", gradient: "from-purple-500 to-pink-500", icon: "∞", badge: "bg-purple-500/20 text-purple-300" },
  };

  const meta = planMeta[creditStatus.subscriptionType] || planMeta.free;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl border border-white/8 overflow-hidden"
      style={{ background: "linear-gradient(135deg, rgba(15,23,42,0.8) 0%, rgba(8,14,26,0.9) 100%)" }}
    >
      {/* Header strip */}
      <div className={`bg-gradient-to-r ${meta.gradient} px-5 py-0.5`} />

      <div className="p-5 sm:p-6">
        {/* Plan badge row */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-gradient-to-br ${meta.gradient} shadow-inner`}>
              <span className="text-white font-bold text-base">{meta.icon}</span>
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{meta.label}</p>
              <p className="text-xs text-slate-500">Current plan</p>
            </div>
          </div>
          <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
            isFree ? "border-slate-700 bg-slate-800/60 text-slate-400" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
          }`}>
            {isFree ? "Free" : "Active"}
          </span>
        </div>

        {isUnlimited ? (
          /* Unlimited plan view */
          <div>
            <div className="flex items-end gap-2 mb-3">
              <span className="font-display text-4xl font-bold text-white tabular-nums">
                {(creditStatus.unlimitedMonthlyRemaining || 0).toLocaleString()}
              </span>
              <span className="text-slate-500 text-sm mb-1">/ 2,000 credits</span>
            </div>
            <ProgressBar
              pct={((creditStatus.unlimitedMonthlyRemaining || 0) / 2000) * 100}
              gradient="from-purple-500 to-pink-500"
            />
            <p className="text-xs text-slate-600 mt-2">
              Resets {new Date(creditStatus.unlimitedMonthlyResetAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </p>
          </div>
        ) : (
          /* Regular / free plan view */
          <div>
            <div className="flex items-end gap-2 mb-1">
              <motion.span
                key={creditStatus.credits}
                initial={{ scale: 1.15, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                className={`font-display text-5xl font-bold tabular-nums ${creditsExhausted ? "text-red-400" : "text-white"}`}
              >
                {creditStatus.credits}
              </motion.span>
              <span className="text-slate-500 text-base mb-2">credits</span>
            </div>

            {/* Approximate usage breakdown */}
            <div className="grid grid-cols-3 gap-3 mt-4 mb-4">
              {[
                { label: "Resume", cost: 3, icon: "📄", color: "text-cyan-400", barColor: "from-cyan-500 to-brand-500" },
                { label: "Interview", cost: 10, icon: "🎙️", color: "text-violet-400", barColor: "from-violet-500 to-fuchsia-500" },
                { label: "Questions", cost: 3, icon: "❓", color: "text-amber-400", barColor: "from-amber-500 to-orange-500" },
              ].map((f, i) => (
                <div key={f.label} className="rounded-xl bg-white/4 border border-white/6 p-3 text-center">
                  <span className="text-base">{f.icon}</span>
                  <p className={`font-bold text-lg mt-1 tabular-nums ${f.color}`}>
                    {Math.floor(creditStatus.credits / f.cost)}
                  </p>
                  <p className="text-[10px] text-slate-600 mt-0.5 uppercase tracking-wide">{f.label}</p>
                  <div className="mt-2">
                    <ProgressBar
                      pct={Math.min(100, (Math.floor(creditStatus.credits / f.cost) / 10) * 100)}
                      gradient={f.barColor}
                      delay={i * 0.1}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Warnings */}
            {creditsExhausted && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-4 p-3.5 rounded-xl bg-red-500/8 border border-red-500/25 flex items-start gap-2.5"
              >
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-300">Free quota exhausted</p>
                  <p className="text-xs text-red-400/80 mt-0.5">Recharge to continue using AI features</p>
                </div>
              </motion.div>
            )}
            {creditsLow && !creditsExhausted && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-4 p-3.5 rounded-xl bg-amber-500/8 border border-amber-500/25 flex items-start gap-2.5"
              >
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-300">Credits running low</p>
                  <p className="text-xs text-amber-400/80 mt-0.5">Consider recharging to avoid interruptions</p>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* Usage stats */}
        <div className="mt-4 pt-4 border-t border-white/6 grid grid-cols-2 gap-3">
          {[
            { label: "Total earned", value: creditStatus.totalEarned },
            { label: "Total spent", value: creditStatus.totalSpent },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="font-display font-bold text-lg text-white tabular-nums">{s.value}</p>
              <p className="text-[10px] text-slate-600 uppercase tracking-wide">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="mt-5 flex gap-3">
          <motion.div className="flex-1" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Link
              to="/dashboard/plans"
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-fuchsia-500 text-white font-semibold text-sm shadow-glow hover:shadow-glow-lg transition-shadow duration-200 w-full"
            >
              <CreditCard className="w-3.5 h-3.5" />
              {isFree || creditsExhausted ? "View plans" : "Upgrade"}
            </Link>
          </motion.div>
          {!isFree && (
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link
                to="/dashboard/transactions"
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-slate-400 hover:text-white font-medium text-sm transition-all duration-200"
              >
                History
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

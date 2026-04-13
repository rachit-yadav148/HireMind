import { Zap, TrendingUp, AlertCircle, CreditCard, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useCredits } from "../context/CreditContext";

export default function DashboardCreditCard() {
  const { creditStatus, loading } = useCredits();

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 animate-pulse">
        <div className="h-6 bg-slate-800 rounded w-1/3 mb-4"></div>
        <div className="h-20 bg-slate-800 rounded"></div>
      </div>
    );
  }

  if (!creditStatus) return null;

  const isUnlimited = creditStatus.subscriptionType === "unlimited_monthly";
  const isFree = creditStatus.subscriptionType === "free";
  const creditsLow = !isUnlimited && creditStatus.credits < 10;
  const creditsExhausted = !isUnlimited && creditStatus.credits === 0;

  const getSubscriptionLabel = () => {
    const labels = {
      free: "Free Tier",
      monthly: "Monthly Plan",
      quarterly: "Quarterly Plan",
      half_yearly: "Half-Yearly Plan",
      yearly: "Yearly Plan",
      unlimited_monthly: "Unlimited Plan",
    };
    return labels[creditStatus.subscriptionType] || "Free Tier";
  };

  const getSubscriptionColor = () => {
    if (isUnlimited) return "from-purple-500 to-pink-500";
    if (isFree) return "from-slate-500 to-slate-600";
    return "from-brand-500 to-fuchsia-500";
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
      {/* Header */}
      <div className={`bg-gradient-to-r ${getSubscriptionColor()} p-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-white" />
            <h2 className="font-semibold text-white">{getSubscriptionLabel()}</h2>
          </div>
          {!isFree && (
            <div className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-xs font-semibold text-white">
              Active
            </div>
          )}
        </div>
      </div>

      {/* Credits Display */}
      <div className="p-6">
        {isUnlimited ? (
          <div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-4xl font-bold text-white">
                {creditStatus.unlimitedMonthlyRemaining || 0}
              </span>
              <span className="text-slate-400 text-sm">/ 2000 credits this month</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 mb-3">
              <div
                className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all"
                style={{
                  width: `${((creditStatus.unlimitedMonthlyRemaining || 0) / 2000) * 100}%`,
                }}
              />
            </div>
            <p className="text-xs text-slate-400">
              Resets on {new Date(creditStatus.unlimitedMonthlyResetAt).toLocaleDateString("en-IN")}
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-baseline gap-2 mb-3">
              <span className={`text-5xl font-bold ${creditsExhausted ? "text-red-400" : "text-white"}`}>
                {creditStatus.credits}
              </span>
              <span className="text-slate-400 text-lg">credits</span>
            </div>

            {/* Credit Breakdown */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                <div className="text-xs text-slate-400 mb-1">Resume</div>
                <div className="text-lg font-semibold text-white">
                  {Math.floor(creditStatus.credits / 3)}
                </div>
              </div>
              <div className="text-center p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                <div className="text-xs text-slate-400 mb-1">Interview</div>
                <div className="text-lg font-semibold text-white">
                  {Math.floor(creditStatus.credits / 10)}
                </div>
              </div>
              <div className="text-center p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                <div className="text-xs text-slate-400 mb-1">Questions</div>
                <div className="text-lg font-semibold text-white">
                  {Math.floor(creditStatus.credits / 3)}
                </div>
              </div>
            </div>

            {/* Warning Banners */}
            {creditsExhausted && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-300">Free Quota Exhausted</p>
                  <p className="text-xs text-red-400 mt-1">
                    Recharge now to continue using AI-powered features
                  </p>
                </div>
              </div>
            )}

            {creditsLow && !creditsExhausted && (
              <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-300">Credits Running Low</p>
                  <p className="text-xs text-amber-400 mt-1">
                    Consider recharging to avoid interruptions
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Usage Stats */}
        <div className="mt-4 pt-4 border-t border-slate-800">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-slate-400">Total Earned</span>
            <span className="text-white font-semibold">{creditStatus.totalEarned}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Total Spent</span>
            <span className="text-white font-semibold">{creditStatus.totalSpent}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex gap-3">
          <Link
            to="/dashboard/plans"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-brand-500 to-fuchsia-500 hover:from-brand-400 hover:to-fuchsia-400 text-white font-semibold text-sm transition-all shadow-glow"
          >
            <CreditCard className="w-4 h-4" />
            {isFree || creditsExhausted ? "View Plans" : "Upgrade"}
          </Link>
          {!isFree && (
            <Link
              to="/dashboard/transactions"
              className="px-4 py-2.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-white font-medium text-sm transition-all flex items-center gap-2"
            >
              History
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

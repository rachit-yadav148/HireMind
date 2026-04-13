import { Zap } from "lucide-react";
import { useCredits } from "../context/CreditContext";

export default function CreditDisplay() {
  const { creditStatus, loading } = useCredits();

  if (loading || !creditStatus) {
    return null;
  }

  const isUnlimited = creditStatus.subscriptionType === "unlimited_monthly";

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700">
      <Zap className="w-4 h-4 text-brand-400" />
      <div className="flex flex-col">
        <span className="text-xs text-slate-400">Credits</span>
        <span className="text-sm font-semibold text-white">
          {isUnlimited ? (
            <>
              {creditStatus.unlimitedMonthlyRemaining || 0}/{2000}
              <span className="text-xs text-slate-400 ml-1">this month</span>
            </>
          ) : (
            creditStatus.credits || 0
          )}
        </span>
      </div>
      {creditStatus.subscriptionType !== "free" && (
        <div className="ml-2 px-2 py-0.5 rounded text-xs font-semibold bg-brand-500/20 text-brand-400 border border-brand-500/30">
          {creditStatus.subscriptionType === "unlimited_monthly" ? "∞" : creditStatus.subscriptionType.toUpperCase()}
        </div>
      )}
    </div>
  );
}

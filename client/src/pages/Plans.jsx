import { useState } from "react";
import { Zap, Check, CreditCard, TrendingUp, AlertCircle, Loader2 } from "lucide-react";
import { useCredits } from "../context/CreditContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { openRazorpayCheckout } from "../utils/razorpay";

const PLANS = [
  {
    id: "monthly",
    name: "Monthly",
    credits: 300,
    price: 249,
    popular: false,
    features: [
      "300 Credits",
      "~100 Resume Analyses",
      "~30 AI Interviews",
      "~100 Question Banks",
      "Valid for 1 month",
    ],
  },
  {
    id: "quarterly",
    name: "Quarterly",
    credits: 1000,
    price: 749,
    popular: true,
    savings: "Save ₹498",
    features: [
      "1,000 Credits",
      "~333 Resume Analyses",
      "~100 AI Interviews",
      "~333 Question Banks",
      "Valid for 3 months",
      "Best Value for Money",
    ],
  },
  {
    id: "half_yearly",
    name: "Half-Yearly",
    credits: 2200,
    price: 1399,
    popular: false,
    savings: "Save ₹1,095",
    features: [
      "2,200 Credits",
      "~733 Resume Analyses",
      "~220 AI Interviews",
      "~733 Question Banks",
      "Valid for 6 months",
    ],
  },
  {
    id: "yearly",
    name: "Yearly",
    credits: 5000,
    price: 2899,
    popular: false,
    savings: "Save ₹2,989",
    features: [
      "5,000 Credits",
      "~1,666 Resume Analyses",
      "~500 AI Interviews",
      "~1,666 Question Banks",
      "Valid for 12 months",
      "Maximum Savings",
    ],
  },
  {
    id: "unlimited_monthly",
    name: "Unlimited",
    credits: "∞",
    price: 1649,
    popular: false,
    features: [
      "2,000 Credits/Month",
      "Unlimited Resume Analyses",
      "Unlimited AI Interviews",
      "Unlimited Question Banks",
      "Auto-renews monthly",
      "Premium Support",
    ],
  },
];

export default function Plans() {
  const { creditStatus, loading, refreshCredits } = useCredits();
  const { user } = useAuth();
  const [paying, setPaying] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handlePlanSelect = async (planId) => {
    setPaying(planId);
    setSuccessMsg("");
    setErrorMsg("");
    try {
      const { data: order } = await api.post("/payments/create-order", { planId });

      openRazorpayCheckout({
        order,
        user,
        onSuccess: async (paymentData) => {
          try {
            const { data } = await api.post("/payments/verify", paymentData);
            setSuccessMsg(data.message);
            refreshCredits();
          } catch (err) {
            setErrorMsg(err.response?.data?.message || "Payment verification failed");
          } finally {
            setPaying(null);
          }
        },
        onFailure: (msg) => {
          if (msg !== "Payment cancelled") setErrorMsg(msg);
          setPaying(null);
        },
      });
    } catch (err) {
      setErrorMsg(err.response?.data?.message || "Failed to initiate payment");
      setPaying(null);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-white">Pricing Plans</h1>
        <p className="text-slate-400 mt-1">Choose the perfect plan for your job search journey</p>
      </div>

      {/* Current Plan Banner */}
      {!loading && creditStatus && (
        <div className="mb-8 p-4 rounded-xl border border-slate-700 bg-slate-800/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brand-500/20">
              <Zap className="w-5 h-5 text-brand-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                Current Plan: {creditStatus.subscriptionType === "free" ? "Free Tier" : creditStatus.subscriptionType.replace("_", " ").toUpperCase()}
              </p>
              <p className="text-xs text-slate-400">
                {creditStatus.subscriptionType === "unlimited_monthly"
                  ? `${creditStatus.unlimitedMonthlyRemaining || 0} / 2000 credits remaining this month`
                  : `${creditStatus.credits} credits available`}
              </p>
            </div>
          </div>
          {creditStatus.credits === 0 && creditStatus.subscriptionType === "free" && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-sm font-semibold text-red-300">Quota Exhausted</span>
            </div>
          )}
        </div>
      )}

      {/* Success / Error messages */}
      {successMsg && (
        <div className="mb-6 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center gap-3">
          <Check className="w-5 h-5 text-emerald-400" />
          <p className="text-sm font-semibold text-emerald-300">{successMsg}</p>
        </div>
      )}
      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <p className="text-sm font-semibold text-red-300">{errorMsg}</p>
        </div>
      )}

      {/* Credit Costs Reference */}
      <div className="mb-8 p-4 rounded-xl border border-slate-700 bg-slate-800/30">
        <h3 className="text-sm font-semibold text-white mb-3">Credit Costs</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-brand-400"></div>
            <span className="text-slate-300">Resume Analysis:</span>
            <span className="font-semibold text-white">3 credits</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-fuchsia-400"></div>
            <span className="text-slate-300">AI Interview:</span>
            <span className="font-semibold text-white">10 credits</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-purple-400"></div>
            <span className="text-slate-300">Question Generator:</span>
            <span className="font-semibold text-white">3 credits</span>
          </div>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`relative rounded-2xl border p-6 transition-all hover:scale-105 ${
              plan.popular
                ? "border-brand-500 bg-gradient-to-br from-brand-500/10 to-fuchsia-500/10 shadow-xl"
                : "border-slate-700 bg-slate-800/50"
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-brand-500 to-fuchsia-500 rounded-full text-xs font-bold text-white shadow-glow">
                BEST VALUE
              </div>
            )}

            {plan.savings && (
              <div className="absolute -top-3 right-4 px-3 py-1 bg-emerald-500 rounded-full text-xs font-bold text-white">
                {plan.savings}
              </div>
            )}

            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
              <div className="flex items-baseline justify-center gap-1 mb-2">
                <span className="text-5xl font-bold text-white">₹{plan.price}</span>
              </div>
              <p className="text-brand-400 font-semibold text-lg">
                {typeof plan.credits === "number" ? `${plan.credits} credits` : plan.credits}
              </p>
            </div>

            <ul className="space-y-3 mb-6">
              {plan.features.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-slate-300">
                  <Check className="w-5 h-5 text-brand-400 flex-shrink-0 mt-0.5" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => handlePlanSelect(plan.id)}
              disabled={paying !== null}
              className={`w-full py-3 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                plan.popular
                  ? "bg-gradient-to-r from-brand-500 to-fuchsia-500 hover:from-brand-400 hover:to-fuchsia-400 text-white shadow-glow"
                  : "bg-slate-700 hover:bg-slate-600 text-white"
              }`}
            >
              {paying === plan.id ? (
                <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
              ) : (
                <CreditCard className="w-4 h-4 inline mr-2" />
              )}
              {paying === plan.id ? "Processing..." : "Buy Now"}
            </button>
          </div>
        ))}
      </div>

      {/* FAQ Section */}
      <div className="mt-12 p-6 rounded-2xl border border-slate-700 bg-slate-800/30">
        <h3 className="text-xl font-bold text-white mb-4">Frequently Asked Questions</h3>
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-white mb-1">How do credits work?</h4>
            <p className="text-sm text-slate-400">
              Each AI feature consumes credits: Resume Analysis (3), AI Interview (10), Question Generator (3). Credits are deducted when you use these features.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-1">Do credits expire?</h4>
            <p className="text-sm text-slate-400">
              Standard plan credits are valid for the plan duration. Unlimited plan credits reset monthly.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-1">Can I upgrade my plan?</h4>
            <p className="text-sm text-slate-400">
              Yes! You can upgrade anytime. Unused credits from your current plan will be carried forward.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

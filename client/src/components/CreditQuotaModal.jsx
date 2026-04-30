import { useState } from "react";
import { X, CreditCard, TrendingUp, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCredits } from "../context/CreditContext";
import { api } from "../services/api";
import { openRazorpayCheckout } from "../utils/razorpay";
import posthog from "../posthog";
import BrandLogo from "./BrandLogo";

const PLANS = [
  {
    id: "monthly",
    name: "Monthly",
    credits: 300,
    price: 249,
    popular: false,
    features: ["~100 Resume Analyses", "~30 AI Interviews", "~100 Question Banks"],
  },
  {
    id: "quarterly",
    name: "Quarterly",
    credits: 1000,
    price: 749,
    popular: true,
    features: ["~333 Resume Analyses", "~100 AI Interviews", "~333 Question Banks", "Best Value"],
  },
  {
    id: "half_yearly",
    name: "Half-Yearly",
    credits: 2200,
    price: 1399,
    popular: false,
    features: ["~733 Resume Analyses", "~220 AI Interviews", "~733 Question Banks"],
  },
  {
    id: "yearly",
    name: "Yearly",
    credits: 5000,
    price: 2899,
    popular: false,
    features: ["~1666 Resume Analyses", "~500 AI Interviews", "~1666 Question Banks"],
  },
  {
    id: "unlimited_monthly",
    name: "Unlimited",
    credits: "∞",
    price: 1649,
    popular: false,
    features: ["2000 credits/month cap", "Unlimited features", "Auto-renews monthly", "Premium Support"],
  },
];

export default function CreditQuotaModal({ isOpen, onClose, reason = "INSUFFICIENT_CREDITS", creditsNeeded = 0 }) {
  const { user } = useAuth();
  const { refreshCredits } = useCredits();
  const [paying, setPaying] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const handlePlanSelect = async (planId) => {
    setPaying(planId);
    setErrorMsg("");
    try {
      const { data: order } = await api.post("/payments/create-order", { planId });
      posthog.capture("payment_started", { plan: planId, amount: order.amount / 100, source: "modal" });

      openRazorpayCheckout({
        order,
        user,
        onSuccess: async (paymentData) => {
          try {
            await api.post("/payments/verify", paymentData);
            posthog.capture("payment_success", { plan: planId, amount: order.amount / 100, credits: order.credits, source: "modal" });
            refreshCredits();
            onClose();
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

  const getMessage = () => {
    if (reason === "UNLIMITED_CAP_REACHED") {
      return {
        title: "Monthly Unlimited Cap Reached",
        description: "You've reached your monthly unlimited plan cap. It will reset next month, or upgrade to get more credits now.",
      };
    }
    return {
      title: "Insufficient Credits",
      description: `You need ${creditsNeeded} credits to use this feature. Recharge to continue using HireMind's AI-powered tools.`,
    };
  };

  const message = getMessage();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-slate-800 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-slate-400" />
        </button>

        <div className="p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center mb-4">
              <BrandLogo className="h-16 w-16" alt="" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">{message.title}</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">{message.description}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-xl border p-6 transition-all hover:scale-105 ${
                  plan.popular
                    ? "border-brand-500 bg-gradient-to-br from-brand-500/10 to-fuchsia-500/10"
                    : "border-slate-700 bg-slate-800/50"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-brand-500 to-fuchsia-500 rounded-full text-xs font-semibold text-white">
                    BEST VALUE
                  </div>
                )}

                <div className="text-center mb-4">
                  <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold text-white">₹{plan.price}</span>
                    {plan.id !== "unlimited_monthly" && <span className="text-slate-400 text-sm">/plan</span>}
                    {plan.id === "unlimited_monthly" && <span className="text-slate-400 text-sm">/month</span>}
                  </div>
                  <p className="text-brand-400 font-semibold mt-2">
                    {typeof plan.credits === "number" ? `${plan.credits} credits` : plan.credits}
                  </p>
                </div>

                <ul className="space-y-2 mb-6">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-slate-300">
                      <TrendingUp className="w-4 h-4 text-brand-400 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handlePlanSelect(plan.id)}
                  disabled={paying !== null}
                  className={`w-full py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
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

          {errorMsg && (
            <div className="mt-6 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-300 text-center">
              {errorMsg}
            </div>
          )}

          <div className="mt-8 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
            <p className="text-sm text-slate-400 text-center">
              <strong className="text-white">Credit Costs:</strong> Resume Analysis (3 credits) • AI Interview (10
              credits) • Question Generator (3 credits)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

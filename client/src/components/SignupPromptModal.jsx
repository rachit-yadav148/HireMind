import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import posthog from "../posthog";
import BrandLogo from "./BrandLogo";

const VARIANT_B_COPY = {
  resume_analysis: {
    title: "Unlock more resume insights",
    description: "Create a free account to get 12 more free resume analyses and continue improving your resume.",
    cta: "Get 12 Free Resume Analyses",
  },
  ai_interview: {
    title: "Continue practicing interviews",
    description: "Create a free account to unlock 3 more full-length AI mock interviews.",
    cta: "Get 3 Free AI Interviews",
  },
};

const DEFAULT_COPY = {
  title: "Keep practicing with HireMind",
  description: "Create a free account to continue practicing with HireMind",
  cta: "Create free account",
};

export default function SignupPromptModal({ open, onClose, feature }) {
  const trackedRef = useRef(false);

  useEffect(() => {
    if (!open || trackedRef.current) return;
    const variant = posthog.getFeatureFlag("signup-prompt-copy") || "control";
    posthog.capture("signup_prompt_shown", { variant, feature: feature || "unknown" });
    trackedRef.current = true;
  }, [open, feature]);

  useEffect(() => {
    if (!open) trackedRef.current = false;
  }, [open]);

  if (!open) return null;

  const variant = posthog.getFeatureFlag("signup-prompt-copy") || "control";
  const isVariantB = variant === "test" && feature && VARIANT_B_COPY[feature];
  const copy = isVariantB ? VARIANT_B_COPY[feature] : DEFAULT_COPY;

  const handleCtaClick = () => {
    posthog.capture("signup_prompt_cta_clicked", { variant, feature: feature || "unknown" });
  };

  const handleDismiss = () => {
    posthog.capture("signup_prompt_dismissed", { variant, feature: feature || "unknown" });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/75" onClick={handleDismiss} aria-hidden="true" />
      <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-card">
        <BrandLogo className="h-11 w-11 mb-4" alt="" />
        <h3 className="font-display text-xl font-semibold text-white">{copy.title}</h3>
        <p className="mt-2 text-sm text-slate-300">{copy.description}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            to="/register"
            onClick={handleCtaClick}
            className="inline-flex items-center justify-center font-semibold bg-gradient-to-r from-brand-500 to-fuchsia-500 hover:from-brand-400 hover:to-fuchsia-400 text-white px-4 py-2 rounded-lg"
          >
            {copy.cta}
          </Link>
          <button
            type="button"
            onClick={handleDismiss}
            className="inline-flex items-center justify-center border border-slate-600 text-slate-200 hover:bg-slate-800 px-4 py-2 rounded-lg"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}

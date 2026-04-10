import { Link } from "react-router-dom";

export default function SignupPromptModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/75" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-card">
        <h3 className="font-display text-xl font-semibold text-white">Keep practicing with HireMind</h3>
        <p className="mt-2 text-sm text-slate-300">
          Create a free account to continue practicing with HireMind
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            to="/register"
            className="inline-flex items-center justify-center font-semibold bg-gradient-to-r from-brand-500 to-fuchsia-500 hover:from-brand-400 hover:to-fuchsia-400 text-white px-4 py-2 rounded-lg"
          >
            Create free account
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center border border-slate-600 text-slate-200 hover:bg-slate-800 px-4 py-2 rounded-lg"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}

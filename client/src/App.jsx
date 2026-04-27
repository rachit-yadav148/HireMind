import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import posthog from "./posthog";

/* ── Lazy-loaded pages ──────────────────────────────────────────────────── */
// Public pages
const Landing            = lazy(() => import("./pages/Landing"));
const Login              = lazy(() => import("./pages/Login"));
const Register           = lazy(() => import("./pages/Register"));
const ForgotPassword     = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword      = lazy(() => import("./pages/ResetPassword"));

// Dashboard pages — none of these are loaded until /dashboard is visited
const Dashboard          = lazy(() => import("./pages/Dashboard"));
const ResumeAnalyzer     = lazy(() => import("./pages/ResumeAnalyzer"));
const InterviewSimulator = lazy(() => import("./pages/InterviewSimulator"));
const QuestionGenerator  = lazy(() => import("./pages/QuestionGenerator"));
const ApplicationTracker = lazy(() => import("./pages/ApplicationTracker"));
const Feedback           = lazy(() => import("./pages/Feedback"));
const Plans              = lazy(() => import("./pages/Plans"));
const TransactionHistory = lazy(() => import("./pages/TransactionHistory"));
const Account            = lazy(() => import("./pages/Account"));

/* ── Minimal full-screen loader shown during chunk download ─────────────── */
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617]">
      <div className="flex flex-col items-center gap-4">
        {/* Animated logo mark */}
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-2 border-brand-500/30" />
          <div className="absolute inset-0 rounded-full border-2 border-t-brand-400 border-r-fuchsia-400 border-b-transparent border-l-transparent animate-spin" />
        </div>
        <p className="text-xs text-slate-600 font-medium tracking-widest uppercase">HireMind</p>
      </div>
    </div>
  );
}

/* ── Posthog pageview tracker ───────────────────────────────────────────── */
function PostHogPageviewTracker() {
  const location = useLocation();
  useEffect(() => {
    posthog.capture("$pageview", {
      $current_url: `${window.location.origin}${location.pathname}${location.search}${location.hash}`,
      path: location.pathname,
    });
  }, [location.pathname, location.search, location.hash]);
  return null;
}

export default function App() {
  return (
    <>
      <PostHogPageviewTracker />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/"                element={<Landing />} />
          <Route path="/resume"          element={<ResumeAnalyzer />} />
          <Route path="/interview"       element={<InterviewSimulator />} />
          <Route path="/login"           element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password"  element={<ResetPassword />} />
          <Route path="/register"        element={<Register />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index                      element={<Dashboard />} />
            <Route path="resume"              element={<ResumeAnalyzer />} />
            <Route path="interview"           element={<InterviewSimulator />} />
            <Route path="questions"           element={<QuestionGenerator />} />
            <Route path="applications"        element={<ApplicationTracker />} />
            <Route path="feedback"            element={<Feedback />} />
            <Route path="plans"               element={<Plans />} />
            <Route path="transactions"        element={<TransactionHistory />} />
            <Route path="account"             element={<Account />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}

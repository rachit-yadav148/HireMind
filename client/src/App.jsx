import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import ResumeAnalyzer from "./pages/ResumeAnalyzer";
import InterviewSimulator from "./pages/InterviewSimulator";
import QuestionGenerator from "./pages/QuestionGenerator";
import ApplicationTracker from "./pages/ApplicationTracker";
import Feedback from "./pages/Feedback";
import Plans from "./pages/Plans";
import posthog from "./posthog";

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
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/resume" element={<ResumeAnalyzer />} />
        <Route path="/interview" element={<InterviewSimulator />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="resume" element={<ResumeAnalyzer />} />
          <Route path="interview" element={<InterviewSimulator />} />
          <Route path="questions" element={<QuestionGenerator />} />
          <Route path="applications" element={<ApplicationTracker />} />
          <Route path="feedback" element={<Feedback />} />
          <Route path="plans" element={<Plans />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

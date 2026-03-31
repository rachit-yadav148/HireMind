import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import ResumeAnalyzer from "./pages/ResumeAnalyzer";
import InterviewSimulator from "./pages/InterviewSimulator";
import QuestionGenerator from "./pages/QuestionGenerator";
import ApplicationTracker from "./pages/ApplicationTracker";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
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
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

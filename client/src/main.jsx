import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { LazyMotion, domAnimation } from "framer-motion";
import { AuthProvider } from "./context/AuthContext";
import { CreditProvider } from "./context/CreditContext";
import App from "./App";
import "./index.css";
import "./posthog";

// Fire a warmup ping immediately — defeats Render free-tier cold start
// (server spins down after ~15 min idle and takes ~50s to wake on first request)
try {
  const configured = String(import.meta.env.VITE_API_PROXY || "").trim();
  const base = configured
    ? configured.replace(/\/+$/, "").replace(/\/api$/i, "") + "/api"
    : "/api";
  fetch(`${base}/health`, { method: "GET", cache: "no-store" }).catch(() => {});
} catch (_) {}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <LazyMotion features={domAnimation}>
        <AuthProvider>
          <CreditProvider>
            <App />
          </CreditProvider>
        </AuthProvider>
      </LazyMotion>
    </BrowserRouter>
  </React.StrictMode>
);

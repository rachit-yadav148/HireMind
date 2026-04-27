import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = env.VITE_API_PROXY || "http://127.0.0.1:5000";

  return {
    plugins: [react()],

    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },

    build: {
      // Raise warning threshold slightly (after splitting it'll be well under)
      chunkSizeWarningLimit: 400,

      rollupOptions: {
        output: {
          manualChunks(id) {
            // ── Vendor splits (cached separately by the browser) ──────────
            if (id.includes("node_modules/framer-motion")) return "vendor-framer";
            if (id.includes("node_modules/react-dom"))     return "vendor-react";
            if (id.includes("node_modules/react/"))        return "vendor-react";
            if (id.includes("node_modules/react-router"))  return "vendor-router";
            if (id.includes("node_modules/lucide-react"))  return "vendor-lucide";
            if (id.includes("node_modules/posthog-js"))    return "vendor-posthog";
            if (id.includes("node_modules/axios"))         return "vendor-axios";
            if (id.includes("node_modules/@mediapipe"))    return "vendor-mediapipe";

            // ── Page-level splits (lazy-loaded on navigation) ─────────────
            if (id.includes("src/pages/Landing"))              return "page-landing";
            if (id.includes("src/pages/Login"))                return "page-auth";
            if (id.includes("src/pages/Register"))             return "page-auth";
            if (id.includes("src/pages/ForgotPassword"))       return "page-auth";
            if (id.includes("src/pages/ResetPassword"))        return "page-auth";
            if (id.includes("src/pages/Dashboard"))            return "page-dashboard";
            if (id.includes("src/pages/ResumeAnalyzer"))       return "page-resume";
            if (id.includes("src/pages/InterviewSimulator"))   return "page-interview";
            if (id.includes("src/pages/QuestionGenerator"))    return "page-questions";
            if (id.includes("src/pages/ApplicationTracker"))   return "page-applications";
            if (id.includes("src/pages/Plans"))                return "page-plans";
            if (id.includes("src/pages/TransactionHistory"))   return "page-transactions";
            if (id.includes("src/pages/Account"))              return "page-account";
            if (id.includes("src/pages/Feedback"))             return "page-feedback";
          },
        },
      },
    },
  };
});

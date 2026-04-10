import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import resumeRoutes from "./routes/resumeRoutes.js";
import interviewRoutes from "./routes/interviewRoutes.js";
import questionRoutes from "./routes/questionRoutes.js";
import applicationRoutes from "./routes/applicationRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import feedbackRoutes from "./routes/feedbackRoutes.js";
import trialRoutes from "./routes/trialRoutes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;

function normalizeOrigin(origin) {
  try {
    return new URL(origin).origin;
  } catch {
    return null;
  }
}

function originWithHostname(baseOrigin, nextHostname) {
  try {
    const u = new URL(baseOrigin);
    u.hostname = nextHostname;
    return u.origin;
  } catch {
    return null;
  }
}

function expandOriginVariants(origin) {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return [];

  const u = new URL(normalized);
  const host = u.hostname;
  const variants = new Set([normalized]);

  if (host.startsWith("www.")) {
    const nonWww = originWithHostname(normalized, host.slice(4));
    if (nonWww) variants.add(nonWww);
  } else if (host !== "localhost" && host !== "127.0.0.1") {
    const withWww = originWithHostname(normalized, `www.${host}`);
    if (withWww) variants.add(withWww);
  }

  return [...variants];
}

const configuredClientOrigins = [process.env.CLIENT_URL, ...(process.env.CLIENT_URLS || "").split(",")]
  .map((origin) => origin?.trim())
  .filter(Boolean)
  .flatMap(expandOriginVariants);

const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  ...configuredClientOrigins,
]);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "2mb" }));

app.use("/api/auth", authRoutes);
app.use("/api/resumes", resumeRoutes);
app.use("/api/interviews", interviewRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/trial", trialRoutes);

app.get("/api/health", (_req, res) => res.json({ ok: true, name: "HireMind API" }));

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.message === "Only PDF files are allowed") {
    return res.status(400).json({ message: err.message });
  }
  res.status(500).json({ message: err.message || "Server error" });
});

async function main() {
  console.log("Connecting to MongoDB...");
  await connectDB();
  app.listen(PORT, () => {
    console.log(`HireMind API listening on port ${PORT}`);
  });
}

main().catch((e) => {
  console.error("Startup failed:", e);
  process.exit(1);
});

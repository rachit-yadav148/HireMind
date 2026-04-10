import { Router } from "express";
import * as resume from "../controllers/resumeController.js";
import { authRequired, optionalAuth } from "../middleware/auth.js";
import { ensureTrialIdentity } from "../middleware/trialIdentity.js";
import { uploadResumeAnalysis } from "../middleware/upload.js";

const r = Router();
r.post(
  "/analyze",
  optionalAuth,
  ensureTrialIdentity,
  uploadResumeAnalysis.fields([
    { name: "resume", maxCount: 1 },
    { name: "jobDescription", maxCount: 1 },
  ]),
  resume.analyzeResumeUpload
);
r.use(authRequired);
r.get("/", resume.listResumes);
r.get("/latest", resume.getLatestResumeText);
r.post("/feedback", resume.updateResumeFeedback);

export default r;

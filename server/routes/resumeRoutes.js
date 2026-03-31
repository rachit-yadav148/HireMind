import { Router } from "express";
import * as resume from "../controllers/resumeController.js";
import { authRequired } from "../middleware/auth.js";
import { uploadResumeAnalysis } from "../middleware/upload.js";

const r = Router();
r.use(authRequired);
r.post(
  "/analyze",
  uploadResumeAnalysis.fields([
    { name: "resume", maxCount: 1 },
    { name: "jobDescription", maxCount: 1 },
  ]),
  resume.analyzeResumeUpload
);
r.get("/", resume.listResumes);
r.get("/latest", resume.getLatestResumeText);

export default r;

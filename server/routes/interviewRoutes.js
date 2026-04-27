import { Router } from "express";
import * as interview from "../controllers/interviewController.js";
import { authRequired, optionalAuth } from "../middleware/auth.js";
import { ensureTrialIdentity } from "../middleware/trialIdentity.js";
import { uploadQuestionInterviewContext } from "../middleware/upload.js";
import { requireCredits } from "../middleware/creditCheck.js";

const r = Router();
r.post(
  "/start",
  optionalAuth,
  ensureTrialIdentity,
  requireCredits("ai_interview"),
  uploadQuestionInterviewContext.fields([
    { name: "jobDescription", maxCount: 1 },
    { name: "resume", maxCount: 1 },
  ]),
  interview.startInterview
);
r.post(
  "/start-conversational",
  optionalAuth,
  ensureTrialIdentity,
  requireCredits("ai_interview"),
  uploadQuestionInterviewContext.fields([
    { name: "jobDescription", maxCount: 1 },
    { name: "resume", maxCount: 1 },
  ]),
  interview.startConversationalInterview
);
r.post("/converse", optionalAuth, ensureTrialIdentity, interview.converseInterview);
r.post("/answer", optionalAuth, ensureTrialIdentity, interview.submitAnswer);
r.post("/end", optionalAuth, ensureTrialIdentity, interview.endInterview);
r.use(authRequired);
r.post("/rate", interview.rateInterview);
r.get("/sessions", interview.listSessions);
r.get("/sessions/:id", interview.getSession);

export default r;

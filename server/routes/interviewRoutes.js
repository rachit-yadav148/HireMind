import { Router } from "express";
import * as interview from "../controllers/interviewController.js";
import { authRequired, optionalAuth } from "../middleware/auth.js";
import { uploadQuestionInterviewContext } from "../middleware/upload.js";

const r = Router();
r.post(
  "/start",
  optionalAuth,
  uploadQuestionInterviewContext.fields([
    { name: "jobDescription", maxCount: 1 },
    { name: "resume", maxCount: 1 },
  ]),
  interview.startInterview
);
r.post("/answer", optionalAuth, interview.submitAnswer);
r.post("/end", optionalAuth, interview.endInterview);
r.use(authRequired);
r.post("/rate", interview.rateInterview);
r.get("/sessions", interview.listSessions);
r.get("/sessions/:id", interview.getSession);

export default r;

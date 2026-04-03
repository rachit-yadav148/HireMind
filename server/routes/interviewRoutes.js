import { Router } from "express";
import * as interview from "../controllers/interviewController.js";
import { authRequired } from "../middleware/auth.js";
import { uploadQuestionInterviewContext } from "../middleware/upload.js";

const r = Router();
r.use(authRequired);
r.post(
  "/start",
  uploadQuestionInterviewContext.fields([
    { name: "jobDescription", maxCount: 1 },
    { name: "resume", maxCount: 1 },
  ]),
  interview.startInterview
);
r.post("/answer", interview.submitAnswer);
r.post("/end", interview.endInterview);
r.post("/rate", interview.rateInterview);
r.get("/sessions", interview.listSessions);
r.get("/sessions/:id", interview.getSession);

export default r;

import { Router } from "express";
import * as q from "../controllers/questionController.js";
import { authRequired } from "../middleware/auth.js";
import { uploadQuestionInterviewContext } from "../middleware/upload.js";
import { requireCredits } from "../middleware/creditCheck.js";

const r = Router();
r.use(authRequired);
r.post(
  "/generate",
  requireCredits("question_generator"),
  uploadQuestionInterviewContext.fields([
    { name: "jobDescription", maxCount: 1 },
    { name: "resume", maxCount: 1 },
  ]),
  q.generateBank
);

export default r;

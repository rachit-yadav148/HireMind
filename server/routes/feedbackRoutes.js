import { Router } from "express";
import * as feedback from "../controllers/feedbackController.js";
import { authRequired } from "../middleware/auth.js";

const r = Router();
r.use(authRequired);
r.post("/", feedback.submitFeedback);
r.get("/", feedback.listFeedback);

export default r;

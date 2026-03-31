import { Router } from "express";
import * as analytics from "../controllers/analyticsController.js";
import { authRequired } from "../middleware/auth.js";

const r = Router();
r.get("/", authRequired, analytics.getAnalytics);

export default r;

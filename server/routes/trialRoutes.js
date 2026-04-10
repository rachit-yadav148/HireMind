import { Router } from "express";
import { optionalAuth } from "../middleware/auth.js";
import { ensureTrialIdentity } from "../middleware/trialIdentity.js";
import { getTrialStatus } from "../controllers/trialController.js";

const r = Router();

r.get("/status", optionalAuth, ensureTrialIdentity, getTrialStatus);

export default r;

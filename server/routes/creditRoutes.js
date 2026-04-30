import { Router } from "express";
import * as credit from "../controllers/creditController.js";
import { authRequired } from "../middleware/auth.js";

const r = Router();
r.use(authRequired);
r.get("/status", credit.getStatus);
r.post("/pressure-tab-warning", credit.deductPressureTabWarning);
r.post("/purchase", credit.purchaseCredits);
r.post("/subscribe", credit.subscribe);
r.get("/transactions", credit.getTransactionHistory);

export default r;

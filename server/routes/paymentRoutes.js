import { Router } from "express";
import { authRequired } from "../middleware/auth.js";
import { createOrder, verifyPayment, getPaymentHistory } from "../controllers/paymentController.js";

const router = Router();

router.post("/create-order", authRequired, createOrder);
router.post("/verify", authRequired, verifyPayment);
router.get("/history", authRequired, getPaymentHistory);

export default router;

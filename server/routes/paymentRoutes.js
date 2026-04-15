import { Router } from "express";
import { authRequired } from "../middleware/auth.js";
import { createOrder, verifyPayment, getPaymentHistory, razorpayWebhook } from "../controllers/paymentController.js";

const router = Router();

router.post("/create-order", authRequired, createOrder);
router.post("/verify", authRequired, verifyPayment);
router.post("/webhook", razorpayWebhook); // No auth — Razorpay server-to-server
router.get("/history", authRequired, getPaymentHistory);

export default router;

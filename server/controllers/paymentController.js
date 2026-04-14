import Razorpay from "razorpay";
import crypto from "crypto";
import { activateSubscription, addCredits, getCreditStatus } from "../services/creditService.js";
import CreditTransaction from "../models/CreditTransaction.js";

let razorpay = null;

function getRazorpay() {
  if (!razorpay) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      throw new Error("Razorpay keys not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env");
    }
    razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return razorpay;
}

const PLANS = {
  monthly:          { credits: 300,  price: 249,  label: "Monthly Plan",     durationMonths: 1  },
  quarterly:        { credits: 1000, price: 749,  label: "Quarterly Plan",   durationMonths: 3  },
  half_yearly:      { credits: 2200, price: 1399, label: "Half-Yearly Plan", durationMonths: 6  },
  yearly:           { credits: 5000, price: 2899, label: "Yearly Plan",      durationMonths: 12 },
  unlimited_monthly:{ credits: 2000, price: 1649, label: "Unlimited Monthly",durationMonths: 1  },
};

// POST /api/payments/create-order
export async function createOrder(req, res) {
  try {
    const { planId } = req.body;
    const plan = PLANS[planId];
    if (!plan) {
      return res.status(400).json({ message: "Invalid plan selected" });
    }

    const options = {
      amount: plan.price * 100, // Razorpay expects paise
      currency: "INR",
      receipt: `hiremind_${req.userId}_${planId}_${Date.now()}`,
      notes: {
        userId: req.userId.toString(),
        planId,
        planLabel: plan.label,
      },
    };

    const order = await getRazorpay().orders.create(options);

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      planId,
      planLabel: plan.label,
      credits: plan.credits,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("Razorpay create order error:", err);
    res.status(500).json({ message: "Failed to create payment order" });
  }
}

// POST /api/payments/verify
export async function verifyPayment(req, res) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !planId) {
      return res.status(400).json({ message: "Missing payment verification fields" });
    }

    const plan = PLANS[planId];
    if (!plan) {
      return res.status(400).json({ message: "Invalid plan" });
    }

    // Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Payment verification failed. Invalid signature." });
    }

    // Fetch payment details from Razorpay to double-check
    const payment = await getRazorpay().payments.fetch(razorpay_payment_id);
    if (payment.status !== "captured") {
      return res.status(400).json({ message: "Payment not captured yet" });
    }

    // Activate the subscription / add credits
    const result = await activateSubscription(req.userId, planId, plan.durationMonths);

    // Log the payment transaction
    const status = await getCreditStatus(req.userId);

    await CreditTransaction.create({
      userId: req.userId,
      type: "purchase",
      amount: plan.credits,
      balanceBefore: status.credits - (planId === "unlimited_monthly" ? 0 : plan.credits),
      balanceAfter: status.credits,
      feature: "purchase",
      metadata: {
        subscriptionType: planId,
        description: `${plan.label} purchased via Razorpay`,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        amountPaid: payment.amount / 100,
        currency: payment.currency,
      },
    });

    res.json({
      success: true,
      message: `${plan.label} activated successfully!`,
      credits: status.credits,
      subscriptionType: planId,
    });
  } catch (err) {
    console.error("Payment verification error:", err);
    res.status(500).json({ message: "Payment verification failed" });
  }
}

// GET /api/payments/history
export async function getPaymentHistory(req, res) {
  try {
    const transactions = await CreditTransaction.find({
      userId: req.userId,
      type: "purchase",
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json(transactions);
  } catch (err) {
    console.error("Payment history error:", err);
    res.status(500).json({ message: "Failed to fetch payment history" });
  }
}

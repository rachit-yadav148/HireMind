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
      receipt: `hm_${Date.now()}_${planId}`.slice(0, 40),
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
    let payment = await getRazorpay().payments.fetch(razorpay_payment_id);

    // Razorpay handler fires after authorization. Auto-capture may take a moment.
    // If still "authorized", capture it manually. If "created", retry after a short delay.
    if (payment.status === "authorized") {
      try {
        payment = await getRazorpay().payments.capture(razorpay_payment_id, payment.amount, payment.currency);
      } catch (captureErr) {
        // Capture may fail if Razorpay already auto-captured in the meantime — re-fetch
        console.warn("[PAY] Manual capture failed, re-fetching:", captureErr?.error?.description || captureErr?.message);
        payment = await getRazorpay().payments.fetch(razorpay_payment_id);
      }
    } else if (payment.status === "created") {
      // Payment hasn't been authorized yet — wait briefly and retry
      await new Promise((r) => setTimeout(r, 3000));
      payment = await getRazorpay().payments.fetch(razorpay_payment_id);
      if (payment.status === "authorized") {
        try {
          payment = await getRazorpay().payments.capture(razorpay_payment_id, payment.amount, payment.currency);
        } catch {
          payment = await getRazorpay().payments.fetch(razorpay_payment_id);
        }
      }
    }

    if (payment.status !== "captured") {
      console.error(`[PAY] Payment ${razorpay_payment_id} status is "${payment.status}" — expected "captured"`);
      return res.status(400).json({
        message: `Payment status is "${payment.status}". Please wait a moment and refresh, or contact support.`,
        paymentStatus: payment.status,
      });
    }

    // Prevent duplicate credit grants for the same payment
    const alreadyProcessed = await CreditTransaction.findOne({
      "metadata.razorpayPaymentId": razorpay_payment_id,
    }).lean();
    if (alreadyProcessed) {
      const status = await getCreditStatus(req.userId);
      return res.json({
        success: true,
        message: `${plan.label} already activated!`,
        credits: status.credits,
        subscriptionType: planId,
      });
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
        // Plan
        subscriptionType: planId,
        planLabel:        plan.label,
        planCredits:      plan.credits,
        planPrice:        plan.price,
        description:      `${plan.label} purchased via Razorpay`,

        // Razorpay IDs
        razorpayOrderId:   razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,

        // Amount
        amountPaid: payment.amount / 100,
        currency:   payment.currency,

        // Payment method
        paymentMethod: payment.method,
        bank:          payment.bank          || undefined,
        wallet:        payment.wallet        || undefined,
        vpa:           payment.vpa           || undefined,
        cardNetwork:   payment.card?.network || undefined,
        cardLast4:     payment.card?.last4   || undefined,
        cardIssuer:    payment.card?.issuer_name || undefined,

        // Payer
        payerEmail:   payment.email   || undefined,
        payerContact: payment.contact || undefined,

        paymentStatus: payment.status,
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

// POST /api/payments/webhook — Razorpay server-to-server webhook (safety net)
export async function razorpayWebhook(req, res) {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return res.status(200).json({ status: "webhook_secret_not_configured" });
    }

    const signature = req.headers["x-razorpay-signature"];
    if (!signature) {
      return res.status(400).json({ status: "missing_signature" });
    }

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (expectedSignature !== signature) {
      return res.status(400).json({ status: "invalid_signature" });
    }

    const event = req.body?.event;
    const payment = req.body?.payload?.payment?.entity;

    if (event !== "payment.captured" || !payment) {
      return res.status(200).json({ status: "ignored" });
    }

    const orderId = payment.order_id;
    if (!orderId) {
      return res.status(200).json({ status: "no_order_id" });
    }

    // Check if already processed
    const alreadyProcessed = await CreditTransaction.findOne({
      "metadata.razorpayPaymentId": payment.id,
    }).lean();
    if (alreadyProcessed) {
      return res.status(200).json({ status: "already_processed" });
    }

    // Fetch order to get userId and planId from notes
    const order = await getRazorpay().orders.fetch(orderId);
    const userId = order.notes?.userId;
    const planId = order.notes?.planId;
    const plan = PLANS[planId];

    if (!userId || !plan) {
      console.error(`[WEBHOOK] Missing userId or invalid planId in order ${orderId}`);
      return res.status(200).json({ status: "missing_metadata" });
    }

    await activateSubscription(userId, planId, plan.durationMonths);

    const status = await getCreditStatus(userId);
    await CreditTransaction.create({
      userId,
      type: "purchase",
      amount: plan.credits,
      balanceBefore: status.credits - plan.credits,
      balanceAfter: status.credits,
      feature: "purchase",
      metadata: {
        // Plan
        subscriptionType: planId,
        planLabel:        plan.label,
        planCredits:      plan.credits,
        planPrice:        plan.price,
        description:      `${plan.label} purchased via Razorpay (webhook)`,

        // Razorpay IDs
        razorpayOrderId:   orderId,
        razorpayPaymentId: payment.id,

        // Amount
        amountPaid: payment.amount / 100,
        currency:   payment.currency,

        // Payment method (webhook entity contains same fields)
        paymentMethod: payment.method,
        bank:          payment.bank          || undefined,
        wallet:        payment.wallet        || undefined,
        vpa:           payment.vpa           || undefined,
        cardNetwork:   payment.card?.network || undefined,
        cardLast4:     payment.card?.last4   || undefined,
        cardIssuer:    payment.card?.issuer_name || undefined,

        // Payer
        payerEmail:   payment.email   || undefined,
        payerContact: payment.contact || undefined,

        paymentStatus: payment.status,
        source:        "webhook",
      },
    });

    console.log(`[WEBHOOK] Credits granted for user ${userId}, plan ${planId}, payment ${payment.id}`);
    return res.status(200).json({ status: "credits_granted" });
  } catch (err) {
    console.error("[WEBHOOK] Error:", err);
    return res.status(200).json({ status: "error" });
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

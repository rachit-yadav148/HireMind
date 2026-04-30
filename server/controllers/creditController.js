import {
  getCreditStatus,
  addCredits,
  activateSubscription,
  checkAndDeductCredits,
  CREDIT_COSTS,
} from "../services/creditService.js";
import CreditTransaction from "../models/CreditTransaction.js";

const SUBSCRIPTION_PLANS = {
  monthly: { credits: 300, price: 249, durationMonths: 1 },
  quarterly: { credits: 1000, price: 749, durationMonths: 3 },
  half_yearly: { credits: 2200, price: 1399, durationMonths: 6 },
  yearly: { credits: 5000, price: 2899, durationMonths: 12 },
  unlimited_monthly: { credits: "unlimited", price: 1649, durationMonths: 1 },
};

export async function getStatus(req, res) {
  try {
    const status = await getCreditStatus(req.userId);
    res.json({
      ...status,
      creditCosts: CREDIT_COSTS,
      plans: SUBSCRIPTION_PLANS,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Failed to get credit status" });
  }
}

export async function purchaseCredits(req, res) {
  try {
    const { amount, paymentMethod } = req.body;

    if (!amount || amount <= 0 || amount > 10000) {
      return res.status(400).json({ message: "Invalid credit amount" });
    }

    const result = await addCredits(req.userId, amount, "purchase", {
      paymentMethod,
      description: `Purchased ${amount} credits`,
    });

    res.json({
      success: true,
      creditsAdded: result.creditsAdded,
      newBalance: result.newBalance,
      message: `Successfully purchased ${amount} credits`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Failed to purchase credits" });
  }
}

export async function subscribe(req, res) {
  try {
    const { plan, paymentMethod } = req.body;

    if (!SUBSCRIPTION_PLANS[plan]) {
      return res.status(400).json({ message: "Invalid subscription plan" });
    }

    const planDetails = SUBSCRIPTION_PLANS[plan];
    const result = await activateSubscription(req.userId, plan, planDetails.durationMonths);

    res.json({
      success: true,
      subscriptionType: result.subscriptionType,
      endDate: result.endDate,
      creditsGranted: result.creditsGranted,
      message: `Successfully subscribed to ${plan} plan`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Failed to activate subscription" });
  }
}

/** One credit charged when Pressure mode detects the user left the interview surface (tab/desktop) — called on return. */
export async function deductPressureTabWarning(req, res) {
  try {
    const sid = typeof req.body?.sessionId === "string" ? req.body.sessionId.slice(0, 96) : undefined;
    const result = await checkAndDeductCredits(req.userId, "pressure_tab_warning", {
      ...(sid ? { sessionId: sid } : {}),
      description: "Pressure interview: switched away (tab / desktop / swipe)",
    });
    if (!result.success) {
      return res.status(402).json({
        code: result.reason,
        message: result.message,
        ...(result.creditsAvailable != null ? { creditsAvailable: result.creditsAvailable } : {}),
      });
    }
    res.json({
      success: true,
      creditsDeducted: result.creditsDeducted,
      remainingCredits: result.remainingCredits,
      subscriptionType: result.subscriptionType,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Failed to apply warning credit deduction" });
  }
}

export async function getTransactionHistory(req, res) {
  try {
    const { limit = 50, skip = 0 } = req.query;

    const transactions = await CreditTransaction.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(skip))
      .lean();

    const total = await CreditTransaction.countDocuments({ userId: req.userId });

    res.json({
      transactions,
      total,
      limit: Number(limit),
      skip: Number(skip),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Failed to get transaction history" });
  }
}

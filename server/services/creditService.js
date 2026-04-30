import UserCredit from "../models/UserCredit.js";
import CreditTransaction from "../models/CreditTransaction.js";

const CREDIT_COSTS = {
  resume_analysis: 3,
  ai_interview: 10,
  question_generator: 3,
};

const UNLIMITED_MONTHLY_CAP = 2000;
const FREE_TIER_CREDITS = 38;

export async function ensureUserCredit(userId) {
  let userCredit = await UserCredit.findOne({ userId });
  if (!userCredit) {
    userCredit = await UserCredit.create({
      userId,
      credits: FREE_TIER_CREDITS,
      totalCreditsEarned: FREE_TIER_CREDITS,
    });
  }
  return userCredit;
}

export async function checkAndDeductCredits(userId, feature) {
  const cost = CREDIT_COSTS[feature];
  if (!cost) {
    throw new Error(`Invalid feature: ${feature}`);
  }

  const userCredit = await ensureUserCredit(userId);

  if (userCredit.subscriptionType === "unlimited_monthly") {
    const now = new Date();
    const resetAt = userCredit.unlimitedMonthlyResetAt;

    if (!resetAt || now >= resetAt) {
      userCredit.unlimitedMonthlyUsed = 0;
      const nextReset = new Date(now);
      nextReset.setMonth(nextReset.getMonth() + 1);
      userCredit.unlimitedMonthlyResetAt = nextReset;
    }

    if (userCredit.unlimitedMonthlyUsed + cost > UNLIMITED_MONTHLY_CAP) {
      return {
        success: false,
        reason: "UNLIMITED_CAP_REACHED",
        message: `Monthly unlimited cap of ${UNLIMITED_MONTHLY_CAP} credits reached. Resets on ${userCredit.unlimitedMonthlyResetAt.toLocaleDateString()}.`,
        creditsNeeded: cost,
        creditsAvailable: UNLIMITED_MONTHLY_CAP - userCredit.unlimitedMonthlyUsed,
      };
    }

    userCredit.unlimitedMonthlyUsed += cost;
    userCredit.totalCreditsSpent += cost;
    userCredit.lastCreditUpdate = new Date();
    await userCredit.save();

    await CreditTransaction.create({
      userId,
      type: "deduction",
      amount: cost,
      balanceBefore: UNLIMITED_MONTHLY_CAP - (userCredit.unlimitedMonthlyUsed - cost),
      balanceAfter: UNLIMITED_MONTHLY_CAP - userCredit.unlimitedMonthlyUsed,
      feature,
      metadata: {
        subscriptionType: "unlimited_monthly",
        description: `Unlimited plan usage: ${feature}`,
      },
    });

    return {
      success: true,
      creditsDeducted: cost,
      remainingCredits: UNLIMITED_MONTHLY_CAP - userCredit.unlimitedMonthlyUsed,
      subscriptionType: "unlimited_monthly",
    };
  }

  if (userCredit.credits < cost) {
    return {
      success: false,
      reason: "INSUFFICIENT_CREDITS",
      message: `Not enough credits. Need ${cost}, have ${userCredit.credits}.`,
      creditsNeeded: cost,
      creditsAvailable: userCredit.credits,
    };
  }

  const balanceBefore = userCredit.credits;
  userCredit.credits -= cost;
  userCredit.totalCreditsSpent += cost;
  userCredit.lastCreditUpdate = new Date();
  await userCredit.save();

  await CreditTransaction.create({
    userId,
    type: "deduction",
    amount: cost,
    balanceBefore,
    balanceAfter: userCredit.credits,
    feature,
    metadata: {
      subscriptionType: userCredit.subscriptionType,
      description: `Used ${cost} credits for ${feature}`,
    },
  });

  return {
    success: true,
    creditsDeducted: cost,
    remainingCredits: userCredit.credits,
    subscriptionType: userCredit.subscriptionType,
  };
}

export async function addCredits(userId, amount, type = "purchase", metadata = {}) {
  const userCredit = await ensureUserCredit(userId);
  const balanceBefore = userCredit.credits;

  userCredit.credits += amount;
  userCredit.totalCreditsEarned += amount;
  userCredit.lastCreditUpdate = new Date();
  await userCredit.save();

  await CreditTransaction.create({
    userId,
    type,
    amount,
    balanceBefore,
    balanceAfter: userCredit.credits,
    feature: type === "purchase" ? "purchase" : "bonus",
    metadata,
  });

  return {
    success: true,
    creditsAdded: amount,
    newBalance: userCredit.credits,
  };
}

export async function activateSubscription(userId, subscriptionType, durationMonths) {
  const userCredit = await ensureUserCredit(userId);

  const creditGrants = {
    monthly: 300,
    quarterly: 1000,
    half_yearly: 2200,
    yearly: 5000,
  };

  const now = new Date();
  const endDate = new Date(now);
  endDate.setMonth(endDate.getMonth() + durationMonths);

  userCredit.subscriptionType = subscriptionType;
  userCredit.subscriptionStatus = "active";
  userCredit.subscriptionStartDate = now;
  userCredit.subscriptionEndDate = endDate;

  if (subscriptionType === "unlimited_monthly") {
    userCredit.unlimitedMonthlyUsed = 0;
    const resetAt = new Date(now);
    resetAt.setMonth(resetAt.getMonth() + 1);
    userCredit.unlimitedMonthlyResetAt = resetAt;
  } else {
    const creditsToAdd = creditGrants[subscriptionType] || 0;
    const balanceBefore = userCredit.credits;
    userCredit.credits += creditsToAdd;
    userCredit.totalCreditsEarned += creditsToAdd;

    await CreditTransaction.create({
      userId,
      type: "subscription_grant",
      amount: creditsToAdd,
      balanceBefore,
      balanceAfter: userCredit.credits,
      feature: "purchase",
      metadata: {
        subscriptionType,
        description: `${subscriptionType} subscription activated`,
      },
    });
  }

  userCredit.lastCreditUpdate = new Date();
  await userCredit.save();

  return {
    success: true,
    subscriptionType,
    endDate,
    creditsGranted: subscriptionType === "unlimited_monthly" ? "unlimited" : creditGrants[subscriptionType],
  };
}

export async function getCreditStatus(userId) {
  const userCredit = await ensureUserCredit(userId);

  const status = {
    credits: userCredit.credits,
    subscriptionType: userCredit.subscriptionType,
    subscriptionStatus: userCredit.subscriptionStatus,
    subscriptionEndDate: userCredit.subscriptionEndDate,
    totalEarned: userCredit.totalCreditsEarned,
    totalSpent: userCredit.totalCreditsSpent,
  };

  if (userCredit.subscriptionType === "unlimited_monthly") {
    status.unlimitedMonthlyUsed = userCredit.unlimitedMonthlyUsed;
    status.unlimitedMonthlyRemaining = UNLIMITED_MONTHLY_CAP - userCredit.unlimitedMonthlyUsed;
    status.unlimitedMonthlyResetAt = userCredit.unlimitedMonthlyResetAt;
  }

  return status;
}

export { CREDIT_COSTS, FREE_TIER_CREDITS, UNLIMITED_MONTHLY_CAP };

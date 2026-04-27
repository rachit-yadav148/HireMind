/**
 * One-time script to manually grant credits to a user after a failed payment verification.
 *
 * Usage:
 *   node scripts/grantCredits.js <email> <planId>
 *
 * Example:
 *   node scripts/grantCredits.js user@example.com monthly
 *
 * Valid planIds: monthly (300), quarterly (1000), half_yearly (2200), yearly (5000), unlimited_monthly
 */

import "dotenv/config";
import mongoose from "mongoose";

const PLANS = {
  monthly:     { credits: 300,  label: "Monthly Plan",     durationMonths: 1  },
  quarterly:   { credits: 1000, label: "Quarterly Plan",   durationMonths: 3  },
  half_yearly: { credits: 2200, label: "Half-Yearly Plan", durationMonths: 6  },
  yearly:      { credits: 5000, label: "Yearly Plan",      durationMonths: 12 },
  unlimited_monthly: { credits: 0, label: "Unlimited Monthly", durationMonths: 1 },
};

async function main() {
  const [email, planId] = process.argv.slice(2);

  if (!email || !planId) {
    console.error("Usage: node scripts/grantCredits.js <email> <planId>");
    console.error("Plans:", Object.keys(PLANS).join(", "));
    process.exit(1);
  }

  const plan = PLANS[planId];
  if (!plan) {
    console.error(`Invalid planId "${planId}". Valid: ${Object.keys(PLANS).join(", ")}`);
    process.exit(1);
  }

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    console.error("No MONGODB_URI or MONGO_URI in .env");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB");

  const User = mongoose.connection.collection("users");
  const UserCredit = mongoose.connection.collection("usercredits");

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    console.error(`No user found with email: ${email}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`Found user: ${user.name} (${user.email}), _id: ${user._id}`);

  const now = new Date();
  const endDate = new Date(now);
  endDate.setMonth(endDate.getMonth() + plan.durationMonths);

  const updateDoc = {
    $set: {
      subscriptionType: planId,
      subscriptionStatus: "active",
      subscriptionStartDate: now,
      subscriptionEndDate: endDate,
      lastCreditUpdate: now,
    },
  };

  if (planId === "unlimited_monthly") {
    const resetAt = new Date(now);
    resetAt.setMonth(resetAt.getMonth() + 1);
    updateDoc.$set.unlimitedMonthlyUsed = 0;
    updateDoc.$set.unlimitedMonthlyResetAt = resetAt;
  } else {
    updateDoc.$inc = { credits: plan.credits, totalCreditsEarned: plan.credits };
  }

  const result = await UserCredit.findOneAndUpdate(
    { userId: user._id },
    updateDoc,
    { returnDocument: "after" }
  );

  if (!result) {
    console.error("No UserCredit document found. Creating one...");
    const doc = {
      userId: user._id,
      credits: planId === "unlimited_monthly" ? 38 : plan.credits + 38, // preserve baseline credits for unlimited plan
      totalCreditsEarned: planId === "unlimited_monthly" ? 38 : plan.credits + 38,
      totalCreditsSpent: 0,
      subscriptionType: planId,
      subscriptionStatus: "active",
      subscriptionStartDate: now,
      subscriptionEndDate: endDate,
      lastCreditUpdate: now,
      createdAt: now,
      updatedAt: now,
    };

    if (planId === "unlimited_monthly") {
      const resetAt = new Date(now);
      resetAt.setMonth(resetAt.getMonth() + 1);
      doc.unlimitedMonthlyUsed = 0;
      doc.unlimitedMonthlyResetAt = resetAt;
    }

    await UserCredit.insertOne(doc);
    console.log(
      planId === "unlimited_monthly"
        ? "Created UserCredit with Unlimited Monthly subscription"
        : `Created UserCredit with ${plan.credits + 38} credits`
    );
  } else {
    console.log(
      planId === "unlimited_monthly"
        ? `Updated! Subscription: unlimited_monthly until ${endDate.toISOString()} (cap-backed unlimited active)`
        : `Updated! New balance: ${result.credits} credits`
    );
    if (planId !== "unlimited_monthly") {
      console.log(`Subscription: ${planId} until ${endDate.toISOString()}`);
    }
  }

  await mongoose.disconnect();
  console.log("Done!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import mongoose from "mongoose";

const userCreditSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    credits: { type: Number, default: 38, min: 0 },
    subscriptionType: {
      type: String,
      enum: ["free", "monthly", "quarterly", "half_yearly", "yearly", "unlimited_monthly"],
      default: "free",
    },
    subscriptionStatus: {
      type: String,
      enum: ["active", "expired", "cancelled"],
      default: "active",
    },
    subscriptionStartDate: { type: Date, default: null },
    subscriptionEndDate: { type: Date, default: null },
    unlimitedMonthlyUsed: { type: Number, default: 0 },
    unlimitedMonthlyResetAt: { type: Date, default: null },
    totalCreditsEarned: { type: Number, default: 38 },
    totalCreditsSpent: { type: Number, default: 0 },
    lastCreditUpdate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

userCreditSchema.index({ subscriptionStatus: 1, subscriptionEndDate: 1 });

export default mongoose.model("UserCredit", userCreditSchema);

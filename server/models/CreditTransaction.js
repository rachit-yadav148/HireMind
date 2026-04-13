import mongoose from "mongoose";

const creditTransactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["deduction", "purchase", "bonus", "refund", "subscription_grant"],
      required: true,
    },
    amount: { type: Number, required: true },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    feature: {
      type: String,
      enum: ["resume_analysis", "ai_interview", "question_generator", "purchase", "bonus", "refund"],
      required: true,
    },
    metadata: {
      subscriptionType: String,
      sessionId: String,
      resumeId: String,
      description: String,
    },
  },
  { timestamps: true }
);

creditTransactionSchema.index({ userId: 1, createdAt: -1 });
creditTransactionSchema.index({ type: 1, createdAt: -1 });

export default mongoose.model("CreditTransaction", creditTransactionSchema);

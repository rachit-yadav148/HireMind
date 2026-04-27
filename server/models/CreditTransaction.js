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
      // Plan info
      subscriptionType: String,    // plan key: monthly, quarterly, etc.
      planLabel:        String,    // human-readable: "Monthly Plan"
      planCredits:      Number,    // credits included in the plan
      planPrice:        Number,    // listed price in INR
      description:      String,

      // Session / feature refs
      sessionId: String,
      resumeId:  String,

      // Razorpay identifiers
      razorpayOrderId:   String,
      razorpayPaymentId: String,

      // Amount
      amountPaid: Number,          // actual charged amount (INR)
      currency:   String,          // "INR"

      // Payment method details (from Razorpay payment object)
      paymentMethod: String,       // "upi" | "card" | "netbanking" | "wallet" | "emi" | "paylater"
      bank:          String,       // bank name for netbanking
      wallet:        String,       // wallet name e.g. "paytm"
      vpa:           String,       // UPI VPA e.g. "user@upi"
      cardNetwork:   String,       // "Visa" | "Mastercard" | "RuPay" etc.
      cardLast4:     String,       // last 4 digits of card
      cardIssuer:    String,       // issuing bank name

      // Payer contact (from Razorpay)
      payerEmail:   String,
      payerContact: String,

      // Misc
      source:      String,         // "webhook" if processed via webhook
      paymentStatus: String,       // Razorpay payment status at the time of capture
    },
  },
  { timestamps: true }
);

creditTransactionSchema.index({ userId: 1, createdAt: -1 });
creditTransactionSchema.index({ type: 1, createdAt: -1 });
creditTransactionSchema.index({ "metadata.razorpayPaymentId": 1 }, { unique: true, sparse: true });

export default mongoose.model("CreditTransaction", creditTransactionSchema);

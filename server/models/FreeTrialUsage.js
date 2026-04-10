import mongoose from "mongoose";

const freeTrialUsageSchema = new mongoose.Schema(
  {
    trialId: { type: String, required: true, unique: true, index: true },
    resumeAnalysesUsed: { type: Number, default: 0 },
    interviewTrialUsed: { type: Boolean, default: false },
    interviewSecondsUsed: { type: Number, default: 0 },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("FreeTrialUsage", freeTrialUsageSchema);

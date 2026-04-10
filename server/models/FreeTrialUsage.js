import mongoose from "mongoose";

const freeTrialUsageSchema = new mongoose.Schema(
  {
    trialId: { type: String, required: true, unique: true, index: true },
    resumeAnalysesUsed: { type: Number, default: 0 },
    resumeLastAttemptAt: { type: Date, default: null },
    interviewTrialUsed: { type: Boolean, default: false },
    interviewSecondsUsed: { type: Number, default: 0 },
    interviewLastAttemptAt: { type: Date, default: null },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("FreeTrialUsage", freeTrialUsageSchema);

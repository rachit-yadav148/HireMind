import mongoose from "mongoose";

const resumeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    resumeText: { type: String, default: "" },
    atsScore: { type: Number, default: 0 },
    suggestions: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    feedbackUseful: { type: String, enum: ["yes", "no", null], default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Resume", resumeSchema);

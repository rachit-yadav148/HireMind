import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    feedbackText: { type: String, required: true, trim: true },
    category: { type: String, default: "general" },
  },
  { timestamps: true }
);

export default mongoose.model("Feedback", feedbackSchema);

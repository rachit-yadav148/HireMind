import mongoose from "mongoose";

const interviewSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    company: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true },
    jobContext: { type: String, default: "" }, // Optional JD text to tailor interview questions/feedback
    resumeContext: { type: String, default: "" }, // Optional uploaded/stored resume context
    transcript: [
      {
        stage: { type: String, enum: ["technical", "behavioral", "hr", "complete"] },
        question: String,
        answer: String,
        feedback: String,
      },
    ],
    feedback: { type: mongoose.Schema.Types.Mixed, default: null },
    score: { type: mongoose.Schema.Types.Mixed, default: null },
    userRating: { type: Number, min: 1, max: 5, default: null },
    userRatingAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ["in_progress", "completed"],
      default: "in_progress",
    },
    currentStage: {
      type: String,
      enum: ["technical", "behavioral", "hr"],
      default: "technical",
    },
  },
  { timestamps: true }
);

export default mongoose.model("InterviewSession", interviewSessionSchema);

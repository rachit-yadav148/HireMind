import User from "../models/User.js";
import Resume from "../models/Resume.js";
import InterviewSession from "../models/InterviewSession.js";

export async function getAnalytics(req, res) {
  try {
    const userId = req.userId;
    const [resumesAnalyzed, interviewsCompleted, user] = await Promise.all([
      Resume.countDocuments({ userId }),
      InterviewSession.countDocuments({ userId, status: "completed" }),
      User.findById(userId).select("stats").lean(),
    ]);

    res.json({
      resumesAnalyzed,
      interviewsCompleted,
      questionsGenerated: user?.stats?.questionsGenerated ?? 0,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

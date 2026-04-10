import FreeTrialUsage from "../models/FreeTrialUsage.js";

const FREE_RESUME_ANALYSIS_LIMIT = 1;
const FREE_INTERVIEW_LIMIT_SECONDS = 180;

export async function getTrialStatus(req, res) {
  try {
    if (req.userId) {
      return res.json({
        mode: "authenticated",
        resumeAnalysesLeft: null,
        interviewTrialsLeft: null,
        interviewSecondsLeft: null,
      });
    }

    if (!req.trialId) {
      return res.status(400).json({ message: "Trial identity missing. Refresh and try again." });
    }

    const usage = await FreeTrialUsage.findOneAndUpdate(
      { trialId: req.trialId },
      { $setOnInsert: { trialId: req.trialId }, $set: { lastSeenAt: new Date() } },
      { upsert: true, new: true }
    ).lean();

    const resumeAnalysesUsed = Math.max(0, Number(usage?.resumeAnalysesUsed || 0));
    const interviewTrialUsed = Boolean(usage?.interviewTrialUsed);
    const interviewSecondsUsed = Math.max(0, Math.min(FREE_INTERVIEW_LIMIT_SECONDS, Number(usage?.interviewSecondsUsed || 0)));

    return res.json({
      mode: "guest",
      resumeAnalysesLeft: Math.max(0, FREE_RESUME_ANALYSIS_LIMIT - resumeAnalysesUsed),
      interviewTrialsLeft: interviewTrialUsed ? 0 : 1,
      interviewSecondsLeft: interviewTrialUsed
        ? Math.max(0, FREE_INTERVIEW_LIMIT_SECONDS - interviewSecondsUsed)
        : FREE_INTERVIEW_LIMIT_SECONDS,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to fetch trial status" });
  }
}

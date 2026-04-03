import Feedback from "../models/Feedback.js";

export async function submitFeedback(req, res) {
  try {
    const { feedbackText, category } = req.body;
    if (!feedbackText?.trim()) {
      return res.status(400).json({ message: "Feedback text is required" });
    }
    const feedback = await Feedback.create({
      userId: req.userId,
      feedbackText: feedbackText.trim(),
      category: category || "general",
    });
    res.json({ success: true, feedbackId: feedback._id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

export async function listFeedback(req, res) {
  try {
    const feedbacks = await Feedback.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .lean();
    res.json(feedbacks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

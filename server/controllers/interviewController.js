import fs from "fs";
import pdfParse from "pdf-parse";
import InterviewSession from "../models/InterviewSession.js";
import ResumeModel from "../models/Resume.js";
import FreeTrialUsage from "../models/FreeTrialUsage.js";
import * as gemini from "../services/geminiService.js";

const TOTAL_QUESTIONS = 10;
const FREE_INTERVIEW_LIMIT_SECONDS = 180;

function getStageForQuestionNumber(questionNumber) {
  const pos = ((Math.max(1, Number(questionNumber)) - 1) % 10) + 1;
  if (pos <= 7) return "technical";
  if (pos <= 9) return "behavioral";
  return "hr";
}

function isSoftwareRole(role = "") {
  return /(software|sde|developer|engineer|backend|frontend|full\s*stack|web|app|platform)/i.test(
    String(role || "")
  );
}

function isAnalystRole(role = "") {
  return /(analyst|business\s*analyst|data\s*analyst|product\s*analyst|bi\s*analyst|reporting\s*analyst)/i.test(
    String(role || "")
  );
}

function getTechnicalFocusForQuestion(questionNumber, role = "") {
  let technicalSlots = ["role_specific_technical"];
  if (isSoftwareRole(role)) {
    technicalSlots = [
      "dsa",
      "dsa",
      "projects_experience",
      "oops",
      "dsa",
      "os",
      "dbms",
    ];
  } else if (isAnalystRole(role)) {
    technicalSlots = [
      "sql",
      "basic_excel",
      "resume_projects_experience",
      "sql",
      "analyst_case",
      "basic_excel",
      "sql",
    ];
  }

  const pos = ((Math.max(1, Number(questionNumber)) - 1) % 10) + 1;
  const technicalIndex = Math.min(6, Math.max(0, pos - 1));
  return technicalSlots[technicalIndex] || technicalSlots[0];
}

function normalizeQuestion(raw) {
  if (!raw) return "Can you walk me through one relevant project from your resume?";
  const singleLine = String(raw).replace(/\s+/g, " ").trim();
  const firstSentence = singleLine.split(/[?!.]/)[0]?.trim() || singleLine;
  let q = firstSentence.replace(/^[\d)\-•\s]+/, "").trim();
  if (q.length > 150) q = q.slice(0, 150).trim();
  if (!q.endsWith("?")) q = `${q}?`;
  return q;
}

async function getResumeSnippet(userId) {
  if (!userId) return "";
  const r = await ResumeModel.findOne({ userId }).sort({ createdAt: -1 });
  return r?.resumeText || "";
}

function getSessionAccessQuery(sessionId, userId, trialId) {
  if (userId) {
    return { _id: sessionId, userId };
  }
  if (trialId) {
    return { _id: sessionId, userId: null, trialId };
  }
  return { _id: sessionId, userId: null, trialId: null };
}

async function extractTextFromPdfOrImage(file) {
  const buffer = fs.readFileSync(file.path);
  if (file.mimetype === "application/pdf") {
    const data = await pdfParse(buffer);
    return (data.text || "").trim();
  }
  return gemini.extractTextFromImageDocument(buffer, file.mimetype);
}

function unlinkQuiet(p) {
  if (!p) return;
  try {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {
    /* ignore */
  }
}

function hasMeaningfulAnswer(transcript = []) {
  return transcript.some((entry) => String(entry?.answer || "").trim().length > 0);
}

function buildNoAnswerReport() {
  return {
    interviewScore: 0,
    communicationScore: 0,
    technicalDepth: 0,
    confidenceScore: 0,
    suggestions: ["No valid answers were submitted. Submit at least one complete answer to receive a score."],
  };
}

async function upsertTrialUsage(trialId) {
  if (!trialId) return null;
  return FreeTrialUsage.findOneAndUpdate(
    { trialId },
    { $setOnInsert: { trialId }, $set: { lastSeenAt: new Date() } },
    { upsert: true, new: true }
  );
}

function getTrialSecondsUsedFromSession(session) {
  if (!session?.trialMode || !session?.createdAt) return 0;
  const elapsed = Math.floor((Date.now() - new Date(session.createdAt).getTime()) / 1000);
  if (!Number.isFinite(elapsed) || elapsed < 0) return 0;
  return Math.min(FREE_INTERVIEW_LIMIT_SECONDS, elapsed);
}

async function syncTrialInterviewSeconds(trialId, session) {
  if (!trialId || !session?.trialMode) return;
  const secondsUsed = getTrialSecondsUsedFromSession(session);
  await FreeTrialUsage.findOneAndUpdate(
    { trialId },
    { $max: { interviewSecondsUsed: secondsUsed }, $set: { lastSeenAt: new Date() } },
    { upsert: true }
  );
}

export async function startInterview(req, res) {
  try {
    const { company, role } = req.body;
    if (!company?.trim() || !role?.trim()) {
      return res.status(400).json({ message: "Company and role are required" });
    }

    const jdFile = req.files?.jobDescription?.[0];
    const resumeFile = req.files?.resume?.[0];
    if (!resumeFile) {
      return res.status(400).json({ message: "Resume is required to start interview" });
    }

    const isGuestTrial = !req.userId;
    if (isGuestTrial) {
      if (!req.trialId) {
        return res.status(400).json({ message: "Trial identity missing. Refresh and try again." });
      }
      const usage = await upsertTrialUsage(req.trialId);
      if (usage?.interviewTrialUsed) {
        return res.status(403).json({
          message: "Free AI interview trial already used. Create a free account to continue.",
          code: "FREE_LIMIT_REACHED",
        });
      }
    }

    const jdText = jdFile ? await extractTextFromPdfOrImage(jdFile) : "";
    const uploadedResumeText = resumeFile ? await extractTextFromPdfOrImage(resumeFile) : "";
    const storedResumeText = await getResumeSnippet(req.userId);
    const resumeContextText = uploadedResumeText || storedResumeText;

    const firstQuestionNumber = 1;
    const firstStage = getStageForQuestionNumber(firstQuestionNumber);
    const first = await gemini.generateInterviewQuestions(
      company.trim(),
      role.trim(),
      resumeContextText,
      firstStage,
      [],
      jdText,
      resumeContextText,
      {
        questionNumber: firstQuestionNumber,
        technicalFocus: getTechnicalFocusForQuestion(firstQuestionNumber, role.trim()),
        isSoftwareRole: isSoftwareRole(role.trim()),
        isAnalystRole: isAnalystRole(role.trim()),
      }
    );

    const session = await InterviewSession.create({
      userId: req.userId || null,
      trialId: isGuestTrial ? req.trialId : null,
      trialMode: isGuestTrial,
      trialExpiresAt: isGuestTrial ? new Date(Date.now() + FREE_INTERVIEW_LIMIT_SECONDS * 1000) : null,
      company: company.trim(),
      role: role.trim(),
      jobContext: jdText,
      resumeContext: resumeContextText,
      transcript: [],
      currentStage: firstStage,
      status: "in_progress",
    });

    if (isGuestTrial) {
      await FreeTrialUsage.findOneAndUpdate(
        { trialId: req.trialId },
        {
          $set: {
            interviewTrialUsed: true,
            interviewSecondsUsed: 0,
            lastSeenAt: new Date(),
          },
        },
        { upsert: true }
      );
    }

    res.json({
      sessionId: session._id,
      question: normalizeQuestion(first.question),
      stage: first.stage || firstStage,
      resumeAvailable: Boolean(resumeContextText),
      trialLimitSeconds: isGuestTrial ? FREE_INTERVIEW_LIMIT_SECONDS : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Failed to start interview" });
  } finally {
    // Clean up uploaded JD file (if any)
    unlinkQuiet(req.files?.jobDescription?.[0]?.path);
    unlinkQuiet(req.files?.resume?.[0]?.path);
  }
}

export async function submitAnswer(req, res) {
  try {
    const { sessionId, question, answer } = req.body;
    if (!sessionId || !question) {
      return res.status(400).json({ message: "sessionId and question are required" });
    }

    const session = await InterviewSession.findOne(getSessionAccessQuery(sessionId, req.userId, req.trialId));
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    if (session.status === "completed") {
      return res.status(400).json({ message: "Interview already completed" });
    }

    if (session.trialMode && session.trialExpiresAt && Date.now() >= new Date(session.trialExpiresAt).getTime()) {
      await syncTrialInterviewSeconds(session.trialId, session);
      return res.status(403).json({
        message: "Free AI interview time is over. Create a free account to continue.",
        code: "FREE_LIMIT_REACHED",
      });
    }

    const stage = session.currentStage;
    const resumeText = session.resumeContext || (await getResumeSnippet(req.userId));

    const evaluation = await gemini.evaluateInterviewAnswer(question, answer || "", {
      company: session.company,
      role: session.role,
      stage,
      resumeSnippet: resumeText.slice(0, 3000),
      jobContextSnippet: session.jobContext || "",
    });

    session.transcript.push({
      stage,
      question,
      answer: answer || "",
      feedback: evaluation.feedback,
    });

    const answeredCount = session.transcript.length;
    if (answeredCount >= TOTAL_QUESTIONS) {
      const report = hasMeaningfulAnswer(session.transcript)
        ? await gemini.generateInterviewReport(session.transcript, {
            company: session.company,
            role: session.role,
            jobContextSnippet: session.jobContext || "",
          })
        : buildNoAnswerReport();
      session.feedback = report;
      session.score = {
        interviewScore: report.interviewScore,
        communication: report.communicationScore,
        technicalDepth: report.technicalDepth,
        confidence: report.confidenceScore,
        suggestions: report.suggestions,
      };
      session.status = "completed";
      await session.save();
      return res.json({
        feedback: evaluation.feedback,
        completed: true,
        report: {
          interviewScore: report.interviewScore,
          communicationScore: report.communicationScore,
          technicalDepth: report.technicalDepth,
          confidenceScore: report.confidenceScore,
          suggestions: report.suggestions,
        },
      });
    }

    const nextQuestionNumber = answeredCount + 1;
    const nextStage = getStageForQuestionNumber(nextQuestionNumber);
    session.currentStage = nextStage;
    const nextQ = await gemini.generateInterviewQuestions(
      session.company,
      session.role,
      resumeText,
      nextStage,
      session.transcript,
      session.jobContext || "",
      resumeText,
      {
        questionNumber: nextQuestionNumber,
        technicalFocus: getTechnicalFocusForQuestion(nextQuestionNumber, session.role),
        isSoftwareRole: isSoftwareRole(session.role),
        isAnalystRole: isAnalystRole(session.role),
      }
    );
    await session.save();
    await syncTrialInterviewSeconds(session.trialId, session);
    return res.json({
      feedback: evaluation.feedback,
      completed: false,
      nextQuestion: normalizeQuestion(nextQ.question),
      stage: nextStage,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Failed to process answer" });
  }
}

export async function endInterview(req, res) {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ message: "sessionId is required" });
    }
    const session = await InterviewSession.findOne(getSessionAccessQuery(sessionId, req.userId, req.trialId));
    if (!session) return res.status(404).json({ message: "Session not found" });

    if (session.status === "completed" && session.feedback) {
      const report = session.feedback;
      return res.json({
        completed: true,
        report: {
          interviewScore:
            report.interviewScore ??
            Math.round(
              ((report.communicationScore || 0) +
                (report.technicalDepth || 0) +
                (report.confidenceScore || 0)) /
                3
            ),
          communicationScore: report.communicationScore || 0,
          technicalDepth: report.technicalDepth || 0,
          confidenceScore: report.confidenceScore || 0,
          suggestions: report.suggestions || [],
        },
      });
    }

    const report = hasMeaningfulAnswer(session.transcript)
      ? await gemini.generateInterviewReport(session.transcript, {
          company: session.company,
          role: session.role,
          jobContextSnippet: session.jobContext || "",
        })
      : buildNoAnswerReport();

    session.feedback = report;
    session.score = {
      interviewScore: report.interviewScore,
      communication: report.communicationScore,
      technicalDepth: report.technicalDepth,
      confidence: report.confidenceScore,
      suggestions: report.suggestions,
    };
    session.status = "completed";
    await session.save();
    await syncTrialInterviewSeconds(session.trialId, session);

    return res.json({
      completed: true,
      report: {
        interviewScore: report.interviewScore,
        communicationScore: report.communicationScore,
        technicalDepth: report.technicalDepth,
        confidenceScore: report.confidenceScore,
        suggestions: report.suggestions,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Failed to end interview" });
  }
}

export async function rateInterview(req, res) {
  try {
    const { sessionId, rating } = req.body;
    const parsedRating = Number(rating);
    if (!sessionId) {
      return res.status(400).json({ message: "sessionId is required" });
    }
    if (!Number.isFinite(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ message: "rating must be between 1 and 5" });
    }

    const session = await InterviewSession.findOne({
      _id: sessionId,
      userId: req.userId,
    });
    if (!session) return res.status(404).json({ message: "Session not found" });

    session.userRating = Math.round(parsedRating);
    session.userRatingAt = new Date();
    await session.save();

    return res.json({ success: true, rating: session.userRating });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to save interview rating" });
  }
}

export async function listSessions(req, res) {
  try {
    const list = await InterviewSession.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .select("company role status createdAt score")
      .lean();
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

export async function getSession(req, res) {
  try {
    const s = await InterviewSession.findOne({
      _id: req.params.id,
      userId: req.userId,
    }).lean();
    if (!s) return res.status(404).json({ message: "Not found" });
    res.json(s);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

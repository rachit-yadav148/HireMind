import fs from "fs";
import pdfParse from "pdf-parse";
import InterviewSession from "../models/InterviewSession.js";
import ResumeModel from "../models/Resume.js";
import * as gemini from "../services/geminiService.js";

const STAGES = ["technical", "behavioral", "hr"];
const QUESTIONS_PER_STAGE = 2;

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
  const r = await ResumeModel.findOne({ userId }).sort({ createdAt: -1 });
  return r?.resumeText || "";
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

export async function startInterview(req, res) {
  try {
    const { company, role } = req.body;
    if (!company?.trim() || !role?.trim()) {
      return res.status(400).json({ message: "Company and role are required" });
    }

    const jdFile = req.files?.jobDescription?.[0];
    const resumeFile = req.files?.resume?.[0];
    const jdText = jdFile ? await extractTextFromPdfOrImage(jdFile) : "";
    const uploadedResumeText = resumeFile ? await extractTextFromPdfOrImage(resumeFile) : "";
    const storedResumeText = await getResumeSnippet(req.userId);
    const resumeContextText = uploadedResumeText || storedResumeText;

    const first = await gemini.generateInterviewQuestions(
      company.trim(),
      role.trim(),
      resumeContextText,
      "technical",
      [],
      jdText,
      resumeContextText
    );

    const session = await InterviewSession.create({
      userId: req.userId,
      company: company.trim(),
      role: role.trim(),
      jobContext: jdText,
      resumeContext: resumeContextText,
      transcript: [],
      currentStage: "technical",
      status: "in_progress",
    });

    res.json({
      sessionId: session._id,
      question: normalizeQuestion(first.question),
      stage: first.stage || "technical",
      resumeAvailable: Boolean(resumeContextText),
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

    const session = await InterviewSession.findOne({
      _id: sessionId,
      userId: req.userId,
    });
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    if (session.status === "completed") {
      return res.status(400).json({ message: "Interview already completed" });
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

    const totalInStage = session.transcript.filter((t) => t.stage === stage).length;

    if (totalInStage < QUESTIONS_PER_STAGE) {
      const nextQ = await gemini.generateInterviewQuestions(
        session.company,
        session.role,
        resumeText,
        stage,
        session.transcript,
        session.jobContext || "",
        resumeText
      );
      await session.save();
      return res.json({
        feedback: evaluation.feedback,
        completed: false,
        nextQuestion: normalizeQuestion(nextQ.question),
        stage,
      });
    }

    const stageIndex = STAGES.indexOf(stage);
    if (stageIndex >= STAGES.length - 1) {
      const report = await gemini.generateInterviewReport(session.transcript, {
        company: session.company,
        role: session.role,
        jobContextSnippet: session.jobContext || "",
      });
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

    const nextStage = STAGES[stageIndex + 1];
    session.currentStage = nextStage;
    const nextQ = await gemini.generateInterviewQuestions(
      session.company,
      session.role,
      resumeText,
      nextStage,
      session.transcript,
      session.jobContext || "",
      resumeText
    );
    await session.save();
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
    const session = await InterviewSession.findOne({
      _id: sessionId,
      userId: req.userId,
    });
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

    const report = await gemini.generateInterviewReport(session.transcript, {
      company: session.company,
      role: session.role,
      jobContextSnippet: session.jobContext || "",
    });

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

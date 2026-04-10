import fs from "fs";
import pdfParse from "pdf-parse";
import User from "../models/User.js";
import Resume from "../models/Resume.js";
import FreeTrialUsage from "../models/FreeTrialUsage.js";
import * as gemini from "../services/geminiService.js";

const FREE_RESUME_ANALYSIS_LIMIT = 1;

function buildManualJobContext(body) {
  const lines = [];
  const add = (label, val) => {
    const s = val != null ? String(val).trim() : "";
    if (s) lines.push(`${label}: ${s}`);
  };
  add("Job Title", body.jobTitle);
  add("Employment Type", body.employmentType);
  add("Company Name", body.companyName);
  add("Job Summary", body.jobSummary);
  add("Key Responsibilities", body.keyResponsibilities);
  add("Required Skills", body.requiredSkills);
  return lines.join("\n");
}

async function extractJobDescriptionFileText(file) {
  const buffer = fs.readFileSync(file.path);
  if (file.mimetype === "application/pdf") {
    const data = await pdfParse(buffer);
    return (data.text || "").trim();
  }
  return gemini.extractTextFromJobDescriptionImage(buffer, file.mimetype);
}

function combineJobContext(manualText, fileText) {
  const parts = [];
  if (manualText?.trim()) {
    parts.push(`Structured job details (from form):\n${manualText.trim()}`);
  }
  if (fileText?.trim()) {
    parts.push(`Job description (from uploaded PDF or image):\n${fileText.trim()}`);
  }
  return parts.join("\n\n---\n\n");
}

function unlinkQuiet(p) {
  if (p && fs.existsSync(p)) {
    try {
      fs.unlinkSync(p);
    } catch {
      /* ignore */
    }
  }
}

export async function analyzeResumeUpload(req, res) {
  const resumeFile = req.files?.resume?.[0];
  const jdFile = req.files?.jobDescription?.[0];
  let jdPath = null;

  try {
    if (!resumeFile) {
      return res.status(400).json({ message: "PDF resume file is required" });
    }

    if (!req.userId) {
      if (!req.trialId) {
        return res.status(400).json({ message: "Trial identity missing. Refresh and try again." });
      }

      const usage = await FreeTrialUsage.findOneAndUpdate(
        { trialId: req.trialId },
        { $setOnInsert: { trialId: req.trialId }, $set: { lastSeenAt: new Date() } },
        { upsert: true, new: true }
      );

      if ((usage?.resumeAnalysesUsed || 0) >= FREE_RESUME_ANALYSIS_LIMIT) {
        return res.status(403).json({
          message: "Free resume analysis limit reached. Create a free account to continue.",
          code: "FREE_LIMIT_REACHED",
        });
      }
    }

    if (jdFile) jdPath = jdFile.path;

    const buffer = fs.readFileSync(resumeFile.path);
    const data = await pdfParse(buffer);
    const resumeText = (data.text || "").trim();
    if (!resumeText || resumeText.length < 50) {
      return res.status(400).json({
        message: "Could not extract enough text from resume PDF. Try a text-based PDF.",
      });
    }

    let jdFileText = "";
    if (jdFile) {
      try {
        jdFileText = await extractJobDescriptionFileText(jdFile);
      } catch (e) {
        console.error(e);
        return res.status(400).json({
          message:
            e.message ||
            "Could not read the job description file. Try another PDF or a clear image.",
        });
      }
    }

    const manualText = buildManualJobContext(req.body || {});
    const jobContextText = combineJobContext(manualText, jdFileText);

    const analysis = await gemini.analyzeResume(resumeText, jobContextText);

    let resume = null;
    if (req.userId) {
      resume = await Resume.create({
        userId: req.userId,
        resumeText: resumeText.slice(0, 100000),
        atsScore: analysis.atsScore,
        suggestions: {
          weaknesses: analysis.weaknesses,
          bulletImprovements: analysis.bulletImprovements,
          missingSkills: analysis.missingSkills,
          suggestions: analysis.suggestions,
        },
      });

      await User.findByIdAndUpdate(req.userId, { $push: { resumes: resume._id } });
    } else if (req.trialId) {
      await FreeTrialUsage.findOneAndUpdate(
        { trialId: req.trialId },
        { $inc: { resumeAnalysesUsed: 1 }, $set: { lastSeenAt: new Date() } },
        { upsert: true }
      );
    }

    res.json({
      resumeId: resume?._id || null,
      atsScore: analysis.atsScore,
      weaknesses: analysis.weaknesses,
      bulletImprovements: analysis.bulletImprovements,
      missingSkills: analysis.missingSkills,
      suggestions: analysis.suggestions,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Resume analysis failed" });
  } finally {
    unlinkQuiet(resumeFile?.path);
    unlinkQuiet(jdPath);
  }
}

export async function listResumes(req, res) {
  try {
    const resumes = await Resume.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .select("atsScore createdAt resumeText")
      .lean();
    res.json(
      resumes.map((r) => ({
        id: r._id,
        atsScore: r.atsScore,
        createdAt: r.createdAt,
        preview: (r.resumeText || "").slice(0, 200),
      }))
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

export async function getLatestResumeText(req, res) {
  try {
    const resume = await Resume.findOne({ userId: req.userId }).sort({ createdAt: -1 });
    if (!resume) {
      return res.json({ resumeText: null });
    }
    res.json({ resumeText: resume.resumeText, resumeId: resume._id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

export async function updateResumeFeedback(req, res) {
  try {
    const { resumeId, feedbackUseful } = req.body;
    if (!resumeId || !feedbackUseful || !["yes", "no"].includes(feedbackUseful)) {
      return res.status(400).json({ message: "resumeId and feedbackUseful (yes/no) are required" });
    }
    const resume = await Resume.findOne({ _id: resumeId, userId: req.userId });
    if (!resume) {
      return res.status(404).json({ message: "Resume not found" });
    }
    resume.feedbackUseful = feedbackUseful;
    await resume.save();
    res.json({ success: true, feedbackUseful });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

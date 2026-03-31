import fs from "fs";
import pdfParse from "pdf-parse";
import User from "../models/User.js";
import * as gemini from "../services/geminiService.js";

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

export async function generateBank(req, res) {
  try {
    const { company, role } = req.body;
    if (!company?.trim() || !role?.trim()) {
      return res.status(400).json({ message: "Company and role are required" });
    }

    const jdFile = req.files?.jobDescription?.[0];
    const resumeFile = req.files?.resume?.[0];
    let jdText = "";
    let resumeText = "";
    if (jdFile) {
      jdText = await extractTextFromPdfOrImage(jdFile);
    }
    if (resumeFile) {
      resumeText = await extractTextFromPdfOrImage(resumeFile);
    }

    const bank = await gemini.generateQuestionBank(
      company.trim(),
      role.trim(),
      jdText,
      resumeText
    );
    await User.findByIdAndUpdate(req.userId, {
      $inc: { "stats.questionsGenerated": 1 },
    });
    res.json(bank);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Failed to generate questions" });
  } finally {
    unlinkQuiet(req.files?.jobDescription?.[0]?.path);
    unlinkQuiet(req.files?.resume?.[0]?.path);
  }
}

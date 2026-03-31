/**
 * Google Gemini via official @google/genai SDK (see Gemini API quickstart).
 * Set GEMINI_API_KEY in server/.env — the SDK reads it automatically if you use new GoogleGenAI({}).
 * https://ai.google.dev/gemini-api/docs/quickstart
 */

import { GoogleGenAI, createUserContent, createPartFromText, createPartFromBase64 } from "@google/genai";

/** Default matches current Gemini docs; override with GEMINI_MODEL in .env */
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

let _client = null;

function getClient() {
  if (_client) return _client;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error(
      "GEMINI_API_KEY is not set. Create a key at https://aistudio.google.com/apikey and add it to server/.env"
    );
  }
  _client = new GoogleGenAI({ apiKey: apiKey.trim() });
  return _client;
}

/**
 * @param {string} prompt
 * @param {{ temperature?: number, maxOutputTokens?: number, responseMimeType?: string }} options
 */
async function generateContent(prompt, options = {}) {
  const ai = getClient();
  const config = {
    temperature: options.temperature ?? 0.7,
    maxOutputTokens: options.maxOutputTokens ?? 8192,
  };
  if (options.responseMimeType) {
    config.responseMimeType = options.responseMimeType;
  }

  let response;
  try {
    response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config,
    });
  } catch (err) {
    const msg = err?.message || err?.toString?.() || "Unknown error";
    throw new Error(`Gemini API error: ${msg}`);
  }

  const text = (response?.text ?? "").trim();
  if (!text) {
    const block = response?.promptFeedback?.blockReason;
    const finish = response?.candidates?.[0]?.finishReason;
    const hint = [block && `block: ${block}`, finish && `finish: ${finish}`]
      .filter(Boolean)
      .join("; ");
    throw new Error(
      hint
        ? `Gemini returned no text (${hint}). Try another GEMINI_MODEL in .env.`
        : "Gemini returned no text. Check GEMINI_API_KEY, quotas, and GEMINI_MODEL."
    );
  }
  return text;
}

function extractJson(text) {
  if (!text) return null;
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      /* fall through */
    }
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Extract readable text from an uploaded image document (JPEG/PNG/WebP/GIF).
 * @param {Buffer} buffer
 * @param {string} mimeType
 */
export async function extractTextFromImageDocument(buffer, mimeType) {
  const ai = getClient();
  const base64 = buffer.toString("base64");
  const contents = createUserContent([
    createPartFromText(
      "Extract all readable text from this uploaded document image. Output plain text only. If unreadable, say NO_TEXT_EXTRACTED."
    ),
    createPartFromBase64(base64, mimeType),
  ]);
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents,
    config: { temperature: 0.2, maxOutputTokens: 8192 },
  });
  return (response?.text ?? "").trim();
}

/** Backward-compatible alias used in existing controllers */
export async function extractTextFromJobDescriptionImage(buffer, mimeType) {
  return extractTextFromImageDocument(buffer, mimeType);
}

/**
 * @param {string} resumeText
 * @param {string} [jobContextText] - optional combined manual JD fields + text from uploaded JD file
 * @returns {Promise<{ atsScore: number, weaknesses: string[], bulletImprovements: string[], missingSkills: string[], suggestions: string[] }>}
 */
export async function analyzeResume(resumeText, jobContextText = "") {
  const hasJd = Boolean(jobContextText && jobContextText.trim().length > 0);
  const jdBlock = hasJd
    ? `
Target job / role context (use this to align ATS score, keywords, gaps, and suggestions with the role; if partial, infer reasonably):

---
${jobContextText.trim().slice(0, 42000)}
---
`
    : "";

  const prompt = `You are an expert ATS and resume coach.

${
  hasJd
    ? "The candidate supplied a target job description or structured role details above. Weight the ATS score toward fit for THIS role (skills, title, responsibilities, employment type). Tailor weaknesses, bullet improvements, missing skills, and suggestions to close gaps versus this target. Reference specific JD requirements when relevant."
    : "No target job description was provided. Score using general ATS and professional resume best practices."
}

Analyze the resume text below and respond with ONLY valid JSON (no markdown), shape:
{
  "atsScore": number from 0-100,
  "weaknesses": string array of 3-6 items,
  "bulletImprovements": string array of 3-8 improved bullet examples or tips,
  "missingSkills": string array of skills to add or emphasize,
  "suggestions": string array of 4-8 actionable improvement suggestions
}

${jdBlock}

Resume to analyze:
---
${resumeText.slice(0, 48000)}
---`;

  const raw = await generateContent(prompt, { temperature: 0.4 });
  const parsed = extractJson(raw);
  if (parsed && typeof parsed.atsScore === "number") {
    return {
      atsScore: Math.min(100, Math.max(0, Math.round(parsed.atsScore))),
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
      bulletImprovements: Array.isArray(parsed.bulletImprovements)
        ? parsed.bulletImprovements
        : [],
      missingSkills: Array.isArray(parsed.missingSkills) ? parsed.missingSkills : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    };
  }
  throw new Error("Could not parse resume analysis from AI");
}

/**
 * @param {string} company
 * @param {string} role
 * @param {string} resumeText
 * @param {string} stage - technical | behavioral | hr
 * @param {Array<{question:string,answer:string,feedback:string}>} priorTranscript
 */
export async function generateInterviewQuestions(
  company,
  role,
  resumeText,
  stage = "technical",
  priorTranscript = [],
  jobContextText = "",
  resumeContextText = ""
) {
  const history =
    priorTranscript.length === 0
      ? "None yet."
      : priorTranscript
          .map(
            (t, i) =>
              `Q${i + 1}: ${t.question}\nA: ${t.answer || "(no answer)"}\nFeedback: ${t.feedback || "-"}`
          )
          .join("\n\n");

  const stageGuide = {
    technical:
      "Ask ONE challenging but fair technical question for this role. Reference resume if relevant.",
    behavioral:
      "Ask ONE behavioral interview question (STAR style). Tailor to company values if known.",
    hr: "Ask ONE HR / culture / motivation question appropriate for final stage.",
  };

  const hasJd = Boolean(jobContextText && jobContextText.trim().length > 0);
  const hasResumeContext = Boolean(
    resumeContextText && resumeContextText.trim().length > 0
  );
  const jdBlock = hasJd
    ? `\nTarget job description / role context (use this to align questions with requirements):\n---\n${jobContextText
        .trim()
        .slice(0, 12000)}\n---\n`
    : "";
  const resumeBlock = hasResumeContext
    ? `\nCandidate resume context (uploaded/stored):\n---\n${resumeContextText
        .trim()
        .slice(0, 12000)}\n---\n`
    : "";

  const prompt = `You are a professional interviewer for ${company}, hiring for: ${role}.

Candidate resume summary (may be truncated):
---
${(resumeText || "Not provided.").slice(0, 12000)}
---

Previous exchange:
${history}

Stage: ${stage}. ${stageGuide[stage] || stageGuide.technical}
If both JD requirements and resume strengths/gaps are available, frame questions that test match quality.
STRICT FORMAT RULES:
- Ask exactly ONE question only (not a list, not multi-part).
- Keep it short: max 1 sentence, ideally 12-24 words.
- Do not include sub-questions, bullets, numbering, or explanatory preface.
- End with a single question mark.

${jdBlock}
${resumeBlock}

Respond with ONLY valid JSON:
{
  "question": "the single question to ask",
  "stage": "${stage}"
}`;

  const raw = await generateContent(prompt, { temperature: 0.75 });
  const parsed = extractJson(raw);
  if (parsed?.question) {
    return {
      question: String(parsed.question).trim(),
      stage: parsed.stage || stage,
    };
  }
  throw new Error("Could not parse interview question from AI");
}

/**
 * @param {string} question
 * @param {string} answer
 * @param {{ company: string, role: string, stage: string, resumeSnippet?: string }} context
 */
export async function evaluateInterviewAnswer(question, answer, context = {}) {
  const prompt = `You are evaluating a mock interview answer.

Company: ${context.company || "N/A"}
Role: ${context.role || "N/A"}
Stage: ${context.stage || "general"}
Resume context (optional): ${(context.resumeSnippet || "").slice(0, 4000)}
Job context (optional): ${(context.jobContextSnippet || "").slice(0, 2500)}

Question: ${question}
Candidate answer: ${answer || "(empty or unclear)"}

Respond with ONLY valid JSON:
{
  "feedback": "2-4 sentences of constructive feedback on this answer",
  "readyForNext": true,
  "stageCompleteHint": "optional short note if this stage should end after enough depth"
}`;

  const raw = await generateContent(prompt, { temperature: 0.5 });
  const parsed = extractJson(raw);
  if (parsed?.feedback) {
    return {
      feedback: String(parsed.feedback).trim(),
      readyForNext: parsed.readyForNext !== false,
      stageCompleteHint: parsed.stageCompleteHint || "",
    };
  }
  return {
    feedback: raw.slice(0, 800) || "Good effort. Try to add more specific examples next time.",
    readyForNext: true,
    stageCompleteHint: "",
  };
}

/**
 * @param {string} company
 * @param {string} role
 * @param {string} [jobContextText] optional JD/role context for tailoring questions
 */
export async function generateQuestionBank(
  company,
  role,
  jobContextText = "",
  resumeContextText = ""
) {
  const hasJd = Boolean(jobContextText && jobContextText.trim().length > 0);
  const hasResumeContext = Boolean(
    resumeContextText && resumeContextText.trim().length > 0
  );
  const jdBlock = hasJd
    ? `\nTarget job description / role context (use this to tailor questions):\n---\n${jobContextText
        .trim()
        .slice(0, 24000)}\n---\n`
    : "";
  const resumeBlock = hasResumeContext
    ? `\nCandidate resume context:\n---\n${resumeContextText
        .trim()
        .slice(0, 16000)}\n---\n`
    : "";

  const prompt = `Generate interview prep questions for company "${company}" and role "${role}".

Respond with ONLY valid JSON:
{
  "technical": [
    { "question": "", "shortAnswer": "", "difficulty": "easy|medium|hard" }
  ],
  "behavioral": [
    { "question": "", "answerFramework": "" }
  ],
  "hr": [
    { "question": "", "suggestedAnswer": "" }
  ]
}

If JD and resume are both provided, prioritize questions that test whether the candidate's resume-backed skills meet JD requirements and expose likely gaps.
Include 5 technical, 4 behavioral, 3 HR items. Difficulty must be exactly easy, medium, or hard.
${jdBlock}
${resumeBlock}`;

  const raw = await generateContent(prompt, { temperature: 0.65 });
  const parsed = extractJson(raw);
  if (parsed && (parsed.technical || parsed.behavioral || parsed.hr)) {
    return {
      technical: Array.isArray(parsed.technical) ? parsed.technical : [],
      behavioral: Array.isArray(parsed.behavioral) ? parsed.behavioral : [],
      hr: Array.isArray(parsed.hr) ? parsed.hr : [],
    };
  }
  throw new Error("Could not parse question bank from AI");
}

/**
 * @param {Array<{ stage: string, question: string, answer: string, feedback: string }>} transcript
 * @param {{ company: string, role: string }} meta
 */
export async function generateInterviewReport(transcript, meta = {}) {
  const lines = transcript
    .map(
      (t, i) =>
        `[${t.stage}] Q${i + 1}: ${t.question}\nAnswer: ${t.answer}\nFeedback: ${t.feedback}`
    )
    .join("\n\n");

  const prompt = `Summarize this mock interview for ${meta.company || "the company"} — ${meta.role || "the role"}.

Job context (optional): ${(meta.jobContextSnippet || "").slice(0, 2500)}

Transcript:
${lines.slice(0, 32000)}

Respond with ONLY valid JSON:
{
  "interviewScore": number 0-100,
  "communicationScore": number 0-100,
  "technicalDepth": number 0-100,
  "confidenceScore": number 0-100,
  "suggestions": string array of 4-8 improvement tips
}`;

  const raw = await generateContent(prompt, { temperature: 0.4 });
  const parsed = extractJson(raw);
  if (parsed) {
    const clamp = (n) => Math.min(100, Math.max(0, Math.round(Number(n) || 0)));
    const communicationScore = clamp(parsed.communicationScore);
    const technicalDepth = clamp(parsed.technicalDepth);
    const confidenceScore = clamp(parsed.confidenceScore);
    const derivedOverall = Math.round(
      (communicationScore + technicalDepth + confidenceScore) / 3
    );
    return {
      interviewScore: clamp(parsed.interviewScore ?? derivedOverall),
      communicationScore,
      technicalDepth,
      confidenceScore,
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    };
  }
  throw new Error("Could not parse interview report from AI");
}

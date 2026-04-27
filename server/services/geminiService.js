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

function normalizeList(input) {
  if (!Array.isArray(input)) return [];
  return input
    .map((v) => String(v || "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function isVagueItem(item) {
  const s = String(item || "").trim();
  if (!s) return true;
  if (s.length < 12) return true;

  const lc = s.toLowerCase();
  if (/^\*?\s*tip\s*:?\s*$/i.test(s)) return true;
  if (/^\*?\s*general\s*:?\s*$/i.test(s)) return true;
  if (/(^|\b)(if applicable|etc\.?|and more|generic|various)($|\b)/i.test(lc)) return true;

  return false;
}

function uniqueAndConcrete(list, maxItems) {
  const out = [];
  const seen = new Set();
  for (const raw of normalizeList(list)) {
    if (isVagueItem(raw)) continue;
    const key = raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(raw);
    if (out.length >= maxItems) break;
  }
  return out;
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
  const resumeSnippet = resumeText.slice(0, 48000);
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
    : "No target job description was provided. Infer the most likely role direction from the resume itself and provide resume-grounded, specific guidance only. Do NOT use placeholders like 'if applicable', 'etc', or generic advice disconnected from the candidate's actual content."
}

Analyze the resume text below and respond with ONLY valid JSON (no markdown), shape:
{
  "atsScore": number from 0-100,
  "weaknesses": string array of 3-6 items,
  "bulletImprovements": string array of 3-8 improved bullet examples or tips,
  "missingSkills": string array of skills to add or emphasize,
  "suggestions": string array of 4-8 actionable improvement suggestions
}

Quality constraints:
- Every item must be concrete and tied to observable resume evidence (projects, experience, tools, metrics, wording, section structure).
- Avoid vague filler and avoid one-word items.
- For bulletImprovements, provide rewritten bullet lines or explicit upgrade templates anchored to resume content.
- For missingSkills without JD, include only foundational role-relevant skills strongly implied by the resume's domain; do not add speculative advanced stacks.

${jdBlock}

Resume to analyze:
---
${resumeSnippet}
---`;

  const raw = await generateContent(prompt, { temperature: 0 });
  const parsed = extractJson(raw);
  if (parsed && typeof parsed.atsScore === "number") {
    const cleanedWeaknesses = uniqueAndConcrete(parsed.weaknesses, 6);
    const cleanedBulletImprovements = uniqueAndConcrete(parsed.bulletImprovements, 8);
    const cleanedMissingSkills = uniqueAndConcrete(parsed.missingSkills, 8);
    const cleanedSuggestions = uniqueAndConcrete(parsed.suggestions, 8);

    const fallbackSuggestion =
      "Quantify top project and leadership bullets with measurable impact (%, count, time saved, revenue, users) using action + impact phrasing.";
    const fallbackWeakness =
      "Several bullets are responsibility-heavy and under-quantified; convert them into impact statements with metrics and outcomes.";

    return {
      atsScore: Math.min(100, Math.max(0, Math.round(parsed.atsScore))),
      weaknesses: cleanedWeaknesses.length ? cleanedWeaknesses : [fallbackWeakness],
      bulletImprovements: cleanedBulletImprovements,
      missingSkills: cleanedMissingSkills,
      suggestions: cleanedSuggestions.length ? cleanedSuggestions : [fallbackSuggestion],
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
 * @param {{ questionNumber?: number, technicalFocus?: string, isSoftwareRole?: boolean, isAnalystRole?: boolean }} [questionMeta]
 */
export async function generateInterviewQuestions(
  company,
  role,
  resumeText,
  stage = "technical",
  priorTranscript = [],
  jobContextText = "",
  resumeContextText = "",
  questionMeta = {}
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
      "Ask ONE high-probability technical question most likely in a real interview for this company and role. Reference resume/projects where relevant.",
    behavioral:
      "Ask ONE high-probability behavioral interview question (STAR style) commonly asked for this company-role context.",
    hr: "Ask ONE high-probability HR / culture / motivation question appropriate for final stage and commonly asked in real interviews.",
  };

  const questionNumber = Number(questionMeta?.questionNumber || priorTranscript.length + 1);
  const technicalFocus = questionMeta?.technicalFocus || "";
  const softwareRole = Boolean(questionMeta?.isSoftwareRole);
  const analystRole = Boolean(questionMeta?.isAnalystRole);
  const cyclePosition = (questionNumber - 1) % 10;
  const cycleHint =
    cyclePosition < 7
      ? `Question ${questionNumber}: technical slot in 70/30 plan (7 technical first).`
      : `Question ${questionNumber}: behavioral/HR slot in 70/30 plan (remaining 3 slots).`;

  const softwareTechnicalHint =
    stage === "technical" && softwareRole
      ? `
Software-role technical constraints:
- Ask exactly one focused technical question for this slot focus: ${technicalFocus || "dsa"}.
- Across technical slots in each 10-question cycle, coverage must include DSA, OOP, OS, DBMS, and at least one resume project/experience question.
- DSA should be the most frequent technical type.
- Anchor the question in company + role expectations and candidate resume/JD context.
`
      : "";

  const analystTechnicalHint =
    stage === "technical" && analystRole
      ? `
Analyst-role technical constraints:
- Ask exactly one focused analyst technical question for this slot focus: ${technicalFocus || "sql"}.
- Across technical slots in each 10-question cycle, include SQL, basic Excel, analyst case/problem-solving, and at least one resume project/experience question.
- SQL should be asked most frequently for analyst roles.
- Prefer high-probability patterns commonly asked for this company-role and similar analyst interviews when exact history is unavailable.
- Keep questions practical and job-relevant (query logic, joins/aggregations, Excel formulas/pivots/lookups, metrics interpretation).
- Ground at least one technical slot in the candidate's resume achievements, tools, or projects.
`
      : "";

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
${cycleHint}
Question quality constraints:
- Prioritize questions with highest probability of being asked in real interviews for this company + role.
- Prefer patterns of previously asked interview questions for this company-role pair; if exact history is unavailable, use the closest known company/industry interview patterns.
- Avoid random/trivia-style questions; favor practical, repeatable interview themes.
- If both JD requirements and resume strengths/gaps are available, frame questions that test match quality.
${softwareTechnicalHint}
${analystTechnicalHint}
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

  const raw = await generateContent(prompt, { temperature: 0.45 });
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
 * Conversational interview response for recruiter/pressure modes.
 * The AI acts as a real interviewer having a natural 1-on-1 conversation.
 */
export async function generateConversationalResponse(
  conversationHistory,
  context = {}
) {
  const { company, role, candidateName, resumeSnippet, jobContextSnippet, mode } = context;
  const isPressure = mode === "pressure";
  const isStart = conversationHistory.length === 0;

  const historyText = isStart
    ? "(No conversation yet — this is the very first message of the interview.)"
    : conversationHistory
        .map((m) => `${m.role === "interviewer" ? "Interviewer" : "Candidate"}: ${m.text}`)
        .join("\n\n");

  const questionCount = conversationHistory.filter((m) => m.role === "interviewer").length;

  const prompt = `You are a senior interviewer at ${company || "a top company"} conducting a real interview with ${candidateName || "the candidate"} for the role of "${role || "Software Engineer"}".

MODE: ${isPressure ? "PRESSURE — be firm, strict on time, and professionally stern. Push the candidate hard." : "RECRUITER — be professional, warm but evaluative."}.

═══ CRITICAL RULES ═══
1. You MUST output ONLY what the interviewer would say aloud — plain spoken text.
2. NEVER output JSON, markdown, bullet points, code blocks, or any formatting.
3. NEVER prefix with "Interviewer:" or any label.
4. NEVER reveal you are AI. You are a real hiring manager at ${company || "the company"}.
5. Ask exactly ONE question per response. Never combine multiple questions.
6. Keep responses SHORT — 1-3 sentences max. Real interviewers don't give speeches.
7. EVERY sentence MUST be grammatically complete and end with a period or question mark. NEVER end with an em dash (—), ellipsis (...), comma, or leave any sentence unfinished.
8. After the candidate answers, give a very brief acknowledgement (max 5-7 words like "That's a good point." or "Okay, got it."), then immediately ask the next question.
9. Do NOT start a thought you cannot finish in 1-3 sentences. Be direct and concise.

═══ QUESTION STRATEGY ═══
Follow this question distribution strictly:
- 70% Technical questions: DSA, data structures, algorithms, OOP concepts, DBMS, OS, system design, candidate's resume projects, internship work, tech stack questions, previously asked questions at ${company || "top companies"} for ${role || "this role"}
- 15% Behavioral questions: teamwork, conflict resolution, leadership, challenges faced (STAR format expected)
- 15% HR questions: why this company, career goals, strengths/weaknesses, salary expectations

Question flow order:
1. FIRST question: Ask the candidate to introduce themselves briefly
2. Questions 2-4: Ask about their resume — projects they built, technologies used, challenges faced in those projects, internship experience
3. Questions 5+: Mix of DSA/algorithms, OOP/DBMS/OS concepts, system design (if senior role), behavioral, HR
4. Ask follow-up questions when the candidate's answer is interesting or needs deeper probing
5. Ask questions that ${company || "top companies"} actually ask for ${role || "this role"} in real interviews

${role && /software|developer|engineer|sde|frontend|backend|fullstack|full.stack/i.test(role) ? `
TECH QUESTION TYPES for software roles:
- DSA: Arrays, strings, trees, graphs, DP, sorting, searching, time/space complexity
- OOP: Pillars of OOP, design patterns, SOLID principles, abstraction vs encapsulation
- DBMS: SQL queries, normalization, indexing, ACID properties, joins
- OS: Process vs thread, deadlocks, memory management, scheduling algorithms
- System Design: Design a URL shortener, chat system, etc. (only for experienced candidates)
- Resume Projects: Deep dive into architecture, tech choices, challenges, what they'd do differently
` : ""}
═══ STALLING/NON-ANSWER HANDLING ═══
- Vague answer → push back: "Can you be more specific about that?" or "Walk me through your thought process."
- "I don't know" → acknowledge briefly, move to next question: "No worries, let's move on."
- Rambling → redirect: "That's helpful, but can you get to the key point?"

═══ CONVERSATION SO FAR (${questionCount} questions asked) ═══
${historyText}

═══ CANDIDATE CONTEXT ═══
Resume: ${(resumeSnippet || "Not provided").slice(0, 10000)}
Job Description: ${(jobContextSnippet || "Not provided").slice(0, 5000)}

${isStart ? `THIS IS THE START. Greet ${candidateName || "the candidate"} warmly by name and ask them to briefly introduce themselves. Example: "Hi ${candidateName || "there"}, welcome! Let's get started — could you give me a brief introduction about yourself?"` : ""}
RESPOND NOW as the interviewer (1-3 sentences, plain spoken text only, complete sentences):`;

  return await generateContent(prompt, { temperature: 0.5, maxOutputTokens: 1024 });
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

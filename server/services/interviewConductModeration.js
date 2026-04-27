/**
 * Interview conduct checks: abusive language (regex) + scripted warnings / termination.
 * Supports English, Hindi, and other Indian languages.
 */

/** English profanity & direct insults */
const ENGLISH_ABUSE = [
  /\b(mother\s*f+u*c*k+e*r*|m+f+|mthrfckr)\b/i,
  /\bf+u*c+k+(e+r+|ing|ed)?\b/i,
  /\bs+h+i+t+h+e+a+d+\b/i,
  /\bc+u+n+t+\b/i,
  /\bb+i+t+c+h+\b/i,
  /\ba+s+s+h+o+l+e+\b/i,
  /\bb[a4]s+t[a4]r+d+\b/i,
  /\bd+i+c+k+h+e+a+d+\b/i,
  /\b(you\s+(are\s+)?(a\s+)?(dog|pig)|kill\s+yourself|f+u*c*k\s+(you|off)|go\s+to\s+hell)\b/i,
  /\b(you\s+)?(idiot|moron|pathetic|worthless|useless)\s+(bot|ai|interviewer|machine)\b/i,
];

/** Hindi/Hinglish profanity (Devanagari + Latin transliterations) */
const HINDI_ABUSE = [
  // Devanagari script
  /\b(मादरचोद|माद[ऐअ]रच[ोौ]द|mc|m[a@]d[a@]rch[o0]d)\b/i,
  /\b(भोसड़ी|भ[ोौ]सड़[ीि]|bh[o0]sd[i1]k[e3]?|b[o0]sdk)\b/i,
  /\b(चूतिया|च[ूु]त[िी]य[ाे]|ch[u0]t[i1]y[a@])\b/i,
  /\b(गांड|ग[ाां]न?ड|g[a@][a@]?nd|gaand)\b/i,
  /\b(लौड़[ाे]|l[o0][u0]d[a@e]?|l[o0]wd[a@])\b/i,
  /\b(रंडी|र[ाां]न?ड[ीि]|r[a@]nd[i1]|randi)\b/i,
  /\b(हरामी|हर[ाां]म[ीि]|har[a@]m[i1])\b/i,
  /\b(कुत्त[ाे]|kutt[a@e]|kut+[a@])\b/i,
  /\b(साल[ाे]|s[a@]l[a@e])\b/i,
  /\b(बकवास|bakw[a@]s|bakwaas)\b/i,
  /\b(चुप|chup|shut\s+up)\s+(kar|karo|ho\s+ja)\b/i,
  // Common Hinglish insults
  /\b(teri\s+ma|teri\s+maa|tere\s+baap)\b/i,
  /\b(bhen\s*ch[o0]d|bh[e3]nch[o0]d|bc)\b/i,
  /\b(lund|l[u0]nd)\b/i,
];

/** Punjabi/regional profanity */
const REGIONAL_ABUSE = [
  /\b(bh[e3]nch[o0]d|panchod)\b/i,
  /\b(kamine|kamina|kamini)\b/i,
  /\b(saale|sala)\b/i,
];

const ABUSE_REGEXES = [...ENGLISH_ABUSE, ...HINDI_ABUSE, ...REGIONAL_ABUSE];

export function detectAbusiveLanguage(text) {
  const s = String(text || "").trim().toLowerCase();
  if (!s) return false;
  return ABUSE_REGEXES.some((re) => re.test(s));
}

export const CONDUCT_MESSAGES = {
  abuseWarning:
    "That language is not acceptable. Please remain respectful — I'm warning you once. Answer only what is asked in this interview.",
  abuseTerminated:
    "This behaviour is unacceptable in a professional interview. I'm ending the session now.",
  offTopicWarnings: [
    "Let's stay professional — please answer only what was asked. Jokes and unrelated topics aren't appropriate here; this is an interview.",
    "Please focus on the question under discussion. You need to respond directly to what I'm asking and avoid irrelevant remarks.",
    "I'm reminding you again: answer the interview question directly. Off-topic responses are not acceptable in this setting.",
  ],
  offTopicTerminated:
    "This type of behaviour is not accepted in an interview. I'm ending the session now.",
};

export function buildConductTerminationReport(reason) {
  const isAbuse = reason === "abuse";
  return {
    interviewScore: isAbuse ? 12 : 18,
    communicationScore: isAbuse ? 15 : 22,
    technicalDepth: 12,
    confidenceScore: isAbuse ? 18 : 25,
    suggestions: [
      isAbuse
        ? "Interview ended early due to inappropriate language toward the interviewer."
        : "Interview ended early due to repeated off-topic behaviour after multiple reminders.",
      "Stay focused on each question, remain respectful, and treat practice interviews like real hiring conversations.",
    ],
    conductTermination: true,
    conductReason: reason,
  };
}

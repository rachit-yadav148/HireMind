import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, "..", "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safe = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    cb(null, safe);
  },
});

const JD_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/** Resume (PDF) + optional job description file (PDF or common images) */
export const uploadResumeAnalysis = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === "resume") {
      if (file.mimetype !== "application/pdf") {
        return cb(new Error("Resume must be a PDF file"));
      }
    } else if (file.fieldname === "jobDescription") {
      if (!JD_MIMES.has(file.mimetype)) {
        return cb(
          new Error("Job description must be a PDF or image (JPEG, PNG, WebP, or GIF)")
        );
      }
    } else {
      return cb(new Error("Unexpected file field"));
    }
    cb(null, true);
  },
});

/** Optional JD + optional resume context file for interview/question flows */
export const uploadQuestionInterviewContext = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname !== "jobDescription" && file.fieldname !== "resume") {
      return cb(new Error("Unexpected file field"));
    }
    if (!JD_MIMES.has(file.mimetype)) {
      return cb(
        new Error(
          `${file.fieldname} must be a PDF or image (JPEG, PNG, WebP, or GIF)`
        )
      );
    }
    cb(null, true);
  },
});

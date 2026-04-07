function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";

  return { host, port, user, pass, secure };
}

export function canSendMail() {
  const { host, port, user, pass } = getSmtpConfig();
  return Boolean(host && port && user && pass);
}

async function createTransporter() {
  const { host, port, user, pass, secure } = getSmtpConfig();
  if (!host || !port || !user || !pass) {
    throw new Error("SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.");
  }

  const mod = await import("nodemailer");
  const nodemailer = mod?.default || mod;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

export async function sendPasswordResetEmail({ toEmail, resetUrl }) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const transporter = await createTransporter();

  await transporter.sendMail({
    from,
    to: toEmail,
    subject: "HireMind password reset",
    text: `You requested a password reset. Use this link within 15 minutes: ${resetUrl}`,
    html: `<p>You requested a password reset.</p><p>Use this link within 15 minutes:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
  });
}

export async function sendSignupOtpEmail({ toEmail, otp }) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const transporter = await createTransporter();

  await transporter.sendMail({
    from,
    to: toEmail,
    subject: "HireMind email verification OTP",
    text: `Your HireMind signup OTP is ${otp}. It is valid for 10 minutes.`,
    html: `<p>Your HireMind signup OTP is <b>${otp}</b>.</p><p>It is valid for 10 minutes.</p>`,
  });
}

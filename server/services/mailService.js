function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";

  return { host, port, user, pass, secure };
}

function getResendConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || process.env.SMTP_FROM || process.env.SMTP_USER;
  return { apiKey, from };
}

export function canSendMail() {
  const { host, port, user, pass } = getSmtpConfig();
  return Boolean((host && port && user && pass) || canSendViaResend());
}

function canSendViaResend() {
  const { apiKey, from } = getResendConfig();
  return Boolean(apiKey && from);
}

let _cachedTransporter = null;
let _cachedTransporterKey = "";

async function createTransporter() {
  const { host, port, user, pass, secure } = getSmtpConfig();
  if (!host || !port || !user || !pass) {
    throw new Error("SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.");
  }

  const key = `${host}:${port}:${secure}:${user}`;
  if (_cachedTransporter && _cachedTransporterKey === key) {
    return _cachedTransporter;
  }

  const mod = await import("nodemailer");
  const nodemailer = mod?.default || mod;

  _cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    pool: true,
    maxConnections: 3,
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 10000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS || 5000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 15000),
  });
  _cachedTransporterKey = key;

  return _cachedTransporter;
}

function isTimeoutLikeError(err) {
  const code = String(err?.code || "").toUpperCase();
  const message = String(err?.message || "").toLowerCase();
  return (
    code.includes("TIMEOUT") ||
    code === "ESOCKET" ||
    message.includes("timeout") ||
    message.includes("timed out")
  );
}

function getGmailFallbackConfig() {
  const current = getSmtpConfig();
  if (!String(current.host || "").toLowerCase().includes("gmail.com")) {
    return null;
  }

  if (current.port === 587 && current.secure === false) {
    return { ...current, port: 465, secure: true };
  }
  if (current.port === 465 && current.secure === true) {
    return { ...current, port: 587, secure: false };
  }
  return null;
}

async function sendMailWithConfig(config, payload) {
  const mod = await import("nodemailer");
  const nodemailer = mod?.default || mod;
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 10000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS || 5000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 15000),
  });

  await transporter.sendMail(payload);
}

async function sendMailWithRetry(payload) {
  const transporter = await createTransporter();
  await transporter.sendMail(payload);
}

async function sendMailWithResend(payload) {
  const { apiKey, from } = getResendConfig();
  if (!apiKey || !from) {
    throw new Error("Resend is not configured. Set RESEND_API_KEY and RESEND_FROM.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend API failed (${response.status}): ${body.slice(0, 200)}`);
  }
}

async function sendMailResilient(payload) {
  // Prefer Resend API when configured — it's an HTTP call (~200ms)
  // vs SMTP which needs TCP+TLS+AUTH on every cold connection (~5-20s)
  if (canSendViaResend()) {
    try {
      await sendMailWithResend(payload);
      return;
    } catch (resendErr) {
      console.warn(`[MAIL] Resend API failed (${resendErr?.message || resendErr}). Falling back to SMTP.`);
    }
  }

  try {
    await sendMailWithRetry(payload);
    return;
  } catch (err) {
    const fallback = getGmailFallbackConfig();
    if (fallback && isTimeoutLikeError(err)) {
      try {
        console.warn(
          `[MAIL] Primary SMTP failed (${err?.message || err}). Retrying with Gmail fallback ${fallback.port}/${fallback.secure}.`
        );
        await sendMailWithConfig(fallback, payload);
        return;
      } catch (gmailFallbackErr) {
        err = gmailFallbackErr;
      }
    }

    throw err;
  }
}

export async function sendPasswordResetEmail({ toEmail, resetUrl }) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  await sendMailResilient({
    from,
    to: toEmail,
    subject: "HireMind password reset",
    text: `You requested a password reset. Use this link within 15 minutes: ${resetUrl}`,
    html: `<p>You requested a password reset.</p><p>Use this link within 15 minutes:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
  });
}

export async function sendSignupOtpEmail({ toEmail, otp }) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  await sendMailResilient({
    from,
    to: toEmail,
    subject: "HireMind email verification OTP",
    text: `Your HireMind signup OTP is ${otp}. It is valid for 10 minutes.`,
    html: `<p>Your HireMind signup OTP is <b>${otp}</b>.</p><p>It is valid for 10 minutes.</p>`,
  });
}

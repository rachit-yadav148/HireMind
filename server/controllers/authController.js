import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { canSendMail, sendPasswordResetEmail, sendSignupOtpEmail } from "../services/mailService.js";
import { getCreditStatus, CREDIT_COSTS } from "../services/creditService.js";

const SUBSCRIPTION_PLANS = {
  monthly: { credits: 300, price: 249, durationMonths: 1 },
  quarterly: { credits: 1000, price: 749, durationMonths: 3 },
  half_yearly: { credits: 2200, price: 1399, durationMonths: 6 },
  yearly: { credits: 5000, price: 2899, durationMonths: 12 },
  unlimited_monthly: { credits: "unlimited", price: 1649, durationMonths: 1 },
};

const BCRYPT_SALT_ROUNDS = Math.max(8, Math.min(14, Number(process.env.BCRYPT_SALT_ROUNDS || 10)));

function isEmailOtpVerificationEnabled() {
  return String(process.env.ENABLE_EMAIL_OTP_VERIFICATION || "false").toLowerCase() === "true";
}

function signToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return jwt.sign({ userId: user._id.toString(), email: user.email }, secret, {
    expiresIn: "7d",
  });
}

export async function verifyEmailOtp(req, res) {
  try {
    if (!isEmailOtpVerificationEnabled()) {
      return res.status(400).json({ message: "Email OTP verification is currently disabled." });
    }

    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    console.log(`[OTP] Verify OTP request received for ${normalizedEmail}`);
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or OTP" });
    }
    if (user.isEmailVerified) {
      const token = signToken(user);
      return res.json({
        message: "Email already verified.",
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
        },
      });
    }

    const isValidOtp =
      user.emailOtpHash &&
      user.emailOtpHash === hashEmailOtp(otp) &&
      user.emailOtpExpiresAt &&
      new Date(user.emailOtpExpiresAt).getTime() > Date.now();

    if (!isValidOtp) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    user.isEmailVerified = true;
    user.emailOtpHash = null;
    user.emailOtpExpiresAt = null;
    await user.save();

    const token = signToken(user);
    return res.json({
      message: "Email verified successfully.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to verify OTP" });
  }
}

export async function resendEmailOtp(req, res) {
  try {
    if (!isEmailOtpVerificationEnabled()) {
      return res.status(400).json({ message: "Email OTP verification is currently disabled." });
    }

    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(400).json({ message: "No signup found for this email" });
    }
    if (user.isEmailVerified) {
      return res.status(400).json({ message: "Email already verified" });
    }

    // Prevent resend if the current OTP was generated less than 60 seconds ago
    // This avoids the race condition where the first email is still in transit
    if (
      user.emailOtpExpiresAt &&
      new Date(user.emailOtpExpiresAt).getTime() > Date.now() &&
      new Date(user.emailOtpExpiresAt).getTime() - Date.now() > 9 * 60 * 1000 // created < 60s ago
    ) {
      return res.status(429).json({ message: "Please wait at least 60 seconds before requesting a new OTP." });
    }

    const otp = createEmailOtp();
    user.emailOtpHash = hashEmailOtp(otp);
    user.emailOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await triggerSignupOtpEmail(user.email, otp);

    return res.json({
      message: "OTP resent successfully.",
      ...(process.env.NODE_ENV !== "production" && !canSendMail() ? { devOtp: otp } : {}),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to resend OTP" });
  }
}

function hashResetToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function hashEmailOtp(otp) {
  return crypto.createHash("sha256").update(String(otp)).digest("hex");
}

function createEmailOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

async function triggerSignupOtpEmail(toEmail, otp) {
  console.log(`[OTP] Attempting OTP delivery to ${toEmail}`);

  if (!canSendMail()) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`Signup OTP for ${toEmail}: ${otp}`);
    }
    console.warn(`[OTP] SMTP not configured. OTP email not sent for ${toEmail}`);
    return;
  }

  try {
    await sendSignupOtpEmail({ toEmail, otp });
    console.log(`[OTP] OTP email sent successfully to ${toEmail}`);
  } catch (err) {
    console.error(`[OTP] Failed to send signup OTP email to ${toEmail}:`, err?.message || err);
  }
}

export async function register(req, res) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }
    const normalizedEmail = String(email).toLowerCase().trim();
    const otpEnabled = isEmailOtpVerificationEnabled();
    if (otpEnabled) {
      console.log(`[OTP] Register request received for ${normalizedEmail}`);
    }
    const hashed = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    const existing = await User.findOne({ email: normalizedEmail }).select(
      "name email password isEmailVerified"
    );
    if (existing?.isEmailVerified) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const user =
      existing ||
      new User({
        name: name.trim(),
        email: normalizedEmail,
        password: hashed,
      });

    user.name = name.trim();
    user.email = normalizedEmail;
    user.password = hashed;

    if (otpEnabled) {
      const otp = createEmailOtp();
      const otpHash = hashEmailOtp(otp);
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

      user.isEmailVerified = false;
      user.emailOtpHash = otpHash;
      user.emailOtpExpiresAt = otpExpiresAt;
      await user.save();

      // Fire-and-forget: respond immediately so the user isn't blocked.
      // The 60-second resend cooldown prevents the OTP-overwrite race condition.
      triggerSignupOtpEmail(user.email, otp);

      return res.status(201).json({
        message: "OTP sent to your email. Verify to complete signup.",
        requiresOtp: true,
        email: user.email,
        ...(process.env.NODE_ENV !== "production" && !canSendMail() ? { devOtp: otp } : {}),
      });
    }

    user.isEmailVerified = true;
    user.emailOtpHash = null;
    user.emailOtpExpiresAt = null;
    await user.save();

    const token = signToken(user);
    return res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: "Email already registered" });
    }
    console.error(err);
    res.status(500).json({ message: err.message || "Registration failed" });
  }
}

export async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (user) {
      const resetToken = crypto.randomBytes(32).toString("hex");
      user.resetPasswordTokenHash = hashResetToken(resetToken);
      user.resetPasswordExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await user.save();

      const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
      const resetUrl = `${clientUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(
        user.email
      )}`;
      if (canSendMail()) {
        await sendPasswordResetEmail({
          toEmail: user.email,
          resetUrl,
        });
      } else {
        console.log("Password reset link:", resetUrl);
      }

      if (process.env.NODE_ENV !== "production" && !canSendMail()) {
        return res.json({
          message: "If an account exists with this email, reset instructions have been sent.",
          resetUrl,
        });
      }
    }

    return res.json({
      message: "If an account exists with this email, reset instructions have been sent.",
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to process forgot password" });
  }
}

export async function resetPassword(req, res) {
  try {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword) {
      return res.status(400).json({ message: "Email, token and newPassword are required" });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset link" });
    }

    const tokenHash = hashResetToken(token);
    const validToken =
      user.resetPasswordTokenHash &&
      user.resetPasswordTokenHash === tokenHash &&
      user.resetPasswordExpiresAt &&
      new Date(user.resetPasswordExpiresAt).getTime() > Date.now();

    if (!validToken) {
      return res.status(400).json({ message: "Invalid or expired reset link" });
    }

    user.password = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    user.resetPasswordTokenHash = null;
    user.resetPasswordExpiresAt = null;
    await user.save();

    return res.json({ message: "Password reset successful. Please log in with your new password." });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to reset password" });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }
    const normalizedEmail = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select(
      "name email password isEmailVerified"
    );
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    if (isEmailOtpVerificationEnabled() && !user.isEmailVerified) {
      return res.status(403).json({ message: "Please verify your email with OTP before logging in." });
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const token = signToken(user);
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Login failed" });
  }
}

export async function me(req, res) {
  try {
    const user = await User.findById(req.userId).select("-password").populate("resumes");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      resumeCount: user.resumes?.length ?? 0,
      createdAt: user.createdAt,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// GET /api/auth/bootstrap — returns user + credits in ONE round trip
// Eliminates the sequential auth→credits waterfall on every app load
export async function bootstrap(req, res) {
  try {
    const [user, creditStatus] = await Promise.all([
      User.findById(req.userId).select("-password").populate("resumes"),
      getCreditStatus(req.userId),
    ]);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        resumeCount: user.resumes?.length ?? 0,
        createdAt: user.createdAt,
      },
      credits: {
        ...creditStatus,
        creditCosts: CREDIT_COSTS,
        plans: SUBSCRIPTION_PLANS,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// PUT /api/auth/update-profile
export async function updateProfile(req, res) {
  try {
    const { name } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Name is required" });
    }
    const trimmedName = String(name).trim();
    if (trimmedName.length < 2) {
      return res.status(400).json({ message: "Name must be at least 2 characters" });
    }
    if (trimmedName.length > 60) {
      return res.status(400).json({ message: "Name must be under 60 characters" });
    }
    const user = await User.findByIdAndUpdate(
      req.userId,
      { name: trimmedName },
      { new: true, select: "name email createdAt" }
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Profile updated", user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to update profile" });
  }
}

// PUT /api/auth/change-password
export async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current password and new password are required" });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }
    const user = await User.findById(req.userId).select("password");
    if (!user) return res.status(404).json({ message: "User not found" });

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }
    user.password = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    await user.save();
    res.json({ message: "Password changed successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to change password" });
  }
}

// DELETE /api/auth/account
export async function deleteAccount(req, res) {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ message: "Please confirm with your password" });
    }
    const user = await User.findById(req.userId).select("password");
    if (!user) return res.status(404).json({ message: "User not found" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ message: "Incorrect password" });
    }
    await User.findByIdAndDelete(req.userId);
    res.json({ message: "Account deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to delete account" });
  }
}

import { Router } from "express";
import * as auth from "../controllers/authController.js";
import { authRequired } from "../middleware/auth.js";
import { forgotPasswordRateLimit } from "../middleware/rateLimit.js";

const r = Router();
r.post("/register", auth.register);
r.post("/verify-email-otp", auth.verifyEmailOtp);
r.post("/resend-email-otp", auth.resendEmailOtp);
r.post("/login", auth.login);
r.post("/forgot-password", forgotPasswordRateLimit({ windowMs: 15 * 60 * 1000, max: 5 }), auth.forgotPassword);
r.post("/reset-password", auth.resetPassword);
r.get("/me", authRequired, auth.me);
r.put("/update-profile", authRequired, auth.updateProfile);
r.put("/change-password", authRequired, auth.changePassword);
r.delete("/account", authRequired, auth.deleteAccount);

export default r;

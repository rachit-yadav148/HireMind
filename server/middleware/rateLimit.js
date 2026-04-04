const forgotPasswordBuckets = new Map();

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}

export function forgotPasswordRateLimit(options = {}) {
  const windowMs = Number(options.windowMs || 15 * 60 * 1000);
  const max = Number(options.max || 5);

  return function forgotPasswordRateLimitMiddleware(req, res, next) {
    const now = Date.now();
    const ip = getClientIp(req);
    const email = String(req.body?.email || "").toLowerCase().trim();
    const key = `${ip}:${email || "no-email"}`;

    const current = forgotPasswordBuckets.get(key);
    if (!current || current.resetAt <= now) {
      forgotPasswordBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (current.count >= max) {
      const retryAfterSeconds = Math.ceil((current.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        message: "Too many forgot-password requests. Please try again later.",
      });
    }

    current.count += 1;
    forgotPasswordBuckets.set(key, current);
    return next();
  };
}

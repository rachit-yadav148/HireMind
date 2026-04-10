import jwt from "jsonwebtoken";

function decodeTokenFromHeader(header) {
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  return jwt.verify(token, secret);
}

export function authRequired(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required" });
  }
  try {
    const decoded = decodeTokenFromHeader(header);
    if (!decoded) throw new Error("Invalid or expired token");
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function optionalAuth(req, _res, next) {
  const forceGuest = String(req.headers["x-guest-mode"] || "") === "1";
  if (forceGuest) {
    req.userId = undefined;
    req.userEmail = undefined;
    next();
    return;
  }

  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next();
    return;
  }

  try {
    const decoded = decodeTokenFromHeader(header);
    if (decoded) {
      req.userId = decoded.userId;
      req.userEmail = decoded.email;
    }
  } catch {
    req.userId = undefined;
    req.userEmail = undefined;
  }
  next();
}

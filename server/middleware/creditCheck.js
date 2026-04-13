import { checkAndDeductCredits } from "../services/creditService.js";

export function requireCredits(feature) {
  return async (req, res, next) => {
    if (!req.userId) {
      return next();
    }

    try {
      const result = await checkAndDeductCredits(req.userId, feature);

      if (!result.success) {
        return res.status(402).json({
          message: result.message,
          code: result.reason,
          creditsNeeded: result.creditsNeeded,
          creditsAvailable: result.creditsAvailable,
        });
      }

      req.creditDeduction = result;
      next();
    } catch (err) {
      console.error(`[CREDIT] Error checking credits for ${feature}:`, err);
      res.status(500).json({ message: "Failed to process credit check" });
    }
  };
}

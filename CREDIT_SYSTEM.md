# HireMind Credit System Documentation

## Overview

HireMind implements a comprehensive credit-based quota system to monetize AI-powered features while providing a generous free tier for new users. The system is designed with a 10% profit margin on Gemini API costs and includes abuse prevention mechanisms.

---

## Free Tier

### New User Credits
Every newly registered user receives **38 credits** upon signup, allowing them to:
- **3 Resume Analyses** (9 credits)
- **2 AI Interviews** (20 credits)
- **3 Question Generations** (9 credits)

### Guest Users (Non-Authenticated)
- **1 Resume Analysis** (IP-based trial tracking)
- **1 AI Interview** (180 seconds, IP-based trial tracking)
- **No Question Generator access** (requires authentication)

---

## Credit Costs Per Feature

| Feature | Credits Required | Estimated Gemini Cost |
|---------|------------------|----------------------|
| **Resume Analysis** | 3 credits | ~$0.0017 |
| **AI Interview** | 10 credits | ~$0.0084 |
| **Question Generator** | 3 credits | ~$0.0024 |

---

## Paid Subscription Plans

All plans include a **10% profit margin** over Gemini API costs.

### Standard Plans (Credit-Based)

| Plan | Credits | Price | Duration | Best For |
|------|---------|-------|----------|----------|
| **Monthly** | 300 | $2.99 | 1 month | Light users (~100 resume analyses OR ~30 interviews) |
| **Quarterly** | 1,000 | $8.99 | 3 months | Regular users (~333 resume analyses OR ~100 interviews) ⭐ **BEST VALUE** |
| **Half-Yearly** | 2,200 | $16.99 | 6 months | Active users (~733 resume analyses OR ~220 interviews) |
| **Yearly** | 5,000 | $34.99 | 12 months | Power users (~1,666 resume analyses OR ~500 interviews) |

### Unlimited Plan

| Plan | Monthly Cap | Price | Duration | Best For |
|------|-------------|-------|----------|----------|
| **Unlimited Monthly** | 2,000 credits/month | $19.99 | 1 month (auto-renews) | Heavy users with predictable usage |

**Unlimited Plan Details:**
- **Monthly Cap**: 2,000 credits (prevents abuse and ensures profitability)
- **Auto-Reset**: Cap resets on the same day each month
- **Effective Usage**: ~200 resume analyses OR ~200 interviews OR ~666 question generations per month
- **Overage**: Once cap is reached, user must wait for monthly reset or purchase additional credits

---

## Technical Implementation

### Backend Architecture

#### Models
1. **`UserCredit`** (`server/models/UserCredit.js`)
   - Tracks user credit balance, subscription type, and usage
   - Fields: `credits`, `subscriptionType`, `subscriptionStatus`, `unlimitedMonthlyUsed`, etc.

2. **`CreditTransaction`** (`server/models/CreditTransaction.js`)
   - Logs all credit movements (deductions, purchases, grants, refunds)
   - Enables audit trail and analytics

#### Services
- **`creditService.js`** (`server/services/creditService.js`)
  - `checkAndDeductCredits(userId, feature)`: Validates and deducts credits
  - `addCredits(userId, amount, type)`: Adds credits (purchase/bonus)
  - `activateSubscription(userId, plan, duration)`: Activates paid plans
  - `getCreditStatus(userId)`: Returns current credit balance and subscription info

#### Middleware
- **`creditCheck.js`** (`server/middleware/creditCheck.js`)
  - `requireCredits(feature)`: Middleware to check credits before feature access
  - Returns `402 Payment Required` if insufficient credits
  - Skips check for guest users (uses existing free trial logic)

#### Routes
- **`/api/credits/status`** (GET): Get current credit balance and subscription
- **`/api/credits/purchase`** (POST): Purchase additional credits
- **`/api/credits/subscribe`** (POST): Activate subscription plan
- **`/api/credits/transactions`** (GET): View transaction history

### Frontend Components

1. **`CreditQuotaModal.jsx`**
   - Displays when user runs out of credits
   - Shows all available subscription plans
   - Handles plan selection (payment integration pending)

2. **`CreditDisplay.jsx`**
   - Shows current credit balance in sidebar and mobile header
   - Displays subscription type badge
   - Shows unlimited plan monthly usage/remaining

### Integration Points

#### Resume Analyzer
- Credit check middleware applied to `/api/resumes/analyze`
- Modal shown on `INSUFFICIENT_CREDITS` or `UNLIMITED_CAP_REACHED` error
- Guest users continue using IP-based free trial logic

#### Interview Simulator
- Credit check middleware applied to `/api/interviews/start`
- Modal shown on credit exhaustion
- Guest users continue using IP-based free trial logic

#### Question Generator
- Credit check middleware applied to `/api/questions/generate`
- Modal shown on credit exhaustion
- **Requires authentication** (no guest access)

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INSUFFICIENT_CREDITS` | 402 | User doesn't have enough credits for the feature |
| `UNLIMITED_CAP_REACHED` | 402 | Unlimited plan monthly cap reached |
| `FREE_LIMIT_REACHED` | 403 | Guest user free trial exhausted |

---

## Pricing Calculation Methodology

### Gemini API Costs (2.5 Flash Model)
- **Input tokens**: $0.075 per 1M tokens
- **Output tokens**: $0.30 per 1M tokens

### Feature Cost Breakdown

#### Resume Analysis
- **Input**: ~15,000 tokens (resume + JD + prompt)
- **Output**: ~2,000 tokens (analysis JSON)
- **Cost**: (15,000 × $0.075 / 1M) + (2,000 × $0.30 / 1M) = **$0.0017**
- **Credit Cost**: 3 credits
- **Per-credit value**: $0.00057

#### AI Interview (10 Q&A + Report)
- **Input**: ~80,000 tokens (context + questions + answers)
- **Output**: ~8,000 tokens (feedback + report)
- **Cost**: (80,000 × $0.075 / 1M) + (8,000 × $0.30 / 1M) = **$0.0084**
- **Credit Cost**: 10 credits
- **Per-credit value**: $0.00084

#### Question Generator
- **Input**: ~20,000 tokens (company + role + JD + resume)
- **Output**: ~3,000 tokens (question bank JSON)
- **Cost**: (20,000 × $0.075 / 1M) + (3,000 × $0.30 / 1M) = **$0.0024**
- **Credit Cost**: 3 credits
- **Per-credit value**: $0.0008

### Subscription Pricing (10% Margin)

**Monthly Plan Example:**
- 300 credits ≈ 100 resume analyses
- Gemini cost: 100 × $0.0017 = $0.17
- Mixed usage cost estimate: ~$2.72
- **Price with 10% margin**: $2.99

**Unlimited Plan:**
- 2,000 credits/month cap
- Worst-case Gemini cost: ~$16.80
- **Price with buffer**: $19.99 (ensures profitability even with heavy interview usage)

---

## Abuse Prevention

### IP-Based Guest Trial Tracking
- Guest users tracked via hashed IP + User-Agent
- Server-side cooldowns (45 seconds between attempts)
- Prevents incognito/browser switching exploits

### Unlimited Plan Cap
- **2,000 credits/month** hard cap
- Prevents API abuse and runaway costs
- Resets monthly, not on-demand

### Transaction Logging
- All credit movements logged in `CreditTransaction` model
- Enables fraud detection and usage analytics

---

## Future Enhancements

### Payment Integration
- Integrate Stripe/Razorpay for subscription payments
- Auto-renewal for unlimited plans
- Proration for plan upgrades/downgrades

### Credit Expiry
- Optional: Credits expire after 12 months (for standard plans)
- Unlimited plan credits don't carry over

### Referral System
- Bonus credits for successful referrals
- Tracked via `CreditTransaction` with type `bonus`

### Usage Analytics Dashboard
- Show users their credit consumption patterns
- Recommend optimal plan based on usage

---

## Environment Variables

Add to `server/.env`:

```bash
# No new environment variables required
# Credit system uses existing database and Gemini API configuration
```

---

## Database Migrations

Run after deployment:

```bash
# No manual migration needed
# UserCredit and CreditTransaction models auto-create on first use
```

---

## Testing Checklist

- [ ] New user receives 38 credits on signup
- [ ] Resume analysis deducts 3 credits
- [ ] AI interview deducts 10 credits
- [ ] Question generator deducts 3 credits
- [ ] Insufficient credits shows modal
- [ ] Unlimited plan respects monthly cap
- [ ] Unlimited plan resets monthly
- [ ] Credit display updates in real-time
- [ ] Transaction history logs all movements
- [ ] Guest users bypass credit checks

---

## Support & Troubleshooting

### User has negative credits
- Check `CreditTransaction` for anomalies
- Manually adjust via `UserCredit.findOneAndUpdate()`

### Unlimited plan not resetting
- Check `unlimitedMonthlyResetAt` field
- Verify server timezone matches expected reset time

### Credits not deducting
- Verify middleware order in routes
- Check `requireCredits()` is placed before controller
- Ensure `req.userId` is set by `authRequired` middleware

---

## Contact

For questions or issues, contact the development team or refer to the main README.

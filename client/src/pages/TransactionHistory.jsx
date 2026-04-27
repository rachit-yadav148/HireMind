import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { api, getApiErrorMessage } from "../services/api";

/* ── Plan config ─────────────────────────────────────────────────────────── */
const PLAN_META = {
  monthly:           { label: "Monthly",          color: "#06b6d4", bg: "rgba(6,182,212,0.12)",  border: "rgba(6,182,212,0.3)"  },
  quarterly:         { label: "Quarterly",         color: "#8b5cf6", bg: "rgba(139,92,246,0.12)", border: "rgba(139,92,246,0.3)" },
  half_yearly:       { label: "Half Yearly",       color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)" },
  yearly:            { label: "Yearly",            color: "#10b981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)" },
  unlimited_monthly: { label: "Unlimited Monthly", color: "#ec4899", bg: "rgba(236,72,153,0.12)", border: "rgba(236,72,153,0.3)" },
};
function planMeta(key) {
  return PLAN_META[key] || { label: key || "Plan", color: "#94a3b8", bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.25)" };
}

/* ── Payment method helpers ──────────────────────────────────────────────── */
const METHOD_META = {
  upi:        { label: "UPI",        icon: "📱", color: "#10b981" },
  card:       { label: "Card",       icon: "💳", color: "#06b6d4" },
  netbanking: { label: "Netbanking", icon: "🏦", color: "#8b5cf6" },
  wallet:     { label: "Wallet",     icon: "👛", color: "#f59e0b" },
  emi:        { label: "EMI",        icon: "📅", color: "#ec4899" },
  paylater:   { label: "Pay Later",  icon: "⏳", color: "#94a3b8" },
};
function methodMeta(key) {
  return METHOD_META[key?.toLowerCase()] || { label: key || "Online", icon: "💰", color: "#94a3b8" };
}

function paymentMethodLabel(m) {
  if (!m.paymentMethod) return null;
  const meta = methodMeta(m.paymentMethod);
  if (m.paymentMethod === "upi" && m.vpa)           return `${meta.icon} UPI · ${m.vpa}`;
  if (m.paymentMethod === "card" && m.cardLast4)    return `${meta.icon} ${m.cardNetwork || "Card"} ···· ${m.cardLast4}${m.cardIssuer ? ` · ${m.cardIssuer}` : ""}`;
  if (m.paymentMethod === "netbanking" && m.bank)   return `${meta.icon} ${m.bank}`;
  if (m.paymentMethod === "wallet" && m.wallet)     return `${meta.icon} ${m.wallet}`;
  return `${meta.icon} ${meta.label}`;
}

/* ── Date format ─────────────────────────────────────────────────────────── */
function formatDate(iso) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase(),
  };
}

/* ── Copy pill ───────────────────────────────────────────────────────────── */
function CopyPill({ value, truncLen = 18 }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="text-slate-600 text-xs font-mono">—</span>;
  const display = value.length > truncLen ? value.slice(0, truncLen) + "…" : value;
  function copy() {
    navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); });
  }
  return (
    <button onClick={copy} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors group font-mono" title={value}>
      <span>{display}</span>
      <span className={`transition-colors duration-200 ${copied ? "text-emerald-400" : "text-slate-600 group-hover:text-slate-400"}`}>
        {copied
          ? <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
        }
      </span>
    </button>
  );
}

/* ── Skeleton ────────────────────────────────────────────────────────────── */
function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-6 py-4 border-b border-white/5 animate-pulse">
      <div className="w-9 h-9 rounded-xl bg-white/5 shrink-0" />
      <div className="flex-1 space-y-2"><div className="h-3 bg-white/6 rounded-full w-32" /><div className="h-2 bg-white/4 rounded-full w-24" /></div>
      <div className="h-5 w-20 bg-white/5 rounded-full" />
      <div className="h-3 w-16 bg-white/4 rounded-full" />
      <div className="h-3 w-24 bg-white/4 rounded-full hidden md:block" />
      <div className="h-3 w-14 bg-white/4 rounded-full" />
    </div>
  );
}

/* ── Detail grid item ────────────────────────────────────────────────────── */
function DetailItem({ label, value, copy = false, color }) {
  return (
    <div>
      <p className="text-[10px] text-slate-600 uppercase tracking-widest font-bold mb-1">{label}</p>
      {copy
        ? <CopyPill value={value} truncLen={22} />
        : <p className="text-sm font-medium capitalize" style={{ color: color || "#cbd5e1" }}>{value || "—"}</p>
      }
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
const container = { hidden: {}, show: { transition: { staggerChildren: 0.055 } } };
const rowAnim   = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] } } };

export default function TransactionHistory() {
  const [txns, setTxns]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [expandedId, setExpanded] = useState(null);

  useEffect(() => {
    api.get("/payments/history")
      .then((r) => setTxns(r.data))
      .catch((e) => setError(getApiErrorMessage(e, "Failed to load payment history")))
      .finally(() => setLoading(false));
  }, []);

  const totalSpent   = txns.reduce((s, t) => s + (t.metadata?.amountPaid || 0), 0);
  const totalCredits = txns.reduce((s, t) => s + (t.amount || 0), 0);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">

      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-2 mb-1 text-sm">
            <Link to="/dashboard" className="text-slate-500 hover:text-slate-300 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <Link to="/dashboard" className="text-slate-500 hover:text-slate-300 transition-colors">Dashboard</Link>
            <span className="text-slate-700">/</span>
            <span className="text-slate-300 font-medium">Payment History</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-white">Payment History</h1>
          <p className="text-slate-500 text-sm mt-0.5">All your plan purchases and credit grants</p>
        </div>
        <Link to="/dashboard/plans"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-fuchsia-500 text-white font-semibold text-sm shadow-glow hover:shadow-glow-lg transition-shadow duration-200 self-start sm:self-auto whitespace-nowrap"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Upgrade plan
        </Link>
      </motion.div>

      {/* ── Summary stats ── */}
      {!loading && !error && txns.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.38 }}
          className="grid grid-cols-3 gap-4"
        >
          {[
            { label: "Total Purchases",  value: txns.length,                               color: "#8b5cf6", icon: "🛒" },
            { label: "Total Paid",       value: `₹${totalSpent.toLocaleString("en-IN")}`,  color: "#06b6d4", icon: "💳" },
            { label: "Credits Received", value: `${totalCredits.toLocaleString("en-IN")}`, color: "#10b981", icon: "⚡", suffix: " credits" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/8 p-4 sm:p-5"
              style={{ background: "rgba(10,16,30,0.7)", backdropFilter: "blur(16px)" }}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-base">{s.icon}</span>
                <span className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold hidden sm:inline">{s.label}</span>
              </div>
              <p className="font-display text-xl sm:text-2xl font-bold" style={{ color: s.color }}>
                {s.value}
                {s.suffix && <span className="text-sm font-medium text-slate-400">{s.suffix}</span>}
              </p>
              <p className="text-[10px] text-slate-600 mt-0.5 sm:hidden">{s.label}</p>
            </div>
          ))}
        </motion.div>
      )}

      {/* ── Main card ── */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.13, duration: 0.42 }}
        className="rounded-2xl border border-white/8 overflow-hidden"
        style={{ background: "rgba(10,16,30,0.7)", backdropFilter: "blur(16px)" }}
      >
        {/* Table header */}
        {!loading && txns.length > 0 && (
          <div className="hidden md:grid grid-cols-[2.2fr_1.1fr_0.9fr_1.3fr_1.1fr_1fr] gap-3 px-6 py-3 border-b border-white/5
                          text-[10px] text-slate-600 uppercase tracking-widest font-bold">
            <span>Plan</span>
            <span>Amount Paid</span>
            <span>Credits</span>
            <span>Payment Method</span>
            <span>Payment ID</span>
            <span>Date & Time</span>
          </div>
        )}

        {loading && Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}

        {!loading && error && (
          <div className="flex flex-col items-center py-20 text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-red-400 font-semibold">{error}</p>
          </div>
        )}

        {!loading && !error && txns.length === 0 && (
          <div className="flex flex-col items-center py-20 text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center mb-5 text-3xl">🧾</div>
            <h3 className="text-white font-semibold text-lg mb-1">No purchases yet</h3>
            <p className="text-slate-500 text-sm max-w-xs mb-6">Upgrade to unlock more credits and features.</p>
            <Link to="/dashboard/plans"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-fuchsia-500 text-white font-semibold text-sm shadow-glow hover:shadow-glow-lg transition-shadow duration-200"
            >
              View plans
            </Link>
          </div>
        )}

        {!loading && !error && txns.length > 0 && (
          <motion.div variants={container} initial="hidden" animate="show">
            {txns.map((t) => {
              const pm       = planMeta(t.metadata?.subscriptionType);
              const mm       = methodMeta(t.metadata?.paymentMethod);
              const { date, time } = formatDate(t.createdAt);
              const isOpen   = expandedId === t._id;
              const paid     = t.metadata?.amountPaid;
              const currency = t.metadata?.currency || "INR";
              const methodStr = paymentMethodLabel(t.metadata);

              return (
                <motion.div key={t._id} variants={rowAnim}>
                  {/* ── Desktop row ── */}
                  <button
                    onClick={() => setExpanded(isOpen ? null : t._id)}
                    className="hidden md:grid grid-cols-[2.2fr_1.1fr_0.9fr_1.3fr_1.1fr_1fr] gap-3 items-center w-full
                               px-6 py-4 border-b border-white/5 hover:bg-white/[0.025] transition-colors duration-150 text-left group"
                  >
                    {/* Plan */}
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold"
                        style={{ background: pm.bg, border: `1px solid ${pm.border}`, color: pm.color }}>
                        ⚡
                      </div>
                      <div>
                        <p className="text-white text-sm font-semibold leading-tight">
                          {t.metadata?.planLabel || pm.label + " Plan"}
                        </p>
                        <p className="text-slate-600 text-[11px] mt-0.5">
                          {t.metadata?.planCredits ? `${t.metadata.planCredits} credits` : "Credit purchase"}
                          {t.metadata?.planPrice ? ` · Listed ₹${t.metadata.planPrice}` : ""}
                        </p>
                      </div>
                    </div>

                    {/* Amount */}
                    <div>
                      {paid != null
                        ? <p className="text-white text-sm font-bold">{currency === "INR" ? "₹" : currency + " "}{paid.toLocaleString("en-IN")}</p>
                        : <span className="text-slate-600 text-sm">—</span>
                      }
                      <p className="text-slate-600 text-[10px] mt-0.5 uppercase">{currency}</p>
                    </div>

                    {/* Credits */}
                    <div>
                      <p className="font-bold text-sm" style={{ color: pm.color }}>+{t.amount}</p>
                      <p className="text-slate-600 text-[10px] mt-0.5">credits</p>
                    </div>

                    {/* Payment method */}
                    <div>
                      {methodStr
                        ? <p className="text-slate-300 text-xs font-medium">{methodStr}</p>
                        : <span className="text-slate-600 text-xs">—</span>
                      }
                      {t.metadata?.payerEmail && (
                        <p className="text-slate-600 text-[10px] mt-0.5 truncate max-w-[140px]">{t.metadata.payerEmail}</p>
                      )}
                    </div>

                    {/* Payment ID */}
                    <div onClick={(e) => e.stopPropagation()}>
                      <CopyPill value={t.metadata?.razorpayPaymentId} truncLen={14} />
                    </div>

                    {/* Date */}
                    <div className="text-right">
                      <p className="text-slate-300 text-xs font-medium">{date}</p>
                      <p className="text-slate-600 text-[10px] mt-0.5">{time}</p>
                    </div>
                  </button>

                  {/* ── Expanded detail panel ── */}
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div key="detail"
                        initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="hidden md:block px-6 py-5 border-b border-white/5"
                          style={{ background: "rgba(255,255,255,0.025)" }}
                        >
                          <p className="text-[10px] text-slate-600 uppercase tracking-widest font-bold mb-4">Full Transaction Details</p>
                          <div className="grid grid-cols-4 gap-x-6 gap-y-5">
                            <DetailItem label="Razorpay Payment ID" value={t.metadata?.razorpayPaymentId} copy />
                            <DetailItem label="Razorpay Order ID"   value={t.metadata?.razorpayOrderId}   copy />
                            <DetailItem label="Payment Status"      value={t.metadata?.paymentStatus} color="#10b981" />
                            <DetailItem label="Source"              value={t.metadata?.source || "Direct"} />

                            <DetailItem label="Payment Method" value={methodStr} />
                            {t.metadata?.vpa        && <DetailItem label="UPI VPA"       value={t.metadata.vpa}        copy />}
                            {t.metadata?.bank       && <DetailItem label="Bank"          value={t.metadata.bank} />}
                            {t.metadata?.wallet     && <DetailItem label="Wallet"        value={t.metadata.wallet} />}
                            {t.metadata?.cardNetwork && <DetailItem label="Card Network"  value={`${t.metadata.cardNetwork}${t.metadata.cardLast4 ? ` ···· ${t.metadata.cardLast4}` : ""}`} />}
                            {t.metadata?.cardIssuer  && <DetailItem label="Card Issuer"   value={t.metadata.cardIssuer} />}
                            {t.metadata?.payerEmail  && <DetailItem label="Payer Email"   value={t.metadata.payerEmail} />}
                            {t.metadata?.payerContact && <DetailItem label="Payer Phone"  value={t.metadata.payerContact} />}

                            <DetailItem label="Balance Before" value={`${t.balanceBefore} credits`} />
                            <DetailItem label="Balance After"  value={`${t.balanceAfter} credits`} color="#10b981" />
                            <DetailItem label="Listed Price"   value={t.metadata?.planPrice ? `₹${t.metadata.planPrice}` : undefined} />
                            <DetailItem label="Charged Price"  value={paid != null ? `₹${paid.toLocaleString("en-IN")}` : undefined} color="#06b6d4" />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* ── Mobile card — tappable, expands to full details ── */}
                  <div
                    className="md:hidden px-4 py-4 border-b border-white/5 cursor-pointer active:bg-white/[0.03] transition-colors duration-150"
                    onClick={() => setExpanded(isOpen ? null : t._id)}
                  >
                    {/* Row summary */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-base"
                          style={{ background: pm.bg, border: `1px solid ${pm.border}` }}>⚡</div>
                        <div className="min-w-0">
                          <p className="text-white text-sm font-semibold truncate">{t.metadata?.planLabel || pm.label + " Plan"}</p>
                          <p className="text-slate-500 text-xs mt-0.5">{date} · {time}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <div className="text-right">
                          {paid != null && <p className="text-white text-sm font-bold">₹{paid.toLocaleString("en-IN")}</p>}
                          <p className="text-xs font-semibold" style={{ color: pm.color }}>+{t.amount} credits</p>
                        </div>
                        {/* Expand chevron */}
                        <svg
                          className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {/* Always-visible brief info */}
                    {!isOpen && (
                      <div className="mt-2.5 flex items-center gap-3 flex-wrap">
                        {methodStr && <span className="text-slate-400 text-xs">{methodStr}</span>}
                        {t.metadata?.razorpayPaymentId && (
                          <span className="text-slate-600 text-[10px] font-mono">
                            {t.metadata.razorpayPaymentId.slice(0, 12)}…
                          </span>
                        )}
                        <span className="text-slate-600 text-[10px] ml-auto">Tap to expand</span>
                      </div>
                    )}

                    {/* Expanded detail — only on mobile, inside the card */}
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden"
                        >
                          <div
                            className="mt-4 pt-4 border-t border-white/8 space-y-4"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <p className="text-[10px] text-slate-600 uppercase tracking-widest font-bold">Full Transaction Details</p>
                            <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                              <DetailItem label="Status"         value={t.metadata?.paymentStatus} color="#10b981" />
                              <DetailItem label="Source"         value={t.metadata?.source || "Direct"} />
                              <DetailItem label="Balance Before" value={`${t.balanceBefore} credits`} />
                              <DetailItem label="Balance After"  value={`${t.balanceAfter} credits`} color="#10b981" />
                              {t.metadata?.planPrice && <DetailItem label="Listed Price" value={`₹${t.metadata.planPrice}`} />}
                              {paid != null && <DetailItem label="Charged" value={`₹${paid.toLocaleString("en-IN")}`} color="#06b6d4" />}
                            </div>
                            {t.metadata?.razorpayPaymentId && (
                              <div>
                                <p className="text-[10px] text-slate-600 uppercase tracking-widest font-bold mb-1">Payment ID</p>
                                <CopyPill value={t.metadata.razorpayPaymentId} truncLen={30} />
                              </div>
                            )}
                            {t.metadata?.razorpayOrderId && (
                              <div>
                                <p className="text-[10px] text-slate-600 uppercase tracking-widest font-bold mb-1">Order ID</p>
                                <CopyPill value={t.metadata.razorpayOrderId} truncLen={30} />
                              </div>
                            )}
                            {methodStr && <DetailItem label="Payment Method" value={methodStr} />}
                            {t.metadata?.vpa && <DetailItem label="UPI VPA" value={t.metadata.vpa} copy />}
                            {t.metadata?.bank && <DetailItem label="Bank" value={t.metadata.bank} />}
                            {t.metadata?.payerEmail && <DetailItem label="Payer Email" value={t.metadata.payerEmail} />}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {!loading && !error && txns.length > 0 && (
          <div className="px-6 py-3 flex items-center gap-2 border-t border-white/5">
            <svg className="w-3.5 h-3.5 text-slate-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-slate-600">
              Click any row to see full transaction details. Payment IDs can be used for Razorpay support queries.
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}

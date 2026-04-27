import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { api, getApiErrorMessage } from "../services/api";
import { Eye, EyeOff } from "../components/Icons";

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function memberSince(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function initials(name) {
  if (!name) return "U";
  return name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

/* ── Inline status banner ────────────────────────────────────────────────── */
function Banner({ type, message, onDismiss }) {
  if (!message) return null;
  const isError = type === "error";
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className={`flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm border ${
        isError
          ? "bg-red-500/10 border-red-500/25 text-red-300"
          : "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
      }`}
    >
      {isError
        ? <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
        : <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
      }
      <span className="flex-1">{message}</span>
      <button onClick={onDismiss} className="opacity-60 hover:opacity-100 transition-opacity ml-1">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </motion.div>
  );
}

/* ── Section card ────────────────────────────────────────────────────────── */
function SectionCard({ title, description, icon, children }) {
  return (
    <div className="rounded-2xl border border-white/8 overflow-hidden"
      style={{ background: "rgba(10,16,30,0.7)", backdropFilter: "blur(16px)" }}
    >
      <div className="px-6 py-4 border-b border-white/6 flex items-center gap-3">
        <span className="text-lg">{icon}</span>
        <div>
          <h2 className="text-white font-semibold text-sm">{title}</h2>
          {description && <p className="text-slate-500 text-xs mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function Account() {
  const { user, logout, updateProfile } = useAuth();
  const navigate = useNavigate();

  /* Update name */
  const [name, setName]           = useState(user?.name || "");
  const [nameLoading, setNL]      = useState(false);
  const [nameStatus, setNS]       = useState(null); // { type, msg }

  /* Change password */
  const [curPwd, setCurPwd]       = useState("");
  const [newPwd, setNewPwd]       = useState("");
  const [showCur, setShowCur]     = useState(false);
  const [showNew, setShowNew]     = useState(false);
  const [pwdLoading, setPL]       = useState(false);
  const [pwdStatus, setPS]        = useState(null);

  /* Delete account */
  const [delOpen, setDelOpen]     = useState(false);
  const [delPwd, setDelPwd]       = useState("");
  const [showDel, setShowDel]     = useState(false);
  const [delLoading, setDL]       = useState(false);
  const [delError, setDE]         = useState("");

  /* ── handlers ── */
  async function handleUpdateName(e) {
    e.preventDefault();
    setNS(null); setNL(true);
    try {
      await updateProfile(name);
      setNS({ type: "success", msg: "Name updated successfully." });
    } catch (err) {
      setNS({ type: "error", msg: getApiErrorMessage(err, "Failed to update name") });
    } finally { setNL(false); }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPS(null); setPL(true);
    try {
      await api.put("/auth/change-password", { currentPassword: curPwd, newPassword: newPwd });
      setPS({ type: "success", msg: "Password changed. Use your new password next time you log in." });
      setCurPwd(""); setNewPwd("");
    } catch (err) {
      setPS({ type: "error", msg: getApiErrorMessage(err, "Failed to change password") });
    } finally { setPL(false); }
  }

  async function handleDeleteAccount(e) {
    e.preventDefault();
    setDE(""); setDL(true);
    try {
      await api.delete("/auth/account", { data: { password: delPwd } });
      logout();
      navigate("/", { replace: true });
    } catch (err) {
      setDE(getApiErrorMessage(err, "Failed to delete account"));
      setDL(false);
    }
  }

  const inputCls = "w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/40 transition-all duration-200";

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">

      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center gap-2 mb-1 text-sm">
          <Link to="/dashboard" className="text-slate-500 hover:text-slate-300 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <Link to="/dashboard" className="text-slate-500 hover:text-slate-300 transition-colors">Dashboard</Link>
          <span className="text-slate-700">/</span>
          <span className="text-slate-300 font-medium">Account</span>
        </div>
        <h1 className="font-display text-2xl font-bold text-white">Account Settings</h1>
        <p className="text-slate-500 text-sm mt-0.5">Manage your profile and security settings</p>
      </motion.div>

      {/* ── Profile overview ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07, duration: 0.4 }}>
        <SectionCard icon="👤" title="Profile" description="Your account information">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-fuchsia-500 flex items-center justify-center shrink-0 shadow-glow">
              <span className="text-xl font-bold text-white">{initials(user?.name)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-base truncate">{user?.name}</p>
              <p className="text-slate-400 text-sm truncate">{user?.email}</p>
              {user?.createdAt && (
                <p className="text-slate-600 text-xs mt-1">Member since {memberSince(user.createdAt)}</p>
              )}
            </div>
          </div>
        </SectionCard>
      </motion.div>

      {/* ── Update name ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.4 }}>
        <SectionCard icon="✏️" title="Update Name" description="Change how your name appears across the platform">
          <form onSubmit={handleUpdateName} className="space-y-4">
            <AnimatePresence mode="wait">
              {nameStatus && (
                <Banner key="ns" type={nameStatus.type} message={nameStatus.msg} onDismiss={() => setNS(null)} />
              )}
            </AnimatePresence>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Full Name</label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
                className={inputCls} placeholder="Your full name"
              />
            </div>
            <div className="flex justify-end">
              <motion.button type="submit" disabled={nameLoading || name.trim() === user?.name}
                whileHover={!nameLoading ? { scale: 1.02 } : {}} whileTap={!nameLoading ? { scale: 0.98 } : {}}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-fuchsia-500 text-white font-semibold text-sm disabled:opacity-50 shadow-glow hover:shadow-glow-lg transition-shadow duration-200"
              >
                {nameLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Saving…
                  </span>
                ) : "Save name"}
              </motion.button>
            </div>
          </form>
        </SectionCard>
      </motion.div>

      {/* ── Change password ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.17, duration: 0.4 }}>
        <SectionCard icon="🔒" title="Change Password" description="Use a strong password you don't use elsewhere">
          <form onSubmit={handleChangePassword} className="space-y-4">
            <AnimatePresence mode="wait">
              {pwdStatus && (
                <Banner key="ps" type={pwdStatus.type} message={pwdStatus.msg} onDismiss={() => setPS(null)} />
              )}
            </AnimatePresence>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Current Password</label>
              <div className="relative">
                <input type={showCur ? "text" : "password"} required value={curPwd} onChange={(e) => setCurPwd(e.target.value)}
                  className={`${inputCls} pr-12`} placeholder="Enter current password"
                />
                <button type="button" onClick={() => setShowCur((v) => !v)}
                  className="absolute inset-y-0 right-0 px-4 text-slate-500 hover:text-slate-300 transition-colors">
                  {showCur ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">New Password</label>
              <div className="relative">
                <input type={showNew ? "text" : "password"} required minLength={6} value={newPwd} onChange={(e) => setNewPwd(e.target.value)}
                  className={`${inputCls} pr-12`} placeholder="At least 6 characters"
                />
                <button type="button" onClick={() => setShowNew((v) => !v)}
                  className="absolute inset-y-0 right-0 px-4 text-slate-500 hover:text-slate-300 transition-colors">
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <motion.button type="submit" disabled={pwdLoading || !curPwd || newPwd.length < 6}
                whileHover={!pwdLoading ? { scale: 1.02 } : {}} whileTap={!pwdLoading ? { scale: 0.98 } : {}}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-fuchsia-500 text-white font-semibold text-sm disabled:opacity-50 shadow-glow hover:shadow-glow-lg transition-shadow duration-200"
              >
                {pwdLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Updating…
                  </span>
                ) : "Change password"}
              </motion.button>
            </div>
          </form>
        </SectionCard>
      </motion.div>

      {/* ── Danger zone ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22, duration: 0.4 }}>
        <div className="rounded-2xl border border-red-500/20 overflow-hidden"
          style={{ background: "rgba(10,16,30,0.7)", backdropFilter: "blur(16px)" }}
        >
          <div className="px-6 py-4 border-b border-red-500/15 flex items-center gap-3">
            <span className="text-lg">⚠️</span>
            <div>
              <h2 className="text-red-400 font-semibold text-sm">Danger Zone</h2>
              <p className="text-slate-500 text-xs mt-0.5">Irreversible and destructive actions</p>
            </div>
          </div>
          <div className="px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-white text-sm font-semibold">Delete account</p>
                <p className="text-slate-500 text-xs mt-0.5 max-w-sm">
                  Permanently delete your account and all associated data. This cannot be undone.
                </p>
              </div>
              <motion.button
                onClick={() => setDelOpen(true)}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className="shrink-0 px-4 py-2 rounded-xl border border-red-500/40 text-red-400 hover:bg-red-500/10 font-semibold text-sm transition-colors duration-200"
              >
                Delete account
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Delete confirmation modal ── */}
      <AnimatePresence>
        {delOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
              onClick={() => { setDelOpen(false); setDelPwd(""); setDE(""); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="w-full max-w-md rounded-2xl border border-red-500/25 pointer-events-auto"
                style={{ background: "rgba(10,16,30,0.97)", backdropFilter: "blur(24px)" }}
              >
                <div className="p-6">
                  <div className="w-12 h-12 rounded-2xl bg-red-500/12 border border-red-500/25 flex items-center justify-center mb-4 text-2xl">
                    🗑️
                  </div>
                  <h3 className="text-white font-bold text-lg mb-1">Delete your account?</h3>
                  <p className="text-slate-400 text-sm mb-5">
                    All your data — resumes, interview history, credits and settings — will be permanently deleted. This action <span className="text-red-400 font-semibold">cannot be undone</span>.
                  </p>

                  <form onSubmit={handleDeleteAccount} className="space-y-4">
                    <AnimatePresence mode="wait">
                      {delError && <Banner key="de" type="error" message={delError} onDismiss={() => setDE("")} />}
                    </AnimatePresence>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                        Confirm with your password
                      </label>
                      <div className="relative">
                        <input type={showDel ? "text" : "password"} required value={delPwd} onChange={(e) => setDelPwd(e.target.value)}
                          className={`${inputCls} pr-12`} placeholder="Enter your password" autoFocus
                        />
                        <button type="button" onClick={() => setShowDel((v) => !v)}
                          className="absolute inset-y-0 right-0 px-4 text-slate-500 hover:text-slate-300 transition-colors">
                          {showDel ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-1">
                      <button type="button" onClick={() => { setDelOpen(false); setDelPwd(""); setDE(""); }}
                        className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:border-white/20 font-semibold text-sm transition-all duration-200"
                      >
                        Cancel
                      </button>
                      <motion.button type="submit" disabled={delLoading || !delPwd}
                        whileHover={!delLoading ? { scale: 1.02 } : {}} whileTap={!delLoading ? { scale: 0.98 } : {}}
                        className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-sm transition-colors duration-200"
                      >
                        {delLoading ? (
                          <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Deleting…
                          </span>
                        ) : "Yes, delete account"}
                      </motion.button>
                    </div>
                  </form>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

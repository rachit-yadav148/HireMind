import { Link, NavLink } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  FileSearch,
  Mic,
  ListChecks,
  Briefcase,
  MessageSquare,
  LogOut,
  UserCircle,
} from "./Icons";
import { CreditCard } from "lucide-react";
import CreditDisplay from "./CreditDisplay";
import BrandLogo, { BrandWordmarkText } from "./BrandLogo";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/dashboard/resume", label: "Resume Analyzer", icon: FileSearch },
  { to: "/dashboard/interview", label: "Interview Simulator", icon: Mic },
  { to: "/dashboard/questions", label: "Question Generator", icon: ListChecks },
  { to: "/dashboard/applications", label: "Application Tracker", icon: Briefcase },
  { to: "/dashboard/plans", label: "Plans & Pricing", icon: CreditCard },
  { to: "/dashboard/feedback", label: "Feedback", icon: MessageSquare },
  { to: "/dashboard/account", label: "Account", icon: UserCircle },
];

export default function Sidebar({ onLogout, userName, mobileMenuOpen, onCloseMobileMenu }) {
  return (
    <>
      {/* Mobile backdrop */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.button
            type="button"
            aria-label="Close menu"
            onClick={onCloseMobileMenu}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
          />
        )}
      </AnimatePresence>

      <aside
        className={`w-64 shrink-0 h-[100dvh] md:min-h-screen flex flex-col fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:static md:z-auto md:translate-x-0 border-r border-white/5 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          background: "linear-gradient(180deg, #0c1420 0%, #080e1a 100%)",
        }}
      >
        {/* Top glow accent */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-500/40 to-transparent" />

        {/* Logo area */}
        <div className="px-5 py-6 border-b border-white/5">
          <Link
            to="/dashboard"
            onClick={onCloseMobileMenu}
            className="inline-flex items-center gap-1 group"
            aria-label="HireMind — Dashboard"
          >
            <BrandLogo className="h-11 w-11 shrink-0" alt="" />
            <BrandWordmarkText className="font-display font-bold text-xl text-white tracking-tight" />
          </Link>

          {/* User info */}
          <div className="mt-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-fuchsia-500 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-white">
                {userName ? userName[0].toUpperCase() : "U"}
              </span>
            </div>
            <p className="text-xs text-slate-500 truncate flex-1">{userName}</p>
          </div>

          <div className="mt-3 hidden md:block">
            <CreditDisplay />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-thin">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/dashboard"}
              onClick={onCloseMobileMenu}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-3 sm:py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative ${
                  isActive
                    ? "bg-brand-500/12 text-brand-300"
                    : "text-slate-500 hover:text-slate-200 hover:bg-white/5"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active-pill"
                      className="absolute inset-0 rounded-xl bg-brand-500/12 border border-brand-500/20"
                      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    />
                  )}
                  <Icon className={`w-4 h-4 shrink-0 relative z-10 transition-colors ${isActive ? "text-brand-400" : "text-slate-600 group-hover:text-slate-300"}`} />
                  <span className="relative z-10 text-sm">{label}</span>
                  {isActive && (
                    <div className="ml-auto relative z-10 w-1.5 h-1.5 rounded-full bg-brand-400" />
                  )}
                </>
              )}
            </NavLink>
          ))}

          {/* Sign out — right after Feedback, easy to reach */}
          <div className="pt-1 mt-1 border-t border-white/5">
            <button
              type="button"
              onClick={() => { onCloseMobileMenu?.(); onLogout(); }}
              className="group flex items-center gap-3 w-full px-3 py-3 sm:py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:text-red-400 hover:bg-red-500/8 transition-all duration-200"
            >
              <LogOut className="w-4 h-4 shrink-0 group-hover:scale-110 transition-transform duration-200" />
              Sign out
            </button>
          </div>
        </nav>
      </aside>
    </>
  );
}

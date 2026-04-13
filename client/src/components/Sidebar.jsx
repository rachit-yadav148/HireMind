import { Link, NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  FileSearch,
  Mic,
  ListChecks,
  Briefcase,
  MessageSquare,
  LogOut,
} from "./Icons";
import { CreditCard } from "lucide-react";
import CreditDisplay from "./CreditDisplay";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/dashboard/resume", label: "Resume Analyzer", icon: FileSearch },
  { to: "/dashboard/interview", label: "Interview Simulator", icon: Mic },
  { to: "/dashboard/questions", label: "Question Generator", icon: ListChecks },
  { to: "/dashboard/applications", label: "Application Tracker", icon: Briefcase },
  { to: "/dashboard/plans", label: "Plans & Pricing", icon: CreditCard },
  { to: "/dashboard/feedback", label: "Feedback", icon: MessageSquare },
];

export default function Sidebar({ onLogout, userName, mobileMenuOpen, onCloseMobileMenu }) {
  return (
    <>
      {mobileMenuOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={onCloseMobileMenu}
          className="fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm md:hidden"
        />
      )}
      <aside
        className={`w-64 shrink-0 border-r border-slate-800/80 bg-slate-900/95 backdrop-blur-sm h-[100dvh] md:min-h-screen flex flex-col fixed inset-y-0 left-0 z-40 transform transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6 border-b border-slate-800/80">
          <Link
            to="/dashboard"
            onClick={onCloseMobileMenu}
            className="inline-block font-display font-bold text-xl text-white tracking-tight"
          >
            Hire<span className="text-brand-400">Mind</span>
          </Link>
          <p className="text-xs text-slate-500 mt-1 truncate">{userName}</p>
          <div className="mt-3 hidden md:block">
            <CreditDisplay />
          </div>
        </div>
        <nav className="flex-1 p-3 pb-4 space-y-1 overflow-y-auto">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onCloseMobileMenu}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-brand-500/15 text-brand-300 border border-brand-500/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`
              }
            >
              <Icon className="w-5 h-5 shrink-0 opacity-90" />
              {label}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => {
              onCloseMobileMenu?.();
              onLogout();
            }}
            className="mt-2 flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </nav>
      </aside>
    </>
  );
}

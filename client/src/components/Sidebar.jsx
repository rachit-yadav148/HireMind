import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  FileSearch,
  Mic,
  ListChecks,
  Briefcase,
  MessageSquare,
  LogOut,
} from "./Icons";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/dashboard/resume", label: "Resume Analyzer", icon: FileSearch },
  { to: "/dashboard/interview", label: "Interview Simulator", icon: Mic },
  { to: "/dashboard/questions", label: "Question Generator", icon: ListChecks },
  { to: "/dashboard/applications", label: "Application Tracker", icon: Briefcase },
  { to: "/dashboard/feedback", label: "Feedback", icon: MessageSquare },
];

export default function Sidebar({ onLogout, userName }) {
  return (
    <aside className="w-64 shrink-0 border-r border-slate-800/80 bg-slate-900/50 backdrop-blur-sm min-h-screen flex flex-col">
      <div className="p-6 border-b border-slate-800/80">
        <div className="font-display font-bold text-xl text-white tracking-tight">
          Hire<span className="text-brand-400">Mind</span>
        </div>
        <p className="text-xs text-slate-500 mt-1 truncate">{userName}</p>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
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
      </nav>
      <div className="p-3 border-t border-slate-800/80">
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>
    </aside>
  );
}

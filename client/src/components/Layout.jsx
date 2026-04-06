import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Sidebar from "./Sidebar";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-mesh md:flex overflow-x-hidden">
      <Sidebar
        onLogout={handleLogout}
        userName={user?.name || user?.email}
        mobileMenuOpen={mobileMenuOpen}
        onCloseMobileMenu={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 min-w-0">
        <header className="md:hidden sticky top-0 z-20 border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-sm px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="font-display font-bold text-lg text-white tracking-tight">
              Hire<span className="text-brand-400">Mind</span>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
              className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-sm font-medium text-slate-200"
            >
              {mobileMenuOpen ? "Close" : "Menu"}
            </button>
          </div>
        </header>

        <main className="overflow-x-hidden">
          <div className="max-w-6xl mx-auto p-4 sm:p-6 md:p-10">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

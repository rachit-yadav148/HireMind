import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import Sidebar from "./Sidebar";
import CreditDisplay from "./CreditDisplay";
import BrandLogo, { BrandWordmarkText } from "./BrandLogo";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => { setMobileMenuOpen(false); }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
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

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-20 border-b border-white/5 backdrop-blur-xl px-4 py-3"
          style={{ background: "rgba(8,14,26,0.85)" }}
        >
          <div className="flex items-center justify-between gap-3">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1"
              aria-label="HireMind — Dashboard"
            >
              <BrandLogo className="h-11 w-11 shrink-0" alt="" />
              <BrandWordmarkText className="font-display font-bold text-lg text-white tracking-tight" />
            </Link>
            <div className="flex items-center gap-2.5">
              <CreditDisplay />
              <motion.button
                type="button"
                onClick={() => setMobileMenuOpen((v) => !v)}
                whileTap={{ scale: 0.93 }}
                aria-label="Toggle menu"
                aria-expanded={mobileMenuOpen}
                className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-slate-300 backdrop-blur-sm"
              >
                {mobileMenuOpen ? "Close" : "Menu"}
              </motion.button>
            </div>
          </div>
        </header>

        {/* Page content with animated transitions */}
        <main className="flex-1 overflow-x-hidden">
          <div className="max-w-6xl mx-auto p-4 sm:p-6 md:p-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}

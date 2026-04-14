import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import { api, getToken } from "../services/api";
import { useAuth } from "./AuthContext";
import posthog from "../posthog";

const CreditContext = createContext();

export function CreditProvider({ children }) {
  const [creditStatus, setCreditStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const lastFetchRef = useRef(0);
  const exhaustedFiredRef = useRef(false);

  const fetchCreditStatus = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setCreditStatus(null);
      setLoading(false);
      return;
    }
    try {
      const res = await api.get("/credits/status");
      setCreditStatus((prev) => {
        // Fire credits_exhausted once when credits drop to 0
        if (
          res.data.credits === 0 &&
          res.data.subscriptionType === "free" &&
          prev?.credits > 0 &&
          !exhaustedFiredRef.current
        ) {
          posthog.capture("credits_exhausted");
          exhaustedFiredRef.current = true;
        }
        return res.data;
      });
      lastFetchRef.current = Date.now();
    } catch (err) {
      console.error("Failed to fetch credit status:", err);
      setCreditStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch when auth state changes (login / logout)
  useEffect(() => {
    fetchCreditStatus();
  }, [isAuthenticated, fetchCreditStatus]);

  // Re-fetch on dashboard navigation if data is older than 5 seconds
  useEffect(() => {
    if (isAuthenticated && location.pathname.startsWith("/dashboard")) {
      const stale = Date.now() - lastFetchRef.current > 5000;
      if (stale) fetchCreditStatus();
    }
  }, [location.pathname, isAuthenticated, fetchCreditStatus]);

  const refreshCredits = useCallback(() => {
    return fetchCreditStatus();
  }, [fetchCreditStatus]);

  return (
    <CreditContext.Provider value={{ creditStatus, loading, refreshCredits }}>
      {children}
    </CreditContext.Provider>
  );
}

export function useCredits() {
  const context = useContext(CreditContext);
  if (!context) {
    throw new Error("useCredits must be used within CreditProvider");
  }
  return context;
}

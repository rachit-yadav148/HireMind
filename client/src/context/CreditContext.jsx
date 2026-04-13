import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api, getToken } from "../services/api";

const CreditContext = createContext();

export function CreditProvider({ children }) {
  const [creditStatus, setCreditStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchCreditStatus = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setCreditStatus(null);
      setLoading(false);
      return;
    }
    try {
      const res = await api.get("/credits/status");
      setCreditStatus(res.data);
    } catch (err) {
      console.error("Failed to fetch credit status:", err);
      setCreditStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCreditStatus();
  }, [fetchCreditStatus]);

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

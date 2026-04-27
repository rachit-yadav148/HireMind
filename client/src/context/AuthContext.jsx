import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, setAuthToken, getToken } from "../services/api";
import { setCachedCredits, clearBootstrapCache } from "../services/bootstrapCache";
import posthog from "../posthog";
import { getFreeInterviewSecondsUsed, getFreeResumeAnalysisUsed, shouldTrackUserSignedUpAfterTryingFree } from "../utils/freeTrial";
import { trackUserSignedUpAfterTryingFree } from "../utils/tryFreeAnalytics";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const identifyUser = (nextUser) => {
    const distinctId = nextUser?.id || nextUser?._id;
    if (!distinctId) return;
    posthog.identify(distinctId, {
      email: nextUser.email,
      name: nextUser.name,
    });
  };

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    // /auth/bootstrap returns user + credits in ONE request,
    // eliminating the sequential auth→credits waterfall on app load.
    api
      .get("/auth/bootstrap")
      .then((res) => {
        setUser(res.data.user);
        identifyUser(res.data.user);
        if (res.data.credits) setCachedCredits(res.data.credits);
      })
      .catch(() => {
        setAuthToken(null);
        setUser(null);
        clearBootstrapCache();
        posthog.reset();
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    setAuthToken(data.token);
    setUser(data.user);
    identifyUser(data.user);
    posthog.capture("user_login");
    return data.user;
  };

  const register = async (name, email, password) => {
    const { data } = await api.post("/auth/register", { name, email, password });
    posthog.capture("user_signup");
    if (data?.token && data?.user) {
      setAuthToken(data.token);
      setUser(data.user);
      identifyUser(data.user);
      if (shouldTrackUserSignedUpAfterTryingFree()) {
        trackUserSignedUpAfterTryingFree({
          free_resume_analysis_used: getFreeResumeAnalysisUsed(),
          free_interview_seconds_used: getFreeInterviewSecondsUsed(),
        });
      }
    }
    return data;
  };

  const verifySignupOtp = async (email, otp) => {
    const { data } = await api.post("/auth/verify-email-otp", { email, otp });
    setAuthToken(data.token);
    setUser(data.user);
    identifyUser(data.user);
    if (shouldTrackUserSignedUpAfterTryingFree()) {
      trackUserSignedUpAfterTryingFree({
        free_resume_analysis_used: getFreeResumeAnalysisUsed(),
        free_interview_seconds_used: getFreeInterviewSecondsUsed(),
      });
    }
    return data;
  };

  const resendSignupOtp = async (email) => {
    const { data } = await api.post("/auth/resend-email-otp", { email });
    return data;
  };

  const logout = () => {
    setAuthToken(null);
    setUser(null);
    clearBootstrapCache();
    posthog.reset();
  };

  const updateProfile = async (name) => {
    const { data } = await api.put("/auth/update-profile", { name });
    setUser((prev) => ({ ...prev, name: data.user.name }));
    posthog.identify(data.user.id || user?.id, { name: data.user.name });
    return data;
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      register,
      verifySignupOtp,
      resendSignupOtp,
      logout,
      updateProfile,
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

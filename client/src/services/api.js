import axios from "axios";

function resolveApiBaseUrl() {
  const configured = String(import.meta.env.VITE_API_PROXY || "").trim();
  if (!configured) return "/api";

  const normalized = configured.replace(/\/+$/, "");
  if (/\/api$/i.test(normalized)) return normalized;
  return `${normalized}/api`;
}

const baseURL = resolveApiBaseUrl();

export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem("token", token);
  } else {
    localStorage.removeItem("token");
  }
}

export function getToken() {
  return localStorage.getItem("token");
}

/** User-facing message for failed API calls (network, 4xx/5xx, etc.) */
export function getApiErrorMessage(err, fallback = "Something went wrong") {
  const msg = err?.response?.data?.message;
  if (typeof msg === "string" && msg.trim()) return msg;
  if (err?.code === "ERR_NETWORK" || err?.message === "Network Error") {
    return "Cannot reach the API. Start the server from the server/ folder and set client/.env VITE_API_PROXY to match your API port (see README).";
  }
  if (typeof err?.message === "string" && err.message.trim()) return err.message;
  return fallback;
}

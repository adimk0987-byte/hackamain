import axios from "axios";

export const api = axios.create({ baseURL: `${process.env.REACT_APP_BACKEND_URL}/api`, withCredentials: true });

export const errCode = (e) => e?.response?.data?.detail?.code;

export const errMsg = (e) => {
  if (!e?.response) return "Unable to connect to server. Please try again.";
  const d = e.response.data?.detail;
  if (d?.message) return d.message;
  if (typeof d === "string") return d;
  return "Something went wrong. Please try again.";
};

api.interceptors.response.use(
  (r) => r,
  (e) => {
    if (["SESSION_EXPIRED", "SESSION_INVALID"].includes(errCode(e))) {
      window.dispatchEvent(new CustomEvent("trustid:session-expired"));
    }
    return Promise.reject(e);
  }
);

export const fmt = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—");

export const timeAgo = (iso) => {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export const eventLabel = (e) => e.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export const verifyUrl = (token) => `${window.location.origin}/v/${token}`;

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";

const AuthCtx = createContext(null);

const PREFIX_ROLE = [["/vault", "citizen"], ["/nexus", "business"], ["/sentinel", "government"]];

export const safeReturn = (from, u) => {
  if (!from) return homeFor(u);
  const hit = PREFIX_ROLE.find(([p]) => from.startsWith(p));
  return hit && !u.roles.includes(hit[1]) ? homeFor(u) : from;
};

export const entryFor = (path = "") =>
  path.startsWith("/nexus") ? "/business" : path.startsWith("/sentinel") ? "/government" : "/individual";

export const homeFor = (u) =>
  u?.roles?.includes("citizen") ? "/vault" : u?.roles?.includes("business") ? "/nexus" : "/sentinel";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const userRef = useRef(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
      setExpiresAt(data.session_expires_at);
      return data.user;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (window.location.hash?.includes("session_id=")) {
      setLoading(false);
      return;
    }
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onExpired = () => {
      const had = !!userRef.current;
      setUser(null);
      if (had) {
        toast.error("Your session expired, please log in again.");
        navigate(entryFor(window.location.pathname), { state: { msg: "Your session expired, please log in again." } });
      }
    };
    window.addEventListener("trustid:session-expired", onExpired);
    return () => window.removeEventListener("trustid:session-expired", onExpired);
  }, [navigate]);

  useEffect(() => {
    if (!user || !expiresAt) return undefined;
    const ms = new Date(expiresAt).getTime() - Date.now();
    const t = setTimeout(() => window.dispatchEvent(new CustomEvent("trustid:session-expired")), Math.max(ms, 0));
    return () => clearTimeout(t);
  }, [user, expiresAt]);

  const signIn = (data) => {
    setUser(data.user);
    setExpiresAt(data.session_expires_at);
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      /* session cleared client-side regardless */
    }
    navigate("/", { replace: true });
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, expiresAt, refresh, signIn, logout, setUser }}>{children}</AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);

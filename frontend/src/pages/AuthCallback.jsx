import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { useAuth, safeReturn } from "@/context/AuthContext";

export default function AuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const sid = new URLSearchParams(location.hash.slice(1)).get("session_id");
    window.history.replaceState(null, "", window.location.pathname);
    api.post("/auth/google/session", { session_id: sid })
      .then(({ data }) => {
        signIn(data);
        const back = sessionStorage.getItem("tid_return");
        sessionStorage.removeItem("tid_return");
        navigate(safeReturn(back, data.user), { replace: true });
      })
      .catch((e) => {
        toast.error(errMsg(e));
        navigate("/login", { replace: true, state: { msg: errMsg(e) } });
      });
  }, [location.hash, navigate, signIn]);

  return null;
}

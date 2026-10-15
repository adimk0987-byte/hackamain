import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ScanFace, User, Building2, Landmark, Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import { AuthShell } from "@/pages/AuthShell";
import { FaceCamera } from "@/components/FaceCamera";
import { api, errMsg } from "@/lib/api";
import { useAuth, safeReturn } from "@/context/AuthContext";

const DEMOS = [["citizen", "Citizen", User], ["business", "Business admin", Building2], ["government", "Gov reviewer", Landmark]];

function GoogleButton({ from }) {
  const go = () => {
    if (from) sessionStorage.setItem("tid_return", from);
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/vault";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };
  return (
    <button onClick={go} className="tid-btn-ghost w-full" data-testid="google-login-btn">
      <svg viewBox="0 0 24 24" className="h-4 w-4"><path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.2-4.8 3.2-8.1Z" /><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23Z" /><path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8l3.7-2.8Z" /><path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4Z" /></svg>
      Continue with Google
    </button>
  );
}

function DemoLogins({ onDone }) {
  const [busy, setBusy] = useState(null);
  const go = async (role) => {
    setBusy(role);
    try {
      const { data } = await api.post("/auth/demo-login", { role });
      onDone(data);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4" data-testid="demo-login-panel">
      <p className="tid-label">Development demo accounts</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {DEMOS.map(([role, label, Icon]) => (
          <button key={role} disabled={!!busy} onClick={() => go(role)} className="tid-btn-ghost px-3" data-testid={`demo-login-${role}`}>
            {busy === role ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}{label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-400">Shown only when DEMO_MODE is enabled on the server.</p>
    </div>
  );
}

export default function Login() {
  const { user, loading, signIn } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [demo, setDemo] = useState(false);
  const from = location.state?.from;

  useEffect(() => {
    api.get("/config").then((r) => setDemo(r.data.demo_mode)).catch(() => {});
  }, []);

  if (!loading && user) return <Navigate to={safeReturn(from, user)} replace />;

  const finish = (data) => {
    signIn(data);
    toast.success(`Welcome, ${data.user.name}`);
    navigate(safeReturn(from, data.user), { replace: true });
  };

  const faceLogin = async (descriptor) => {
    try {
      const { data } = await api.post("/auth/face/login", { descriptor });
      finish(data);
      return null;
    } catch (e) {
      return errMsg(e);
    }
  };

  return (
    <AuthShell title="Log in with FaceGate" subtitle="Look at the camera. The server confirms the match before any dashboard opens."
      side={<FaceCamera onDescriptor={faceLogin} actionLabel="Scan & log in" />}>
      <div className="space-y-5">
        {location.state?.msg && <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800" data-testid="login-notice"><Info className="h-4 w-4" />{location.state.msg}</p>}
        <div className="rounded-2xl bg-slate-900 p-5 text-white">
          <ScanFace className="h-6 w-6 text-emerald-400" />
          <p className="mt-3 font-display text-lg font-semibold">Face login</p>
          <p className="mt-1 text-sm text-slate-300">Sessions last 30 minutes and are validated on every request. 10 attempts per 5 minutes.</p>
        </div>
        <div>
          <p className="tid-label mb-2">Can't use face login?</p>
          <GoogleButton from={from} />
        </div>
        {demo && <DemoLogins onDone={finish} />}
        <p className="text-sm text-slate-500">New here? <Link to="/register" className="font-semibold text-emerald-700 hover:underline" data-testid="login-register-link">Register with FaceGate</Link></p>
      </div>
    </AuthShell>
  );
}

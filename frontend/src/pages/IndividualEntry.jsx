import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Info, ShieldAlert, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { FaceCamera } from "@/components/FaceCamera";
import { GoogleButton, DemoButton } from "@/components/AuthButtons";
import { api, errMsg } from "@/lib/api";
import { useAuth, safeReturn } from "@/context/AuthContext";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function validate(f) {
  if (f.name.trim().length < 2) return "Enter your full name (at least 2 characters).";
  if (!/^[\w .'-]+$/.test(f.name.trim())) return "Name may only contain letters, spaces, dots and hyphens.";
  if (!EMAIL_RE.test(f.email.trim())) return "Enter a valid email address.";
  if (!f.consent) return "Please accept the biometric processing notice.";
  return null;
}

function RegisterForm({ f, setF, error }) {
  return (
    <div className="space-y-4" data-testid="register-form">
      <div><label className="tid-label" htmlFor="reg-name">Full name</label><input id="reg-name" className="tid-input mt-2" maxLength={60} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="As on your documents" data-testid="register-name-input" /></div>
      <div><label className="tid-label" htmlFor="reg-email">Email</label><input id="reg-email" type="email" className="tid-input mt-2" maxLength={120} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="you@example.com" data-testid="register-email-input" /></div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-amber-900"><ShieldAlert className="h-4 w-4" />Biometric processing notice</p>
        <p className="mt-2 text-xs leading-relaxed text-amber-900/80">One camera frame becomes a 128-number face template in your browser. Only that template is sent, encrypted at rest, and used to log you in, unlock your documents and block duplicate accounts. No photo is stored. Face matching is not liveness detection. Delete it anytime in Settings.</p>
        <label className="mt-3 flex min-h-[44px] cursor-pointer items-center gap-3 text-sm font-medium text-slate-800"><input type="checkbox" className="h-5 w-5 accent-emerald-600" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} data-testid="register-consent-checkbox" />I consent to biometric processing.</label>
      </div>
      {error && (f.name || f.email) && <p className="text-sm text-rose-600" data-testid="register-form-error">{error}</p>}
    </div>
  );
}

function Welcome({ name }) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center rounded-3xl bg-white/95 text-center rise" data-testid="face-welcome">
      <CheckCircle2 className="h-16 w-16 text-emerald-500" />
      <p className="mt-4 text-sm text-slate-500">Face recognised</p>
      <p className="font-display text-3xl font-bold" data-testid="face-welcome-name">Welcome, {name}</p>
      <p className="mt-2 text-sm text-slate-500">Opening your vault…</p>
    </div>
  );
}

export default function IndividualEntry() {
  const { user, loading, signIn } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mode, setMode] = useState(location.state?.mode || "login");
  const [f, setF] = useState({ name: "", email: "", consent: false });
  const [welcome, setWelcome] = useState(null);
  const from = location.state?.from || "/vault";
  const formError = validate(f);

  if (!loading && user && !welcome) return <Navigate to={user.roles.includes("citizen") ? safeReturn(from, user) : "/unauthorized"} replace state={{ role: "individual" }} />;

  const enter = (data) => {
    setWelcome(data.user.name);
    setTimeout(() => {
      signIn(data);
      navigate(safeReturn(from, data.user), { replace: true });
    }, 1400);
  };

  const onFace = async (descriptor) => {
    try {
      if (mode === "register") {
        if (formError) return formError;
        await api.post("/auth/face/register", { name: f.name.trim(), email: f.email.trim(), consent: f.consent, descriptor });
        toast.success("Registered! Now scan your face to log in.");
        setMode("login");
        return null;
      }
      const { data } = await api.post("/auth/face/login", { descriptor });
      enter(data);
      return null;
    } catch (e) {
      return errMsg(e);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-8"><Logo /><Link to="/" className="tid-btn-ghost" data-testid="back-home-btn"><ArrowLeft className="h-4 w-4" />Portals</Link></header>
      <main className="mx-auto grid max-w-6xl gap-8 px-4 pb-16 sm:px-8 lg:grid-cols-[1fr_1.1fr]">
        <div className="rise">
          <p className="tid-label text-emerald-700">Individual · TrustID Vault</p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl" data-testid="page-title">{mode === "login" ? "Scan Your Face" : "Create your vault"}</h1>
          <p className="mt-3 text-sm text-slate-500">{mode === "login" ? "Look at the camera. Your face unlocks your personal document vault." : "Register once with your face. Your documents will be linked to it."}</p>
          <div className="mt-6 inline-flex rounded-xl bg-slate-100 p-1">
            {[["login", "Log in"], ["register", "Register"]].map(([k, l]) => <button key={k} onClick={() => setMode(k)} className={`min-h-[44px] rounded-lg px-5 text-sm font-semibold ${mode === k ? "bg-white shadow-sm" : "text-slate-500"}`} data-testid={`mode-${k}`}>{l}</button>)}
          </div>
          <div className="mt-6 space-y-5">
            {location.state?.msg && <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800" data-testid="login-notice"><Info className="h-4 w-4" />{location.state.msg}</p>}
            {mode === "register" && <RegisterForm f={f} setF={setF} error={formError} />}
            {mode === "login" && (
              <>
                <div><p className="tid-label mb-2">Can't use face login?</p><GoogleButton returnTo={from} /></div>
                <DemoButton role="citizen" label="Demo citizen" onDone={enter} />
              </>
            )}
          </div>
        </div>
        <div className="relative tid-card p-5 sm:p-6 rise rise-1">
          {welcome && <Welcome name={welcome} />}
          <FaceCamera key={mode} onDescriptor={onFace} actionLabel={mode === "login" ? "Scan & log in" : "Capture & register"} disabled={mode === "register" && !!formError} />
        </div>
      </main>
    </div>
  );
}

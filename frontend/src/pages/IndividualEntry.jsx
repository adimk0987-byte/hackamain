import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Info, ShieldAlert, CheckCircle2, Fingerprint, Loader2, ArrowRight, Lock } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { FaceCamera } from "@/components/FaceCamera";
import { BiometricScanner } from "@/components/BiometricScanner";
import { FingerprintCard } from "@/components/FingerprintCard";
import { GoogleButton, DemoButton } from "@/components/AuthButtons";
import { api, errMsg } from "@/lib/api";
import { loginFingerprint, fingerprintSupported, webauthnError } from "@/lib/webauthn";
import { useAuth, safeReturn } from "@/context/AuthContext";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const validate = (f) => (f.name.trim().length < 2 || !/^[\w .'-]+$/.test(f.name.trim()) ? "Enter your full name (letters, spaces, dots, hyphens)." : !EMAIL_RE.test(f.email.trim()) ? "Enter a valid email address." : !f.consent ? "Please accept the biometric processing notice." : null);
const STAGES = ["Your details", "Face & liveness", "Fingerprint", "Vault"];

function Stepper({ stage }) {
  return (
    <ol className="flex flex-wrap gap-2" data-testid="register-stepper">
      {STAGES.map((s, i) => <li key={s} className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${i < stage ? "bg-emerald-50 text-emerald-700" : i === stage ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-400"}`}><span>{i + 1}</span>{s}</li>)}
    </ol>
  );
}

function Details({ f, setF, onNext }) {
  const error = validate(f);
  return (
    <div className="space-y-4" data-testid="register-form">
      <div><label className="tid-label" htmlFor="reg-name">Full name</label><input id="reg-name" className="tid-input mt-2" maxLength={60} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="As on your documents" data-testid="register-name-input" /></div>
      <div><label className="tid-label" htmlFor="reg-email">Email</label><input id="reg-email" type="email" className="tid-input mt-2" maxLength={120} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="you@example.com" data-testid="register-email-input" /></div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-amber-900"><ShieldAlert className="h-4 w-4" />Biometric processing notice</p>
        <p className="mt-2 text-xs leading-relaxed text-amber-900/80">Your browser converts camera frames into 128-number face templates (front, left, right) and checks a blink. Only templates are sent and stored encrypted. No photo is saved. You can delete everything anytime.</p>
        <label className="mt-3 flex min-h-[44px] cursor-pointer items-center gap-3 text-sm font-medium text-slate-800"><input type="checkbox" className="h-5 w-5 accent-emerald-600" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} data-testid="register-consent-checkbox" />I consent to biometric processing.</label>
      </div>
      {error && (f.name || f.email) && <p className="text-sm text-rose-600" data-testid="register-form-error">{error}</p>}
      <button className="tid-btn-dark w-full" disabled={!!error} onClick={onNext} data-testid="register-next-btn">Continue to face scan <ArrowRight className="h-4 w-4" /></button>
    </div>
  );
}

function LoginPanel({ from, onDone }) {
  const [busy, setBusy] = useState(false);
  const fp = async () => {
    setBusy(true);
    try {
      onDone(await loginFingerprint());
    } catch (e) {
      toast.error(webauthnError(e) || errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      {fingerprintSupported() && <button onClick={fp} disabled={busy} className="tid-btn-dark w-full" data-testid="fingerprint-login-btn">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}Log in with fingerprint</button>}
      <div><p className="tid-label mb-2">Other options</p><GoogleButton returnTo={from} /></div>
      <DemoButton role="citizen" label="Demo citizen" onDone={onDone} />
    </div>
  );
}

export default function IndividualEntry() {
  const { user, loading, signIn } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mode, setMode] = useState(location.state?.mode || "login");
  const [stage, setStage] = useState(0);
  const [f, setF] = useState({ name: "", email: "", consent: false });
  const [welcome, setWelcome] = useState(null);
  const [busy, setBusy] = useState(false);
  const [fpDone, setFpDone] = useState(false);
  const from = location.state?.from || "/vault";
  const enrolling = mode === "register" && stage >= 2;

  if (!loading && user && !welcome && !enrolling) return <Navigate to={user.roles.includes("citizen") ? safeReturn(from, user) : "/unauthorized"} replace state={{ role: "individual" }} />;

  const enter = (data) => {
    setWelcome(data.user.name);
    setTimeout(() => {
      signIn(data);
      navigate(safeReturn(from, data.user), { replace: true });
    }, 1300);
  };

  const faceLogin = async (descriptor) => {
    try {
      const { data } = await api.post("/auth/face/login", { descriptor });
      enter(data);
      return null;
    } catch (e) {
      return errMsg(e);
    }
  };

  const register = async (scan) => {
    setBusy(true);
    try {
      await api.post("/auth/face/register", { name: f.name.trim(), email: f.email.trim(), consent: true, ...scan });
      const { data } = await api.post("/auth/face/login", { descriptor: scan.descriptor });
      setStage(2);
      signIn(data);
      return null;
    } catch (e) {
      return errMsg(e);
    } finally {
      setBusy(false);
    }
  };

  const tabs = (
    <div className="mt-6 inline-flex rounded-xl bg-slate-100 p-1">
      {[["login", "Log in"], ["register", "Register"]].map(([k, l]) => <button key={k} onClick={() => { setMode(k); setStage(0); }} disabled={enrolling} className={`min-h-[44px] rounded-lg px-5 text-sm font-semibold ${mode === k ? "bg-white shadow-sm" : "text-slate-500"}`} data-testid={`mode-${k}`}>{l}</button>)}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F6F8FA]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-8"><Logo /><Link to="/" className="tid-btn-ghost" data-testid="back-home-btn"><ArrowLeft className="h-4 w-4" />Portals</Link></header>
      <main className="mx-auto grid max-w-6xl gap-8 px-4 pb-16 sm:px-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rise">
          <p className="tid-label text-emerald-700">Individual · TrustID Vault</p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl" data-testid="page-title">{mode === "login" ? "Scan Your Face" : "Create your vault"}</h1>
          <p className="mt-3 max-w-md text-sm text-slate-500">{mode === "login" ? "Look at the camera. The server confirms your face before your document vault opens." : "Register once: face, left & right turn, blink and fingerprint. Your documents unlock only for you."}</p>
          {tabs}
          <div className="mt-6 space-y-5">
            {location.state?.msg && <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800" data-testid="login-notice"><Info className="h-4 w-4" />{location.state.msg}</p>}
            {mode === "register" && <Stepper stage={stage} />}
            {mode === "register" && stage === 0 && <Details f={f} setF={setF} onNext={() => setStage(1)} />}
            {mode === "register" && stage === 1 && <p className="rounded-2xl bg-white p-4 text-sm text-slate-600 ring-1 ring-slate-200">Registering <b>{f.name}</b> · {f.email}. <button className="font-semibold text-emerald-700" onClick={() => setStage(0)} data-testid="edit-details-btn">Edit</button></p>}
            {mode === "login" && <LoginPanel from={from} onDone={enter} />}
          </div>
        </div>
        <div className="relative rounded-3xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,.04)] ring-1 ring-slate-200 sm:p-7 rise rise-1">
          {welcome && <div className="absolute inset-0 z-40 flex flex-col items-center justify-center rounded-3xl bg-white/95 text-center" data-testid="face-welcome"><CheckCircle2 className="h-16 w-16 text-emerald-500" /><p className="mt-4 text-sm text-slate-500">Identity confirmed</p><p className="font-display text-3xl font-bold" data-testid="face-welcome-name">Welcome, {welcome}</p><p className="mt-2 text-sm text-slate-500">Opening your vault…</p></div>}
          {mode === "login" && <FaceCamera onDescriptor={faceLogin} actionLabel="Scan & log in" />}
          {mode === "register" && stage === 0 && <div className="grid h-full min-h-[360px] place-items-center text-center"><div><Lock className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 text-sm text-slate-500">Enter your details to unlock the biometric scan.</p></div></div>}
          {mode === "register" && stage === 1 && <BiometricScanner onComplete={register} busy={busy} title="Registering your face" />}
          {mode === "register" && stage === 2 && (
            <div className="space-y-5" data-testid="register-fingerprint-stage">
              <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-4"><CheckCircle2 className="h-6 w-6 text-emerald-600" /><p className="text-sm font-semibold text-emerald-800">Face and liveness verified for {f.name}.</p></div>
              <FingerprintCard enrolled={fpDone} onChange={setFpDone} />
              <button className="tid-btn-primary w-full" onClick={() => navigate("/vault", { replace: true })} data-testid="open-vault-btn">{fpDone ? "Open my document vault" : "Skip fingerprint & open vault"}<ArrowRight className="h-4 w-4" /></button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

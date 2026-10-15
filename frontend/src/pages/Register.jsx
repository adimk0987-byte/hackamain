import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import { AuthShell } from "@/pages/AuthShell";
import { FaceCamera } from "@/components/FaceCamera";
import { api, errMsg } from "@/lib/api";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function validate(f) {
  if (f.name.trim().length < 2) return "Enter your display name (at least 2 characters).";
  if (!/^[\w .'-]+$/.test(f.name.trim())) return "Name may only contain letters, spaces, dots and hyphens.";
  if (!EMAIL_RE.test(f.email.trim())) return "Enter a valid email address.";
  if (!f.consent) return "Please accept the biometric processing notice.";
  return null;
}

function Success() {
  return (
    <div className="flex flex-col items-center py-16 text-center" data-testid="register-success">
      <CheckCircle2 className="h-14 w-14 text-emerald-500" />
      <h2 className="mt-4 font-display text-2xl font-bold">You're registered</h2>
      <p className="mt-2 max-w-xs text-sm text-slate-500">Your encrypted face template is stored. No photo was saved.</p>
      <Link to="/login" className="tid-btn-primary mt-6" data-testid="register-go-login-btn">Continue to face login</Link>
    </div>
  );
}

export default function Register() {
  const [f, setF] = useState({ name: "", email: "", consent: false });
  const [done, setDone] = useState(false);
  const formError = validate(f);

  const submit = async (descriptor) => {
    if (formError) return formError;
    try {
      await api.post("/auth/face/register", { name: f.name.trim(), email: f.email.trim(), consent: f.consent, descriptor });
      setDone(true);
      return null;
    } catch (e) {
      return errMsg(e);
    }
  };

  return (
    <AuthShell title="Create your TrustID" subtitle="Register with FaceGate in under a minute. You'll get a synthetic demo identity profile."
      side={done ? <Success /> : <FaceCamera onDescriptor={submit} actionLabel="Capture & register" disabled={!!formError} />}>
      <div className="space-y-5">
        <div>
          <label className="tid-label" htmlFor="reg-name">Display name</label>
          <input id="reg-name" className="tid-input mt-2" value={f.name} maxLength={60} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Ananya Rao" data-testid="register-name-input" />
        </div>
        <div>
          <label className="tid-label" htmlFor="reg-email">Email</label>
          <input id="reg-email" type="email" className="tid-input mt-2" value={f.email} maxLength={120} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="you@example.com" data-testid="register-email-input" />
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-900"><ShieldAlert className="h-4 w-4" />Biometric processing notice</p>
          <p className="mt-2 text-xs leading-relaxed text-amber-900/80">FaceGate converts one camera frame into a 128-number face template in your browser. Only that template is sent, encrypted at rest, and used to log you in and prevent duplicate accounts. The image is never stored. Face matching is not proof of liveness. You can delete the template or your account any time from Settings.</p>
          <label className="mt-3 flex min-h-[44px] cursor-pointer items-center gap-3 text-sm font-medium text-slate-800">
            <input type="checkbox" className="h-5 w-5 accent-emerald-600" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} data-testid="register-consent-checkbox" />
            I consent to biometric processing as described.
          </label>
        </div>
        {formError && (f.name || f.email) && <p className="text-sm text-rose-600" data-testid="register-form-error">{formError}</p>}
        <p className="text-sm text-slate-500">Already registered? <Link to="/login" className="font-semibold text-emerald-700 hover:underline" data-testid="register-login-link">Log in</Link></p>
      </div>
    </AuthShell>
  );
}

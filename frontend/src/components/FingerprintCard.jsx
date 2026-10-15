import { useState } from "react";
import { Fingerprint, Loader2, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { enrollFingerprint, fingerprintSupported, webauthnError } from "@/lib/webauthn";

export function FingerprintCard({ enrolled, onChange, compact = false }) {
  const [busy, setBusy] = useState(false);
  const supported = fingerprintSupported();
  const enroll = async () => {
    setBusy(true);
    try {
      await enrollFingerprint();
      toast.success("Fingerprint linked to your TrustID");
      onChange?.(true);
    } catch (e) {
      toast.error(webauthnError(e) || errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    try {
      await api.delete("/me/passkey");
      toast.success("Fingerprint removed");
      onChange?.(false);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white ${compact ? "p-4" : "p-6"}`} data-testid="fingerprint-card">
      <div className="flex items-start gap-4">
        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${enrolled ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-600"}`}><Fingerprint className="h-6 w-6" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold text-slate-900">Fingerprint {enrolled && <Check className="ml-1 inline h-4 w-4 text-emerald-600" />}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">Uses your device's fingerprint sensor (Touch ID, Windows Hello, Android) via WebAuthn. Your fingerprint never leaves the device — only a cryptographic key is registered.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {!supported ? <span className="text-xs font-semibold text-amber-700" data-testid="fingerprint-unsupported">This browser doesn't support fingerprint sign-in.</span> : !enrolled ? (
              <button className="tid-btn-dark" onClick={enroll} disabled={busy} data-testid="fingerprint-enroll-btn">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}Scan fingerprint</button>
            ) : <button className="tid-btn-ghost text-rose-600" onClick={remove} data-testid="fingerprint-remove-btn"><Trash2 className="h-4 w-4" />Remove</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

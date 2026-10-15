import { useState } from "react";
import { Loader2, ScanFace, Trash2, ShieldCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { api, errMsg, fmt } from "@/lib/api";
import { PageHeader, StatusBadge } from "@/components/Shared";
import { FaceCamera } from "@/components/FaceCamera";
import { useAuth } from "@/context/AuthContext";

function FaceSection() {
  const { user, refresh } = useAuth();
  const [consent, setConsent] = useState(false);
  const [open, setOpen] = useState(false);
  const enroll = async (descriptor) => {
    if (!consent) return "Please accept the biometric processing notice first.";
    try {
      await api.post("/me/face", { descriptor, consent });
      toast.success("FaceGate enrolled");
      setOpen(false);
      refresh();
      return null;
    } catch (e) {
      return errMsg(e);
    }
  };
  const remove = async () => {
    try {
      await api.delete("/me/face");
      toast.success("Face template deleted");
      refresh();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  return (
    <section id="face" className="tid-card p-6" data-testid="settings-face">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><ScanFace className="h-6 w-6 text-emerald-600" /><div><h3 className="font-display text-lg font-bold">FaceGate</h3><p className="text-sm text-slate-500">Face login for this account.</p></div></div>
        <StatusBadge value={user.face_enrolled ? "active" : "not enrolled"} testId="settings-face-status" />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="tid-btn-primary" onClick={() => setOpen(!open)} data-testid="face-enroll-toggle">{user.face_enrolled ? "Re-enrol face" : "Enrol face"}</button>
        {user.face_enrolled && <button className="tid-btn-ghost text-rose-600" onClick={remove} data-testid="face-delete-btn"><Trash2 className="h-4 w-4" />Delete face template</button>}
      </div>
      {open && (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-900">
            <input type="checkbox" className="mt-0.5 h-5 w-5 accent-emerald-600" checked={consent} onChange={(e) => setConsent(e.target.checked)} data-testid="enroll-consent-checkbox" />
            I consent to FaceGate creating an encrypted face template from one frame. No image is stored. Matching is not liveness detection; you can delete the template at any time.
          </label>
          <FaceCamera onDescriptor={enroll} actionLabel="Capture & enrol" />
        </div>
      )}
    </section>
  );
}

function DangerZone() {
  const { user, setUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const del = async () => {
    setBusy(true);
    try {
      await api.post("/me/delete", { confirm: text });
      setUser(null);
      window.location.href = "/";
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  const isDemo = user.email.endsWith("@trustid.demo");
  return (
    <section className="tid-card border-rose-200 p-6" data-testid="settings-danger">
      <div className="flex items-center gap-3"><UserX className="h-6 w-6 text-rose-600" /><h3 className="font-display text-lg font-bold">Delete account</h3></div>
      <p className="mt-2 text-sm text-slate-500">Permanently deletes your account, identity profile, face template and sessions. Businesses lose access to anything you shared.</p>
      <button className="tid-btn-danger mt-4" disabled={isDemo} onClick={() => setOpen(true)} data-testid="delete-account-btn">Delete my account</button>
      {isDemo && <p className="mt-2 text-xs text-slate-400">Demo accounts cannot be deleted.</p>}
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="bg-white" data-testid="delete-account-dialog">
          <AlertDialogHeader><AlertDialogTitle>Delete your TrustID?</AlertDialogTitle><AlertDialogDescription>Type DELETE to confirm. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <input className="tid-input" value={text} onChange={(e) => setText(e.target.value)} data-testid="delete-confirm-input" />
          <AlertDialogFooter><AlertDialogCancel data-testid="delete-cancel-btn">Cancel</AlertDialogCancel><AlertDialogAction disabled={text !== "DELETE" || busy} onClick={(e) => { e.preventDefault(); del(); }} className="bg-rose-600 hover:bg-rose-700" data-testid="delete-confirm-btn">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Delete forever</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

export default function SettingsPage() {
  const { user, expiresAt } = useAuth();
  return (
    <div className="space-y-6" data-testid="settings-page">
      <PageHeader eyebrow="Account" title="Settings" subtitle="Security, biometrics and privacy controls." />
      <section className="tid-card p-6">
        <div className="flex items-center gap-3"><ShieldCheck className="h-6 w-6 text-emerald-600" /><h3 className="font-display text-lg font-bold">Account & session</h3></div>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-4">
          <div><dt className="tid-label">Name</dt><dd className="font-semibold">{user.name}</dd></div>
          <div><dt className="tid-label">Email</dt><dd>{user.email}</dd></div>
          <div><dt className="tid-label">Roles</dt><dd className="flex flex-wrap gap-1" data-testid="settings-roles">{user.roles.map((r) => <StatusBadge key={r} value={r} />)}</dd></div>
          <div><dt className="tid-label">Session expires</dt><dd data-testid="settings-session-expiry">{fmt(expiresAt)}</dd></div>
        </dl>
        <p className="mt-3 text-xs text-slate-400">Sessions are HttpOnly cookies validated by the server on every request. Roles are assigned by administrators only.</p>
      </section>
      <FaceSection />
      <DangerZone />
    </div>
  );
}

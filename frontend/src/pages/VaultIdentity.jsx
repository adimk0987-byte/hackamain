import { useEffect, useState } from "react";
import { Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { api, errMsg } from "@/lib/api";
import { Loader, PageHeader, StatusBadge, DemoTag } from "@/components/Shared";

function EditDialog({ profile, open, onClose, onSaved }) {
  const [f, setF] = useState({ display_name: profile.display_name, city: profile.city });
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    if (f.display_name.trim().length < 2 || f.city.trim().length < 2) return toast.error("Both fields need at least 2 characters.");
    setBusy(true);
    try {
      const { data } = await api.patch("/vault/profile", { display_name: f.display_name.trim(), city: f.city.trim() });
      onSaved(data);
      toast.success("Profile updated");
      onClose();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-white" data-testid="edit-profile-dialog">
        <DialogHeader><DialogTitle>Edit profile</DialogTitle><DialogDescription>Legal name and date of birth come from your issuer and cannot be edited.</DialogDescription></DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div><label className="tid-label">Display name</label><input className="tid-input mt-2" maxLength={60} value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} data-testid="edit-display-name-input" /></div>
          <div><label className="tid-label">City</label><input className="tid-input mt-2" maxLength={60} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} data-testid="edit-city-input" /></div>
          <button className="tid-btn-primary w-full" disabled={busy} data-testid="edit-profile-save-btn">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save changes</button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function VaultIdentity() {
  const [d, setD] = useState(null);
  const [edit, setEdit] = useState(false);
  useEffect(() => {
    api.get("/vault/overview").then((r) => setD(r.data)).catch((e) => toast.error(errMsg(e)));
  }, []);
  if (!d) return <Loader />;
  const p = d.profile;
  const fields = [["Legal name", p.full_name], ["Display name", p.display_name], ["Date of birth", p.dob], ["City", p.city], ["Email", p.email], ["TrustID reference", p.trust_id]];
  return (
    <div data-testid="vault-identity">
      <PageHeader eyebrow="TrustID Vault" title="My Identity" subtitle="Your identity profile and what it can prove." action={<button className="tid-btn-ghost" onClick={() => setEdit(true)} data-testid="edit-profile-btn"><Pencil className="h-4 w-4" />Edit profile</button>} />
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="tid-card p-6">
          <div className="flex items-center justify-between"><h3 className="font-display text-lg font-bold">Profile</h3><DemoTag /></div>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">{fields.map(([k, v]) => <div key={k}><dt className="tid-label">{k}</dt><dd className="mt-1 text-sm font-semibold" data-testid={`profile-${k.toLowerCase().replace(/\s/g, "-")}`}>{v}</dd></div>)}</dl>
          <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-100 pt-4 text-sm">
            <span className="flex items-center gap-2">Identity status <StatusBadge value={p.identity_status} /></span>
            <span className="flex items-center gap-2">FaceGate <StatusBadge value={d.face_enrolled ? "active" : "not enrolled"} testId="face-status" /></span>
          </div>
          <p className="mt-3 text-xs text-slate-400">“Verified” here means verified by the TrustID Demo Issuer (synthetic). No real government database is queried.</p>
        </div>
        <div className="tid-card p-6">
          <h3 className="font-display text-lg font-bold">Credentials</h3>
          <ul className="mt-4 space-y-3">{p.credentials.map((c) => <li key={c.id} className="rounded-xl border border-slate-200 p-3"><div className="flex items-center justify-between"><p className="text-sm font-semibold">{c.type}</p><StatusBadge value={c.status} /></div><p className="text-xs text-slate-500">{c.issuer} · issued {c.issued}</p><p className="font-mono text-xs text-slate-600">{c.number}</p></li>)}</ul>
        </div>
      </div>
      {edit && <EditDialog profile={p} open={edit} onClose={() => setEdit(false)} onSaved={(np) => setD({ ...d, profile: np })} />}
    </div>
  );
}

import { useEffect, useState } from "react";
import { Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { api, errMsg } from "@/lib/api";
import { Loader, PageHeader, StatusBadge } from "@/components/Shared";

function EditDialog({ profile, onClose, onSaved }) {
  const [f, setF] = useState({ display_name: profile.display_name, city: profile.city || "", dob: profile.dob || "" });
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    if (f.display_name.trim().length < 2) return toast.error("Display name needs at least 2 characters.");
    if (f.city && f.city.trim().length < 2) return toast.error("City needs at least 2 characters.");
    setBusy(true);
    try {
      const body = { display_name: f.display_name.trim() };
      if (f.city.trim()) body.city = f.city.trim();
      if (f.dob) body.dob = f.dob;
      const { data } = await api.patch("/vault/profile", body);
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
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-white" data-testid="edit-profile-dialog">
        <DialogHeader><DialogTitle>Edit profile</DialogTitle><DialogDescription>These details are self-declared and shared only as claims you approve.</DialogDescription></DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div><label className="tid-label">Display name</label><input className="tid-input mt-2" maxLength={60} value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} data-testid="edit-display-name-input" /></div>
          <div><label className="tid-label">Date of birth</label><input type="date" className="tid-input mt-2" value={f.dob} onChange={(e) => setF({ ...f, dob: e.target.value })} data-testid="edit-dob-input" /></div>
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
  const fields = [["Full name", p.full_name], ["Display name", p.display_name], ["Date of birth", p.dob || "Not provided"], ["City", p.city || "Not provided"], ["Email", p.email], ["TrustID reference", p.trust_id]];
  return (
    <div data-testid="vault-identity">
      <PageHeader eyebrow="TrustID Vault" title="My Identity" subtitle="Your profile and what it can prove to businesses with your consent." action={<button className="tid-btn-ghost" onClick={() => setEdit(true)} data-testid="edit-profile-btn"><Pencil className="h-4 w-4" />Edit profile</button>} />
      <div className="tid-card p-6">
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{fields.map(([k, v]) => <div key={k}><dt className="tid-label">{k}</dt><dd className="mt-1 text-sm font-semibold" data-testid={`profile-${k.toLowerCase().replace(/\s/g, "-")}`}>{v}</dd></div>)}</dl>
        <div className="mt-6 flex flex-wrap gap-4 border-t border-slate-100 pt-4 text-sm">
          <span className="flex items-center gap-2">FaceGate <StatusBadge value={d.face_enrolled ? "active" : "not enrolled"} testId="face-status" /></span>
          <span className="flex items-center gap-2">Documents on file <b>{d.stats.documents}</b></span>
        </div>
      </div>
      {edit && <EditDialog profile={p} onClose={() => setEdit(false)} onSaved={(np) => setD({ ...d, profile: { ...d.profile, ...np } })} />}
    </div>
  );
}

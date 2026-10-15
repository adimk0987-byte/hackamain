import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { api, errMsg } from "@/lib/api";

const PURPOSES = ["Account opening (KYC)", "Age-restricted purchase", "Visitor check-in", "Rental agreement", "Employment onboarding"];
const EXPIRIES = [["5m", "5 minutes"], ["1h", "1 hour"], ["24h", "24 hours"], ["7d", "7 days"], ["custom", "Custom"]];
const empty = { name: "", purpose: PURPOSES[0], description: "", claims: ["identity_verified"], expiry: "24h", custom_minutes: 120, max_uses: 1, tags: "" };

function Claims({ meta, value, onChange }) {
  const toggle = (k) => onChange(value.includes(k) ? value.filter((c) => c !== k) : [...value, k]);
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {Object.entries(meta.claims).map(([k, label]) => {
        const outside = !meta.org.allowed_claims.includes(k);
        return (
          <label key={k} className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border px-3 text-sm ${value.includes(k) ? "border-emerald-300 bg-emerald-50" : "border-slate-200"}`}>
            <input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={value.includes(k)} onChange={() => toggle(k)} data-testid={`claim-checkbox-${k}`} />
            <span className="flex-1">{label}</span>
            {outside && <span className="text-[10px] font-bold uppercase text-amber-700">Outside policy</span>}
          </label>
        );
      })}
    </div>
  );
}

export function CreateQrDialog({ open, onClose }) {
  const [meta, setMeta] = useState(null);
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  useEffect(() => {
    if (open && !meta) {
      api.get("/nexus/meta").then((r) => setMeta(r.data)).catch((e) => toast.error(errMsg(e)));
    }
  }, [open, meta]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const outside = meta ? f.claims.filter((c) => !meta.org.allowed_claims.includes(c)) : [];

  const submit = async (e) => {
    e.preventDefault();
    if (f.name.trim().length < 2) return toast.error("Give the QR a name (2+ characters).");
    if (f.purpose.trim().length < 3) return toast.error("Describe the purpose of verification.");
    if (!f.claims.length) return toast.error("Select at least one claim.");
    const uses = Number(f.max_uses);
    if (!Number.isInteger(uses) || uses < 1 || uses > 500) return toast.error("Usage limit must be between 1 and 500.");
    setBusy(true);
    try {
      const body = { ...f, max_uses: uses, custom_minutes: f.expiry === "custom" ? Number(f.custom_minutes) : null, tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean) };
      const { data } = await api.post("/nexus/qrs", body);
      if (data.reduced_claims.length) toast.warning(`Policy removed: ${data.reduced_claims.join(", ")}`);
      toast.success("Verification QR created");
      setF(empty);
      onClose();
      nav(`/nexus/qrs/${data.id}`);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-white sm:max-w-2xl" data-testid="create-qr-dialog">
        <DialogHeader><DialogTitle className="font-display text-xl">Create Verification QR</DialogTitle><DialogDescription>The QR holds only an unpredictable link — never identity data or private remarks.</DialogDescription></DialogHeader>
        {!meta ? <Loader2 className="mx-auto my-10 h-6 w-6 animate-spin text-emerald-600" /> : (
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="tid-label">QR name</label><input className="tid-input mt-2" maxLength={80} value={f.name} onChange={set("name")} placeholder="Branch walk-in KYC" data-testid="qr-name-input" /></div>
              <div><label className="tid-label">Purpose</label><input className="tid-input mt-2" list="purposes" maxLength={120} value={f.purpose} onChange={set("purpose")} data-testid="qr-purpose-input" /><datalist id="purposes">{PURPOSES.map((p) => <option key={p} value={p} />)}</datalist></div>
            </div>
            <div><label className="tid-label">Recipient instructions (visible to recipient)</label><textarea className="tid-input mt-2 h-20 py-2" maxLength={500} value={f.description} onChange={set("description")} placeholder="Please verify before your appointment." data-testid="qr-description-input" /></div>
            <div><label className="tid-label">Requested claims</label><div className="mt-2"><Claims meta={meta} value={f.claims} onChange={(claims) => setF({ ...f, claims })} /></div></div>
            {outside.length > 0 && <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="qr-policy-warning"><AlertTriangle className="h-4 w-4" />Trust Firewall will remove claims outside your organisation's policy.</p>}
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label className="tid-label">Expires in</label><select className="tid-input mt-2" value={f.expiry} onChange={set("expiry")} data-testid="qr-expiry-select">{EXPIRIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
              {f.expiry === "custom" && <div><label className="tid-label">Minutes (5–43200)</label><input type="number" min={5} max={43200} className="tid-input mt-2" value={f.custom_minutes} onChange={set("custom_minutes")} data-testid="qr-custom-minutes-input" /></div>}
              <div><label className="tid-label">Usage limit</label><input type="number" min={1} max={500} className="tid-input mt-2" value={f.max_uses} onChange={set("max_uses")} data-testid="qr-max-uses-input" /><p className="mt-1 text-[11px] text-slate-400">1 = single-use</p></div>
            </div>
            <div><label className="tid-label">Internal tags (comma separated, private)</label><input className="tid-input mt-2" value={f.tags} onChange={set("tags")} placeholder="branch-12, priority" data-testid="qr-tags-input" /></div>
            <button className="tid-btn-primary w-full" disabled={busy} data-testid="qr-create-submit-btn">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Create QR code</button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useCallback, useEffect, useState } from "react";
import { Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg, fmt } from "@/lib/api";
import { Loader, PageHeader, StatusBadge, EmptyState } from "@/components/Shared";

function Row({ s, onRevoke, busy }) {
  const shared = Object.entries(s.released_claims || {});
  return (
    <li className="tid-card p-5" data-testid={`consent-row-${s.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600"><Building2 className="h-4 w-4" /></span>
          <div><p className="font-semibold">{s.org_name}</p><p className="text-xs text-slate-500">{s.purpose} · {fmt(s.created_at)}</p></div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge value={s.status} testId="consent-status" />
          {s.status === "active" && s.decision === "ALLOWED" && (
            <button className="tid-btn-ghost text-rose-600" disabled={busy} onClick={() => onRevoke(s.id)} data-testid="consent-revoke-btn">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Revoke</button>
          )}
        </div>
      </div>
      <p className="tid-label mt-4">{shared.length ? "Information shared" : "Nothing was shared"}</p>
      <div className="mt-2 flex flex-wrap gap-2">{(shared.length ? shared.map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`) : s.requested_claims.map((c) => `requested: ${c.replace(/_/g, " ")}`)).map((t) => <span key={t} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-700">{t}</span>)}</div>
    </li>
  );
}

export default function VaultConsents() {
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(null);
  const load = useCallback(() => api.get("/vault/consents").then((r) => setItems(r.data.items)).catch((e) => toast.error(errMsg(e))), []);
  useEffect(() => {
    load();
  }, [load]);
  const revoke = async (id) => {
    setBusy(id);
    try {
      await api.post(`/vault/consents/${id}/revoke`);
      toast.success("Consent revoked. The business can no longer see these claims.");
      load();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  };
  if (!items) return <Loader />;
  return (
    <div data-testid="vault-consents">
      <PageHeader eyebrow="TrustID Vault" title="Consents & Sharing" subtitle="Every organisation that asked, what they received, and one-click revocation." />
      {items.length === 0 ? <EmptyState title="No sharing history" text="When you respond to a business verification QR, it will appear here." /> : (
        <ul className="space-y-4">{items.map((s) => <Row key={s.id} s={s} busy={busy === s.id} onRevoke={revoke} />)}</ul>
      )}
    </div>
  );
}

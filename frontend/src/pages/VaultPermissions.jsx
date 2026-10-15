import { useCallback, useEffect, useState } from "react";
import { ScanFace, Loader2, History } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg, fmt, eventLabel } from "@/lib/api";
import { Loader, PageHeader, EmptyState, StatusBadge } from "@/components/Shared";

function InPerson({ p, reload }) {
  const [enabled, setEnabled] = useState(p.in_person_enabled);
  const [claims, setClaims] = useState(p.in_person_claims);
  const [busy, setBusy] = useState(false);
  const toggle = (k) => setClaims(claims.includes(k) ? claims.filter((c) => c !== k) : [...claims, k]);
  const save = async () => {
    setBusy(true);
    try {
      await api.put("/vault/permissions", { in_person_enabled: enabled, in_person_claims: claims });
      toast.success("Permissions saved");
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="tid-card p-6" data-testid="in-person-permissions">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><ScanFace className="h-5 w-5" /></span><div><h3 className="font-display text-lg font-bold">In-person face verification</h3><p className="max-w-lg text-sm text-slate-500">When a business scans your face at their counter, only the claims you tick here are released. Off by default.</p></div></div>
        <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm font-semibold"><input type="checkbox" className="h-5 w-5 accent-emerald-600" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} data-testid="in-person-toggle" />{enabled ? "Allowed" : "Not allowed"}</label>
      </div>
      <div className={`mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 ${enabled ? "" : "pointer-events-none opacity-40"}`}>
        {Object.entries(p.claims).map(([k, l]) => (
          <label key={k} className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border px-3 text-sm ${claims.includes(k) ? "border-emerald-300 bg-emerald-50" : "border-slate-200"}`}>
            <input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={claims.includes(k)} onChange={() => toggle(k)} data-testid={`perm-claim-${k}`} />{l}
          </label>
        ))}
      </div>
      <button className="tid-btn-primary mt-5" disabled={busy} onClick={save} data-testid="permissions-save-btn">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save permissions</button>
    </section>
  );
}

export default function VaultPermissions() {
  const [p, setP] = useState(null);
  const load = useCallback(() => api.get("/vault/permissions").then((r) => setP(r.data)).catch((e) => toast.error(errMsg(e))), []);
  useEffect(() => {
    load();
  }, [load]);
  if (!p) return <Loader />;
  return (
    <div className="space-y-6" data-testid="vault-permissions">
      <PageHeader eyebrow="Privacy controls" title="Permissions" subtitle="Decide what businesses may learn about you — age, identity status, which documents you hold — and see every decision." />
      <InPerson p={p} reload={load} />
      <section className="tid-card p-6">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold"><History className="h-5 w-5 text-slate-400" />Permission history</h3>
        {p.history.length === 0 ? <div className="mt-4"><EmptyState title="No permission activity yet" /></div> : (
          <ol className="relative mt-5 space-y-5 border-l border-slate-200 pl-6" data-testid="permission-history">
            {p.history.map((h) => (
              <li key={h.id} className="relative"><span className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 ring-1 ring-slate-200" />
                <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{eventLabel(h.event)}</p>{h.decision && <StatusBadge value={h.decision} />}</div>
                <p className="text-xs text-slate-500">{h.detail} · {fmt(h.ts)}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

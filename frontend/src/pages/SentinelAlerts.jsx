import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, errMsg, fmt, eventLabel } from "@/lib/api";
import { Loader, PageHeader, StatusBadge, EmptyState } from "@/components/Shared";

const riskTone = (r) => (r >= 70 ? "bg-rose-500" : r >= 50 ? "bg-amber-500" : "bg-emerald-500");

export default function SentinelAlerts() {
  const [items, setItems] = useState(null);
  useEffect(() => {
    api.get("/sentinel/alerts").then((r) => setItems(r.data.items)).catch((e) => toast.error(errMsg(e)));
  }, []);
  if (!items) return <Loader />;
  return (
    <div data-testid="sentinel-alerts">
      <PageHeader eyebrow="TrustID Sentinel" title="Suspicious Activity" subtitle="Failed face logins, denied access, rejected QR redemptions and escalations from the last 7 days. Network identifiers are hashed." />
      {items.length === 0 ? <EmptyState title="No alerts" text="Nothing suspicious in the last 7 days." /> : (
        <ul className="space-y-3" data-testid="alerts-list">
          {items.map((a) => (
            <li key={a.id} className="tid-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3 sm:w-28"><span className={`h-2.5 w-2.5 rounded-full ${riskTone(a.risk)}`} /><span className="font-mono text-sm font-bold" data-testid="alert-risk">{a.risk}</span><span className="text-xs text-slate-400">risk</span></div>
              <div className="min-w-0 flex-1"><p className="font-semibold">{eventLabel(a.event)}</p><p className="truncate text-xs text-slate-500">{a.detail} · {a.actor_name}{a.ip_hash ? ` · net ${a.ip_hash}` : ""}</p></div>
              <div className="flex items-center gap-2"><StatusBadge value={a.severity} /><span className="whitespace-nowrap text-xs text-slate-400">{fmt(a.ts)}</span></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

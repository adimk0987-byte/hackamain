import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg, fmt, eventLabel } from "@/lib/api";
import { Loader, PageHeader, StatusBadge, EmptyState } from "@/components/Shared";
import { usePortal } from "@/components/AppShell";

const TITLES = { citizen: "My Activity", business: "Organisation Activity", government: "Audit Log" };

export default function AuditPage() {
  const portal = usePortal();
  const [page, setPage] = useState(1);
  const [event, setEvent] = useState("");
  const [data, setData] = useState(null);
  useEffect(() => {
    setData(null);
    api.get("/audit", { params: { portal, page, event } }).then((r) => setData(r.data)).catch((e) => toast.error(errMsg(e)));
  }, [portal, page, event]);
  return (
    <div data-testid="audit-page">
      <PageHeader eyebrow="Audit trail" title={TITLES[portal]} subtitle="Who did what, when, and the policy decision. Raw tokens, passwords and biometric data are never logged." />
      <div className="tid-card p-4 sm:p-6">
        <input className="tid-input sm:w-72" value={event} onChange={(e) => { setEvent(e.target.value.trim()); setPage(1); }} placeholder="Filter by exact event, e.g. qr_created" data-testid="audit-event-filter" />
        {!data ? <Loader /> : data.items.length === 0 ? <div className="mt-4"><EmptyState title="No events" /></div> : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm" data-testid="audit-table">
              <thead><tr className="text-left text-xs uppercase tracking-wider text-slate-500"><th className="py-3">Time</th><th>Event</th><th>Actor</th><th>Decision</th><th>Detail</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((a) => (
                  <tr key={a.id}><td className="whitespace-nowrap py-3 text-slate-500">{fmt(a.ts)}</td><td className="font-semibold">{eventLabel(a.event)}</td><td>{a.actor_name}</td><td>{a.decision ? <StatusBadge value={a.decision} /> : "—"}</td><td className="max-w-xs truncate text-slate-500" title={a.detail}>{a.detail}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 flex items-center justify-end gap-2 text-sm text-slate-500">
              <button className="tid-btn-ghost px-3" disabled={page <= 1} onClick={() => setPage(page - 1)} data-testid="audit-prev"><ChevronLeft className="h-4 w-4" /></button>
              <span>Page {data.page} of {data.pages}</span>
              <button className="tid-btn-ghost px-3" disabled={page >= data.pages} onClick={() => setPage(page + 1)} data-testid="audit-next"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

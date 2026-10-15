import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg, fmt } from "@/lib/api";
import { Loader, PageHeader, StatusBadge, EmptyState } from "@/components/Shared";
import { CreateQrDialog } from "@/components/CreateQrDialog";

const STATUSES = ["all", "active", "expired", "revoked", "completed"];

export default function NexusQrs() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      api.get("/nexus/qrs", { params: { q, status, page, page_size: 10 } }).then((r) => setData(r.data)).catch((e) => toast.error(errMsg(e)));
    }, 250);
    return () => clearTimeout(t);
  }, [q, status, page]);
  return (
    <div data-testid="nexus-qrs">
      <PageHeader eyebrow="TrustID Nexus" title="QR Codes" subtitle="Search, filter and manage every verification request."
        action={<button className="tid-btn-primary" onClick={() => setOpen(true)} data-testid="create-qr-btn"><Plus className="h-4 w-4" />Create Verification QR</button>} />
      <div className="tid-card p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1"><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input className="tid-input pl-9" placeholder="Search name, purpose or tag" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} data-testid="qr-search-input" /></div>
          <select className="tid-input sm:w-48" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} data-testid="qr-status-filter">{STATUSES.map((s) => <option key={s} value={s}>{s === "all" ? "All statuses" : s}</option>)}</select>
        </div>
        {!data ? <Loader /> : data.items.length === 0 ? <div className="mt-6"><EmptyState title="No QR codes found" text="Create your first verification QR to get started." /></div> : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm" data-testid="qr-table">
              <thead><tr className="text-left text-xs uppercase tracking-wider text-slate-500"><th className="py-3">Name</th><th>Purpose</th><th>Uses</th><th>Expires</th><th>Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50" data-testid={`qr-row-${r.id}`}>
                    <td className="py-3"><Link to={`/nexus/qrs/${r.id}`} className="font-semibold text-slate-900 hover:text-emerald-700" data-testid="qr-row-link">{r.name}</Link><div className="mt-1 flex gap-1">{r.tags.map((t) => <span key={t} className="rounded bg-slate-100 px-1.5 text-[10px] text-slate-600">{t}</span>)}</div></td>
                    <td className="text-slate-600">{r.purpose}</td><td>{r.uses}/{r.max_uses}</td><td className="whitespace-nowrap text-slate-500">{fmt(r.expires_at)}</td><td><StatusBadge value={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
              <span data-testid="qr-total">{data.total} total</span>
              <div className="flex items-center gap-2">
                <button className="tid-btn-ghost px-3" disabled={page <= 1} onClick={() => setPage(page - 1)} data-testid="qr-prev-page"><ChevronLeft className="h-4 w-4" /></button>
                <span>Page {data.page} of {data.pages}</span>
                <button className="tid-btn-ghost px-3" disabled={page >= data.pages} onClick={() => setPage(page + 1)} data-testid="qr-next-page"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        )}
      </div>
      <CreateQrDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

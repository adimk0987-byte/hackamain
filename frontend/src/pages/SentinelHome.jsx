import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, FolderOpen, Clock, AlertOctagon, ShieldAlert, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg, fmt } from "@/lib/api";
import { Loader, PageHeader, StatCard, StatusBadge, EmptyState, DemoTag } from "@/components/Shared";

export default function SentinelHome() {
  const [stats, setStats] = useState(null);
  const [q, setQ] = useState("");
  const [cases, setCases] = useState(null);
  useEffect(() => {
    api.get("/sentinel/stats").then((r) => setStats(r.data)).catch((e) => toast.error(errMsg(e)));
  }, []);
  useEffect(() => {
    const t = setTimeout(() => api.get("/sentinel/cases", { params: { q } }).then((r) => setCases(r.data)).catch((e) => toast.error(errMsg(e))), 300);
    return () => clearTimeout(t);
  }, [q]);
  if (!stats) return <Loader />;
  return (
    <div data-testid="sentinel-home">
      <PageHeader eyebrow="TrustID Sentinel · Government portal" title="Case Oversight" subtitle="You see only cases assigned to you. Opening a case requires a declared purpose." action={<DemoTag />} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Assigned cases" value={stats.assigned} icon={FolderOpen} tone="purple" testId="stat-assigned" />
        <StatCard label="Open / in review" value={stats.open} icon={Clock} tone="blue" testId="stat-open" />
        <StatCard label="Escalated" value={stats.escalated} icon={AlertOctagon} tone="rose" testId="stat-escalated" />
        <StatCard label="Alerts (7 days)" value={stats.alerts_7d} icon={ShieldAlert} tone="amber" testId="stat-alerts" />
      </div>
      <div className="tid-card mt-6 p-4 sm:p-6">
        <div className="relative"><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input className="tid-input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by case reference, e.g. CASE-2026-0012" data-testid="case-search-input" /></div>
        {cases?.denied && <p className="mt-4 flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700" data-testid="case-access-denied"><ShieldOff className="mt-0.5 h-4 w-4 shrink-0" /><span><b>{cases.denied.ref}:</b> {cases.denied.reason} This attempt was logged.</span></p>}
        {!cases ? <Loader /> : cases.items.length === 0 ? <div className="mt-4"><EmptyState title="No matching assigned cases" /></div> : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm" data-testid="case-table">
              <thead><tr className="text-left text-xs uppercase tracking-wider text-slate-500"><th className="py-3">Reference</th><th>Title</th><th>Category</th><th>Priority</th><th>Status</th><th>Opened</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {cases.items.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="py-3"><Link to={`/sentinel/cases/${c.id}`} className="font-mono font-semibold text-violet-700 hover:underline" data-testid={`case-link-${c.ref}`}>{c.ref}</Link></td>
                    <td>{c.title}</td><td className="text-slate-500">{c.category}</td><td><StatusBadge value={c.priority} /></td><td><StatusBadge value={c.status} /></td><td className="whitespace-nowrap text-slate-500">{fmt(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Link to="/sentinel/alerts" className="tid-btn-ghost mt-6" data-testid="view-alerts-btn"><ShieldAlert className="h-4 w-4" />Review suspicious activity</Link>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, QrCode, CircleCheck, Ban, Activity, XCircle, CheckCircle2 } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { Loader, PageHeader, StatCard, ActivityList, EmptyState } from "@/components/Shared";
import { CreateQrDialog } from "@/components/CreateQrDialog";

export default function NexusHome() {
  const [s, setS] = useState(null);
  const [meta, setMeta] = useState(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    api.get("/nexus/stats").then((r) => setS(r.data)).catch((e) => toast.error(errMsg(e)));
    api.get("/nexus/meta").then((r) => setMeta(r.data)).catch(() => {});
  }, []);
  if (!s) return <Loader />;
  const hasData = s.series.some((d) => d.completed || d.rejected);
  return (
    <div data-testid="nexus-home">
      <PageHeader eyebrow={meta ? meta.org.name : "TrustID Nexus"} title="Verification Hub" subtitle="Live numbers from your organisation's QR requests."
        action={<button className="tid-btn-primary" onClick={() => setOpen(true)} data-testid="create-qr-btn"><Plus className="h-4 w-4" />Create Verification QR</button>} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <StatCard label="Total QRs" value={s.total} icon={QrCode} testId="stat-total" />
        <StatCard label="Active" value={s.active} icon={CircleCheck} tone="emerald" testId="stat-active" />
        <StatCard label="Expired / Revoked" value={`${s.expired} / ${s.revoked}`} icon={Ban} tone="amber" testId="stat-expired-revoked" />
        <StatCard label="Attempts" value={s.attempts} icon={Activity} tone="blue" testId="stat-attempts" />
        <StatCard label="Completed" value={s.completed} icon={CheckCircle2} tone="emerald" testId="stat-completed" />
        <StatCard label="Rejected" value={s.rejected} icon={XCircle} tone="rose" testId="stat-rejected" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="tid-card p-6">
          <h3 className="font-display text-lg font-bold">Verifications · last 7 days</h3>
          {hasData ? (
            <div className="mt-4 h-64" data-testid="nexus-chart">
              <ResponsiveContainer><BarChart data={s.series}><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} /><XAxis dataKey="day" fontSize={12} /><YAxis allowDecimals={false} fontSize={12} /><Tooltip /><Bar dataKey="completed" fill="#10B981" radius={[6, 6, 0, 0]} /><Bar dataKey="rejected" fill="#F43F5E" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>
            </div>
          ) : <div className="mt-4"><EmptyState title="No verifications yet" text="Share a QR and responses will chart here." testId="chart-empty" /></div>}
        </div>
        <div className="tid-card p-6">
          <div className="flex items-center justify-between"><h3 className="font-display text-lg font-bold">Recent activity</h3><Link to="/audit?portal=business" className="text-xs font-semibold text-emerald-700" data-testid="nexus-activity-all">View all</Link></div>
          <ActivityList items={s.recent} />
        </div>
      </div>
      {meta && (
        <div className="tid-card mt-6 p-6" data-testid="org-policy">
          <h3 className="font-display text-lg font-bold">Organisation claim policy</h3>
          <p className="text-sm text-slate-500">The Trust Firewall only releases these claims for {meta.org.name}.</p>
          <div className="mt-3 flex flex-wrap gap-2">{meta.org.allowed_claims.map((c) => <span key={c} className="rounded-lg bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{meta.claims[c]}</span>)}</div>
        </div>
      )}
      <CreateQrDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

import { Loader2, Inbox } from "lucide-react";
import { eventLabel, timeAgo } from "@/lib/api";

const TONES = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
};
const MAP = {
  active: "green", verified: "green", ALLOWED: "green", match: "green", valid: "green", trusted: "green", info: "slate",
  expired: "amber", pending: "amber", under_review: "amber", CONSENT_REQUIRED: "amber", declined: "amber", medium: "amber", warn: "amber", REDUCED: "amber", open: "blue",
  revoked: "rose", DENIED: "rose", mismatch: "rose", high: "rose", escalated: "rose", flagged: "rose", REVOKED: "rose", EXPIRED: "amber",
  completed: "blue", cleared: "blue", low: "slate", subject_deleted: "slate",
};

export function StatusBadge({ value, testId }) {
  const tone = TONES[MAP[value] || "slate"];
  return (
    <span data-testid={testId} className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${tone}`}>
      {String(value).replace(/_/g, " ").toLowerCase()}
    </span>
  );
}

export function Loader({ label = "Loading…" }) {
  return (
    <div data-testid="loader" className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin text-emerald-600" /> {label}
    </div>
  );
}

export function EmptyState({ title, text, action, testId = "empty-state" }) {
  return (
    <div data-testid={testId} className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
      <Inbox className="h-8 w-8 text-slate-300" />
      <p className="mt-3 font-display font-semibold text-slate-800">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

const ICON_TONES = {
  emerald: "bg-emerald-50 text-emerald-600", blue: "bg-blue-50 text-blue-600", amber: "bg-amber-50 text-amber-600",
  rose: "bg-rose-50 text-rose-600", purple: "bg-violet-50 text-violet-600", slate: "bg-slate-100 text-slate-600",
};

export function StatCard({ label, value, icon: Icon, tone = "emerald", testId }) {
  return (
    <div className="tid-card p-5 rise" data-testid={testId}>
      <div className="flex items-center justify-between">
        <span className="tid-label">{label}</span>
        {Icon && <span className={`grid h-9 w-9 place-items-center rounded-xl ${ICON_TONES[tone]}`}><Icon className="h-4 w-4" /></span>}
      </div>
      <p className="mt-3 font-display text-3xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

export function PageHeader({ title, subtitle, action, eyebrow }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="tid-label text-emerald-700">{eyebrow}</p>}
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl" data-testid="page-title">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function ActivityList({ items, testId = "activity-list" }) {
  if (!items?.length) return <EmptyState title="No activity yet" text="Security and verification events will appear here." testId={`${testId}-empty`} />;
  return (
    <ul className="divide-y divide-slate-100" data-testid={testId}>
      {items.map((a) => (
        <li key={a.id} className="flex items-start justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">{eventLabel(a.event)}</p>
            <p className="truncate text-xs text-slate-500">{a.detail || a.actor_name}</p>
          </div>
          <span className="shrink-0 text-xs text-slate-400">{timeAgo(a.ts)}</span>
        </li>
      ))}
    </ul>
  );
}

export function DemoTag() {
  return <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">Synthetic demo data</span>;
}

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ScanFace, ArrowRight, Lock, Sparkles, EyeOff, IdCard, Handshake, Activity, QrCode, ShieldCheck, ScanLine, KeyRound, Timer, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg, fmt } from "@/lib/api";
import { Loader, StatusBadge, ActivityList, DemoTag } from "@/components/Shared";

function Hero({ enrolled }) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-slate-950 text-white" data-testid="vault-hero">
      <img src="/hero-face.jpg" alt="" className="absolute inset-y-0 right-0 h-full w-full object-cover object-[center_38%] opacity-95 sm:w-1/2" />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/70 to-transparent" />
      <div className="pointer-events-none absolute right-[14%] top-1/2 hidden h-40 w-32 -translate-y-1/2 rounded-[40%] border-2 border-emerald-400/70 shadow-[0_0_30px_rgba(52,211,153,.35)] sm:block"><div className="scan-beam" /></div>
      <div className="relative p-6 sm:p-8">
        <p className="tid-label text-emerald-300">FaceGate</p>
        <h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl">{enrolled ? "Your face is your key" : "Scan Your Face"}</h2>
        <p className="mt-2 max-w-sm text-sm text-slate-300">{enrolled ? "FaceGate login is active for this account. Re-enrol any time from Settings." : "Enrol FaceGate to log in with a quick camera scan."}</p>
        <Link to="/settings?portal=citizen#face" className="tid-btn mt-5 bg-emerald-500 text-slate-950 hover:bg-emerald-400" data-testid="start-scanning-btn"><ScanFace className="h-4 w-4" />{enrolled ? "Manage FaceGate" : "Start Scanning"}<ArrowRight className="h-4 w-4" /></Link>
        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-300">
          {[[ScanLine, "Face Recognition"], [Lock, "Encrypted Templates"], [Sparkles, "Claim-level Sharing"], [EyeOff, "Privacy First"]].map(([I, t]) => <span key={t} className="flex items-center gap-1.5"><I className="h-3.5 w-3.5 text-emerald-400" />{t}</span>)}
        </div>
      </div>
    </section>
  );
}

function Credentials({ creds }) {
  const [tab, setTab] = useState("all");
  const rows = creds.filter((c) => tab === "all" || c.status === tab);
  return (
    <section className="tid-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="font-display text-xl font-bold">Your Credential Vault</h3><p className="text-sm text-slate-500">Synthetic credentials issued by demo issuers.</p></div>
        <DemoTag />
      </div>
      <div className="mt-4 flex gap-1 border-b border-slate-100">
        {["all", "verified", "pending"].map((t) => <button key={t} onClick={() => setTab(t)} data-testid={`cred-tab-${t}`} className={`min-h-[44px] px-4 text-sm capitalize ${tab === t ? "border-b-2 border-emerald-500 font-semibold text-emerald-700" : "text-slate-500"}`}>{t}</button>)}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {rows.map((c) => (
          <div key={c.id} className="rounded-2xl border border-slate-200 p-4 transition-shadow hover:shadow-md" data-testid="credential-card">
            <div className="flex items-start justify-between"><CreditCard className="h-8 w-8 text-slate-700" /><StatusBadge value={c.status} /></div>
            <p className="mt-4 font-semibold">{c.type}</p>
            <p className="text-xs text-slate-500">{c.issuer}</p>
            <p className="mt-3 font-mono text-xs text-slate-600">{c.number}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function QuickActions() {
  const nav = useNavigate();
  const [link, setLink] = useState("");
  const open = () => {
    const m = link.match(/\/v\/([\w-]{10,100})/) || link.match(/^([\w-]{10,100})$/);
    if (!m) return toast.error("Paste a valid TrustID verification link.");
    nav(`/v/${m[1]}`);
  };
  const tiles = [["View My Identity", "/vault/identity", IdCard, "bg-blue-50 text-blue-600"], ["Manage Consents", "/vault/consents", Handshake, "bg-emerald-50 text-emerald-600"], ["View Activity", "/audit?portal=citizen", Activity, "bg-violet-50 text-violet-600"]];
  return (
    <section>
      <h3 className="font-display text-xl font-bold">Quick Actions</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {tiles.map(([t, to, I, tone]) => <Link key={t} to={to} data-testid={`quick-${t.toLowerCase().replace(/\s/g, "-")}`} className="tid-card flex items-center gap-3 p-4 transition-transform hover:-translate-y-0.5"><span className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}><I className="h-4 w-4" /></span><span className="text-sm font-semibold">{t}</span></Link>)}
      </div>
      <div className="tid-card mt-3 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <QrCode className="h-5 w-5 shrink-0 text-emerald-600" />
        <input className="tid-input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="Paste a verification link you received…" data-testid="open-link-input" />
        <button onClick={open} className="tid-btn-dark shrink-0" data-testid="open-link-btn">Open request</button>
      </div>
    </section>
  );
}

function RightColumn({ d }) {
  const p = d.profile;
  const sec = [[ScanFace, "Face Recognition", d.face_enrolled ? "active" : "not set"], [Lock, "Encrypted Template Storage", d.face_enrolled ? "active" : "not set"], [KeyRound, "Liveness Detection", "not available"], [Timer, "Session Expiry (30 min)", "active"]];
  return (
    <aside className="flex w-full flex-col gap-5 lg:w-80 lg:shrink-0">
      <div className="tid-card p-5" data-testid="welcome-card">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-slate-900 font-display text-lg font-bold text-white">{p.display_name[0]}</span>
          <div className="min-w-0"><p className="text-xs text-slate-500">Welcome back,</p><p className="truncate font-display text-lg font-bold">{p.display_name}</p><p className="font-mono text-[11px] text-slate-500">{p.trust_id}</p></div>
        </div>
        <div className="mt-5 grid grid-cols-3 text-center">
          {[["Credentials", d.stats.credentials], ["Verifications", d.stats.verifications], ["Active shares", d.stats.active_shares]].map(([l, v]) => <div key={l}><p className="font-display text-2xl font-bold" data-testid={`stat-${l.toLowerCase().replace(/\s/g, "-")}`}>{v}</p><p className="text-[11px] text-slate-500">{l}</p></div>)}
        </div>
        <div className="mt-5 flex items-center gap-3 rounded-xl bg-emerald-50 p-3"><ShieldCheck className="h-8 w-8 text-emerald-600" /><div><p className="text-sm font-semibold text-emerald-800">Identity Secured</p><p className="text-xs text-emerald-700/80">Shares only happen with your consent.</p></div></div>
      </div>
      <div className="tid-card p-5" data-testid="security-status">
        <div className="flex items-center justify-between"><h4 className="font-display font-bold">Security Status</h4><Link to="/settings?portal=citizen" className="text-xs font-semibold text-emerald-700" data-testid="security-details-link">Manage</Link></div>
        <ul className="mt-3 space-y-3">{sec.map(([I, t, s]) => <li key={t} className="flex items-center justify-between gap-2 text-sm"><span className="flex items-center gap-2 text-slate-700"><I className="h-4 w-4 text-slate-400" />{t}</span><StatusBadge value={s === "active" ? "active" : s} /></li>)}</ul>
        <p className="mt-3 text-[11px] text-slate-400">Session valid until {fmt(d.session_expires_at)}</p>
      </div>
      <div className="tid-card p-5"><div className="flex items-center justify-between"><h4 className="font-display font-bold">Recent Activity</h4><Link to="/audit?portal=citizen" className="text-xs font-semibold text-emerald-700" data-testid="activity-view-all">View all</Link></div><ActivityList items={d.activity.slice(0, 6)} /></div>
    </aside>
  );
}

export default function VaultHome() {
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    api.get("/vault/overview").then((r) => setD(r.data)).catch((e) => setError(errMsg(e)));
  }, []);
  if (error) return <p className="text-rose-600" data-testid="vault-error">{error}</p>;
  if (!d) return <Loader />;
  return (
    <div className="flex flex-col gap-6 lg:flex-row" data-testid="vault-home">
      <div className="flex min-w-0 flex-1 flex-col gap-6"><Hero enrolled={d.face_enrolled} /><Credentials creds={d.profile.credentials} /><QuickActions /></div>
      <RightColumn d={d} />
    </div>
  );
}

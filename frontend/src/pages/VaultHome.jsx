import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ScanFace, ArrowRight, Lock, Sparkles, EyeOff, ScanLine, FolderOpen, BadgeCheck, FilePlus2, Activity, ShieldCheck, KeyRound, Timer, Fingerprint, Copy, Upload, ChevronRight, QrCode } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg, fmt } from "@/lib/api";
import { Loader, StatusBadge, ActivityList, EmptyState } from "@/components/Shared";
import { DocCard, DocViewer, UploadDocDialog, DOC_TABS } from "@/components/Documents";

function Hero({ enrolled }) {
  return (
    <section className="relative min-h-[300px] overflow-hidden rounded-3xl bg-[#0B1626] text-white" data-testid="vault-hero">
      <img src="/hero-face.jpg" alt="Face scan" className="absolute inset-y-0 right-0 h-full w-full object-cover object-right sm:w-[68%]" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0B1626] via-[#0B1626]/85 to-transparent sm:via-[#0B1626]/60" />
      <div className="relative p-6 sm:p-8">
        <p className="tid-label text-slate-400">Owner mode</p>
        <h2 className="mt-2 font-display text-4xl font-bold sm:text-5xl">Scan Your Face</h2>
        <p className="mt-2 max-w-xs text-sm text-slate-300">{enrolled ? "Your face unlocks your personal document vault securely." : "Enrol your face to link and unlock your personal document vault."}</p>
        <Link to="/vault/face" className="tid-btn mt-5 bg-emerald-100 text-emerald-900 hover:bg-emerald-200" data-testid="start-scanning-btn"><ScanFace className="h-4 w-4" />{enrolled ? "Re-scan Face" : "Start Scanning"}<ArrowRight className="h-4 w-4" /></Link>
      </div>
      <div className="relative grid grid-cols-2 gap-3 border-t border-white/10 bg-[#0B1626]/70 px-6 py-4 backdrop-blur sm:grid-cols-4 sm:px-8">
        {[[ScanLine, "Face Recognition", "matched by server"], [Lock, "Encrypted", "Document Vault"], [Sparkles, "Claim-level", "Verification"], [EyeOff, "Privacy First", "consent based"]].map(([I, t, s]) => (
          <div key={t} className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10"><I className="h-4 w-4 text-emerald-300" /></span><div className="leading-tight"><p className="text-xs font-semibold">{t}</p><p className="text-[10px] text-slate-400">{s}</p></div></div>
        ))}
      </div>
    </section>
  );
}

function VaultSection({ docs, enrolled, onOpen, onUpload }) {
  const [tab, setTab] = useState("all");
  const rows = docs.filter((d) => tab === "all" || d.doc_type === tab);
  return (
    <section className="tid-card p-5 sm:p-6" data-testid="document-vault">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="font-display text-2xl font-bold">Your Document Vault</h3><p className="text-sm text-slate-500">View, upload and manage your identity documents securely.</p></div>
        <button className="tid-btn bg-[#0F3D2E] text-white hover:bg-[#0B2F23]" onClick={() => onUpload(tab)} disabled={!enrolled} data-testid="upload-document-btn"><Upload className="h-4 w-4" />Upload Document</button>
      </div>
      <div className="mt-4 flex gap-1 overflow-x-auto border-b border-slate-100">
        {DOC_TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k)} data-testid={`doc-tab-${k}`} className={`min-h-[44px] whitespace-nowrap px-3 text-sm ${tab === k ? "border-b-2 border-emerald-600 font-semibold text-emerald-800" : "text-slate-500 hover:text-slate-800"}`}>{l}</button>)}
      </div>
      {!enrolled && <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800" data-testid="face-required-notice">Enrol your face first — documents are linked to and unlocked by your face. <Link to="/vault/face" className="font-semibold underline">Enrol now</Link></p>}
      <div className="mt-4">
        {rows.length === 0 ? <EmptyState title="No documents here yet" text="Upload your Aadhaar, PAN, Voter ID, Driving License or Passport. Files are encrypted and visible only to you." testId="docs-empty" /> : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{rows.slice(0, 8).map((d) => <DocCard key={d.id} doc={d} onOpen={onOpen} />)}</div>
        )}
        {rows.length > 8 && <Link to="/vault/documents" className="mt-3 inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-emerald-700" data-testid="docs-view-all">View all {rows.length} <ChevronRight className="h-4 w-4" /></Link>}
      </div>
    </section>
  );
}

function QuickActions({ onUpload }) {
  const nav = useNavigate();
  const [link, setLink] = useState("");
  const tiles = [
    ["View My Documents", "Access your encrypted files", FolderOpen, "bg-blue-50", "bg-blue-500", () => nav("/vault/documents")],
    ["Verify My Identity", "Re-scan your face", BadgeCheck, "bg-emerald-50", "bg-emerald-500", () => nav("/vault/face")],
    ["Add New Document", "Upload and secure a file", FilePlus2, "bg-violet-50", "bg-violet-500", () => onUpload("all")],
    ["View Activity", "Recent logins and shares", Activity, "bg-slate-100", "bg-slate-500", () => nav("/audit?portal=citizen")],
  ];
  const open = () => {
    const m = link.match(/\/v\/([\w-]{10,100})/) || link.match(/^([\w-]{10,100})$/);
    if (!m) return toast.error("Paste a valid TrustID verification link.");
    nav(`/v/${m[1]}`);
  };
  return (
    <section>
      <h3 className="font-display text-2xl font-bold">Quick Actions</h3>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(([t, s, I, bg, dot, fn]) => (
          <button key={t} onClick={fn} className={`rounded-2xl ${bg} p-4 text-left transition-transform hover:-translate-y-0.5`} data-testid={`quick-${t.toLowerCase().replace(/\s/g, "-")}`}>
            <span className={`grid h-9 w-9 place-items-center rounded-full ${dot} text-white`}><I className="h-4 w-4" /></span>
            <p className="mt-3 text-sm font-semibold text-slate-900">{t}</p><p className="text-xs text-slate-500">{s}</p>
          </button>
        ))}
      </div>
      <div className="tid-card mt-3 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <QrCode className="h-5 w-5 shrink-0 text-emerald-600" />
        <input className="tid-input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="Got a verification link from a business? Paste it here" data-testid="open-link-input" />
        <button onClick={open} className="tid-btn-dark shrink-0" data-testid="open-link-btn">Open request</button>
      </div>
    </section>
  );
}

function RightColumn({ d }) {
  const p = d.profile;
  const sec = [[ScanFace, "Face Recognition", d.face_enrolled ? "active" : "not set"], [Lock, "Encrypted Documents", "active"], [Fingerprint, "Liveness Detection", "not available"], [Timer, "Session Expiry", "active"]];
  const copy = () => navigator.clipboard.writeText(p.trust_id).then(() => toast.success("TrustID copied")).catch(() => toast.error("Copy failed"));
  return (
    <aside className="flex w-full flex-col gap-5 xl:w-80 xl:shrink-0">
      <div className="tid-card p-5 text-center" data-testid="welcome-card">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-slate-900 font-display text-2xl font-bold text-white">{p.display_name[0]}</span>
        <p className="mt-3 text-xs text-slate-500">Welcome back,</p>
        <p className="font-display text-xl font-bold" data-testid="welcome-name">{p.display_name}</p>
        <button onClick={copy} className="mx-auto mt-1 flex min-h-[32px] items-center gap-1 font-mono text-[11px] text-slate-500 hover:text-slate-800" data-testid="copy-trustid-btn">{p.trust_id}<Copy className="h-3 w-3" /></button>
        <div className="mt-4 grid grid-cols-3 border-t border-slate-100 pt-4">
          {[["Documents", d.stats.documents], ["Verifications", d.stats.verifications], ["Shared", d.stats.active_shares]].map(([l, v]) => <div key={l}><p className="font-display text-2xl font-bold" data-testid={`stat-${l.toLowerCase()}`}>{v}</p><p className="text-[11px] text-slate-500">{l}</p></div>)}
        </div>
        <div className={`mt-4 flex items-center gap-3 rounded-xl p-3 text-left ${d.face_enrolled ? "bg-emerald-50" : "bg-amber-50"}`}><ShieldCheck className={`h-8 w-8 shrink-0 ${d.face_enrolled ? "text-emerald-600" : "text-amber-600"}`} /><div><p className={`text-sm font-semibold ${d.face_enrolled ? "text-emerald-800" : "text-amber-800"}`}>{d.face_enrolled ? "Identity Secured" : "Face not enrolled"}</p><p className="text-xs text-slate-600">{d.face_enrolled ? "Your documents are encrypted and linked to your face." : "Enrol FaceGate to secure your vault."}</p></div></div>
      </div>
      <div className="tid-card p-5" data-testid="security-status">
        <div className="flex items-center justify-between"><h4 className="font-display font-bold">Security Status</h4><Link to="/settings?portal=citizen" className="text-xs font-semibold text-emerald-700" data-testid="security-details-link">View Details</Link></div>
        <ul className="mt-3 space-y-3">{sec.map(([I, t, s]) => <li key={t} className="flex items-center justify-between gap-2 text-sm"><span className="flex items-center gap-2 text-slate-700"><I className="h-4 w-4 text-slate-400" />{t}</span><StatusBadge value={s} /></li>)}</ul>
        <p className="mt-3 text-[11px] text-slate-400">Session valid until {fmt(d.session_expires_at)}</p>
      </div>
      <div className="tid-card p-5"><div className="flex items-center justify-between"><h4 className="font-display font-bold">Recent Activity</h4><Link to="/audit?portal=citizen" className="text-xs font-semibold text-emerald-700" data-testid="activity-view-all">View All</Link></div><ActivityList items={d.activity.slice(0, 6)} /></div>
    </aside>
  );
}

export default function VaultHome() {
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [upload, setUpload] = useState(null);
  const load = () => api.get("/vault/overview").then((r) => setD(r.data)).catch((e) => setError(errMsg(e)));
  useEffect(() => {
    load();
  }, []);
  if (error) return <p className="text-rose-600" data-testid="vault-error">{error}</p>;
  if (!d) return <Loader />;
  return (
    <div className="flex flex-col gap-6 xl:flex-row" data-testid="vault-home">
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <Hero enrolled={d.face_enrolled} />
        <VaultSection docs={d.documents} enrolled={d.face_enrolled} onOpen={setViewing} onUpload={setUpload} />
        <QuickActions onUpload={(t) => (d.face_enrolled ? setUpload(t) : toast.error("Enrol your face first."))} />
      </div>
      <RightColumn d={d} />
      <UploadDocDialog open={upload !== null} defaultType={upload || "aadhaar"} onClose={() => setUpload(null)} onUploaded={load} />
      {viewing && <DocViewer doc={viewing} onClose={() => setViewing(null)} onDeleted={load} />}
    </div>
  );
}

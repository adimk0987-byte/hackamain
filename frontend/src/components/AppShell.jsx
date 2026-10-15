import { useState } from "react";
import { NavLink, Link, useLocation, useSearchParams } from "react-router-dom";
import { Home, ScanFace, FolderLock, BadgeCheck, Activity, Settings, LifeBuoy, LayoutDashboard, QrCode, ShieldAlert, ScrollText, LogOut, Menu, X, Clock, Bell, Repeat } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";

const NAV = {
  citizen: [["Home", "/vault", Home], ["Face Scan", "/vault/face", ScanFace], ["My Vault", "/vault/documents", FolderLock], ["Verifications", "/vault/consents", BadgeCheck], ["Activity", "/audit?portal=citizen", Activity]],
  business: [["Dashboard", "/nexus", LayoutDashboard], ["QR Codes", "/nexus/qrs", QrCode], ["Activity", "/audit?portal=business", Activity]],
  government: [["Overview", "/sentinel", LayoutDashboard], ["Alerts", "/sentinel/alerts", ShieldAlert], ["Audit Log", "/audit?portal=government", ScrollText]],
};
const TAGLINE = { citizen: "Premium Identity Verification", business: "Business Verification Hub", government: "Government Verification" };

export function usePortal() {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const { user } = useAuth();
  let p = pathname.startsWith("/nexus") ? "business" : pathname.startsWith("/sentinel") ? "government" : pathname.startsWith("/vault") ? "citizen" : params.get("portal") || sessionStorage.getItem("tid_portal");
  if (!p || !user?.roles.includes(p)) p = user?.roles[0] || "citizen";
  sessionStorage.setItem("tid_portal", p);
  return p;
}

function NavItem({ label, to, icon: Icon, onNav }) {
  const { pathname, search } = useLocation();
  const active = to.includes("?") ? pathname + search === to : pathname === to;
  return (
    <NavLink to={to} onClick={onNav} data-testid={`nav-${label.toLowerCase().replace(/[\s&]+/g, "-")}`}
      className={`flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm transition-colors ${active ? "bg-emerald-50 font-semibold text-emerald-800" : "text-slate-600 hover:bg-slate-50"}`}>
      <Icon className="h-[18px] w-[18px]" /> {label}
    </NavLink>
  );
}

function Sidebar({ portal, onNav }) {
  const { user } = useAuth();
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-6 pt-6"><Logo to="/" /></div>
      <nav className="flex flex-col gap-1 px-3">{NAV[portal].map(([l, t, i]) => <NavItem key={t} label={l} to={t} icon={i} onNav={onNav} />)}</nav>
      <div className="mt-6 flex flex-col gap-1 border-t border-slate-100 px-3 pt-4">
        <NavItem label="Settings" to={`/settings?portal=${portal}`} icon={Settings} onNav={onNav} />
        <NavItem label="Help & Support" to={`/help?portal=${portal}`} icon={LifeBuoy} onNav={onNav} />
        {user.roles.length > 1 && <NavItem label="Switch Portal" to="/" icon={Repeat} onNav={onNav} />}
      </div>
      <div className="mt-auto p-6">
        <p className="font-display text-xl font-bold leading-tight text-slate-900">Your Identity.<br />Your Control.</p>
        <p className="mt-2 text-xs text-slate-500">Verify only what is needed, without sharing your documents.</p>
      </div>
    </div>
  );
}

function SessionClock() {
  const { expiresAt } = useAuth();
  if (!expiresAt) return null;
  const mins = Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 60000));
  return <span className="hidden items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 md:flex" data-testid="session-clock"><Clock className="h-3.5 w-3.5" />Session · {mins} min</span>;
}

export function AppShell({ children }) {
  const { user, logout } = useAuth();
  const portal = usePortal();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen bg-[#F6F8FA]">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-slate-200 bg-white lg:block"><Sidebar portal={portal} /></aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-white shadow-xl">
            <button className="absolute right-3 top-5 grid h-11 w-11 place-items-center" onClick={() => setOpen(false)} data-testid="mobile-nav-close"><X className="h-5 w-5" /></button>
            <Sidebar portal={portal} onNav={() => setOpen(false)} />
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-slate-200 bg-white/85 px-4 py-3 backdrop-blur-xl sm:px-6">
          <button className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 lg:hidden" onClick={() => setOpen(true)} data-testid="mobile-nav-open"><Menu className="h-5 w-5" /></button>
          <div className="ml-auto flex items-center gap-3">
            <SessionClock />
            <Link to={`/audit?portal=${portal}`} className="grid h-11 w-11 place-items-center rounded-xl text-slate-500 hover:bg-slate-100" title="Activity" data-testid="header-activity-btn"><Bell className="h-5 w-5" /></Link>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-slate-900 font-display font-bold text-white">{user.name?.[0]?.toUpperCase()}</span>
            <p className="hidden max-w-[180px] truncate text-sm font-semibold text-slate-800 sm:block" data-testid="header-user-name">{user.name}</p>
            <button onClick={logout} className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-600" data-testid="logout-btn" title="Sign out"><LogOut className="h-4 w-4" /></button>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-7">{children}</main>
      </div>
    </div>
  );
}

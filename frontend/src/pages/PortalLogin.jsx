import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, Landmark, Info, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { GoogleButton, DemoButton } from "@/components/AuthButtons";
import { useAuth } from "@/context/AuthContext";

const CONF = {
  business: { icon: Building2, home: "/nexus", label: "Business · TrustID Nexus", title: "Business sign in", text: "Create verification QR codes and review consented results for your organisation.", demo: "Demo business admin", tone: "bg-blue-50 text-blue-600",
    points: ["Request only policy-approved claims", "Expiring, single-use QR links", "Private remarks & follow-up tasks"] },
  government: { icon: Landmark, home: "/sentinel", label: "Government · TrustID Sentinel", title: "Government sign in", text: "Review assigned cases. Every case opening requires a declared purpose and is audited.", demo: "Demo gov reviewer", tone: "bg-violet-50 text-violet-600",
    points: ["Case-based least-privilege access", "Suspicious activity alerts", "Complete access & audit log"] },
};

export default function PortalLogin({ role }) {
  const c = CONF[role];
  const Icon = c.icon;
  const { user, loading, signIn } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const from = location.state?.from || c.home;
  if (!loading && user) return <Navigate to={user.roles.includes(role) ? from : "/unauthorized"} replace state={{ role }} />;
  const done = (data) => {
    signIn(data);
    toast.success(`Welcome, ${data.user.name}`);
    navigate(data.user.roles.includes(role) ? from : "/unauthorized", { replace: true, state: { role } });
  };
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-8"><Logo /><Link to="/" className="tid-btn-ghost" data-testid="back-home-btn"><ArrowLeft className="h-4 w-4" />Portals</Link></header>
      <main className="mx-auto grid max-w-5xl gap-8 px-4 pb-16 sm:px-8 md:grid-cols-2">
        <div className="rise">
          <span className={`grid h-14 w-14 place-items-center rounded-2xl ${c.tone}`}><Icon className="h-6 w-6" /></span>
          <p className="tid-label mt-6">{c.label}</p>
          <h1 className="mt-1 font-display text-4xl font-bold tracking-tight" data-testid="page-title">{c.title}</h1>
          <p className="mt-3 text-sm text-slate-500">{c.text}</p>
          <ul className="mt-6 space-y-3">{c.points.map((p) => <li key={p} className="flex items-center gap-2 text-sm text-slate-700"><ShieldCheck className="h-4 w-4 text-emerald-600" />{p}</li>)}</ul>
        </div>
        <div className="tid-card space-y-5 p-6 rise rise-1">
          {location.state?.msg && <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800" data-testid="login-notice"><Info className="h-4 w-4" />{location.state.msg}</p>}
          <div><p className="tid-label mb-2">Sign in</p><GoogleButton returnTo={from} /></div>
          <p className="text-xs text-slate-500">Access is granted only to accounts an administrator has assigned the {role} role. Signing in does not grant it automatically.</p>
          <DemoButton role={role} label={c.demo} onDone={done} />
        </div>
      </main>
    </div>
  );
}

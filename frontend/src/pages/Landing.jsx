import { Link, Navigate } from "react-router-dom";
import { ScanFace, ShieldCheck, QrCode, Landmark, ArrowRight, Lock, EyeOff, ScrollText } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth, homeFor } from "@/context/AuthContext";

const PORTALS = [
  [ShieldCheck, "TrustID Vault", "Citizens", "Hold your identity profile, enrol FaceGate, approve or revoke every share.", "bg-emerald-50 text-emerald-700"],
  [QrCode, "TrustID Nexus", "Businesses", "Create expiring verification QR codes that request only policy-approved claims.", "bg-blue-50 text-blue-700"],
  [Landmark, "TrustID Sentinel", "Government", "Case-based review with declared purpose, remarks and a complete audit trail.", "bg-violet-50 text-violet-700"],
];

const PRINCIPLES = [
  [EyeOff, "No photos stored", "Faces are converted to an encrypted numeric template in your browser session."],
  [Lock, "Trust Firewall", "Every release is checked for role, purpose, consent, expiry and usage."],
  [ScrollText, "Every access logged", "Logins, consents, QR redemptions and case views are auditable."],
];

function Hero() {
  return (
    <section className="relative overflow-hidden rounded-[28px] bg-slate-950 text-white">
      <img src="/hero-face.jpg" alt="Face scan" className="absolute inset-y-0 right-0 h-full w-full object-cover object-[center_38%] opacity-90 md:w-1/2" />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-slate-950/10" />
      <div className="absolute inset-0 reticle-grid opacity-40" />
      <div className="relative max-w-2xl px-6 py-16 sm:px-12 sm:py-24">
        <p className="tid-label text-emerald-300 rise">Privacy-first digital identity</p>
        <h1 className="mt-4 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl rise rise-1">Prove who you are.<br /><span className="text-emerald-400">Share nothing more.</span></h1>
        <p className="mt-6 max-w-lg text-base text-slate-300 rise rise-2">TrustID connects citizens, businesses and government reviewers through consented, claim-level verification — with FaceGate face login at the front door.</p>
        <div className="mt-8 flex flex-wrap gap-3 rise rise-3">
          <Link to="/register" className="tid-btn bg-emerald-500 text-slate-950 hover:bg-emerald-400" data-testid="hero-register-btn"><ScanFace className="h-4 w-4" />Register with FaceGate</Link>
          <Link to="/login" className="tid-btn border border-white/20 bg-white/10 text-white backdrop-blur hover:bg-white/20" data-testid="hero-login-btn">Log in <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to={homeFor(user)} replace />;
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-8">
        <Logo />
        <div className="flex gap-2">
          <Link to="/login" className="tid-btn-ghost" data-testid="nav-login-btn">Log in</Link>
          <Link to="/register" className="tid-btn-dark" data-testid="nav-register-btn">Get started</Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 pb-20 sm:px-8">
        <Hero />
        <section className="mt-16 grid gap-5 md:grid-cols-3">
          {PORTALS.map(([Icon, t, who, d, tone], i) => (
            <div key={t} className={`tid-card p-7 rise rise-${i + 1}`} data-testid={`portal-card-${i}`}>
              <span className={`grid h-12 w-12 place-items-center rounded-2xl ${tone}`}><Icon className="h-5 w-5" /></span>
              <p className="tid-label mt-6">{who}</p>
              <h3 className="mt-1 font-display text-xl font-bold">{t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{d}</p>
            </div>
          ))}
        </section>
        <section className="mt-16 grid gap-10 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="tid-label text-emerald-700">Built honestly</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight">Security you can explain.</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">FaceGate matches faces — it does not detect liveness, so a photo could fool it. TrustID uses synthetic demo credentials and never claims to query real government registries.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {PRINCIPLES.map(([Icon, t, d]) => (
              <div key={t} className="rounded-2xl border border-slate-200 bg-white p-5">
                <Icon className="h-5 w-5 text-emerald-600" />
                <p className="mt-4 font-display font-semibold">{t}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{d}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500">TrustID · Hackathon MVP · All identities and cases are synthetic demo data.</footer>
    </div>
  );
}

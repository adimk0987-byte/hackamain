import { Link } from "react-router-dom";
import { User, Building2, Landmark, ArrowRight, ScanFace, Fingerprint, FileLock2, BadgeCheck } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";

const OPTIONS = [
  { key: "citizen", to: "/individual", home: "/vault", icon: User, title: "Individual", sub: "TrustID Vault", text: "Face + fingerprint scan, a private document vault, and full control over who sees what.", tone: "from-emerald-500 to-teal-500" },
  { key: "business", to: "/business", home: "/nexus", icon: Building2, title: "Business", sub: "TrustID Nexus", text: "Verify customers by face or QR and receive signed, consented proof you can download and share.", tone: "from-blue-500 to-indigo-500" },
  { key: "government", to: "/government", home: "/sentinel", icon: Landmark, title: "Government", sub: "TrustID Sentinel", text: "Purpose-bound case review with suspicious-activity alerts and a tamper-evident audit trail.", tone: "from-violet-500 to-fuchsia-500" },
];
const FEATURES = [[ScanFace, "Face + liveness", "Front, left, right & blink"], [Fingerprint, "Device fingerprint", "WebAuthn passkeys"], [FileLock2, "Encrypted vault", "AES-encrypted documents"], [BadgeCheck, "Signed proofs", "HMAC-SHA256 certificates"]];

export default function Landing() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-[#F6F8FA]">
      <section className="relative overflow-hidden bg-[#0B1626] pb-40 text-white">
        <img src="/hero-face.jpg" alt="" className="absolute inset-y-0 right-0 h-full w-full object-cover object-right opacity-90 lg:w-[62%]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0B1626] via-[#0B1626]/90 to-[#0B1626]/20" />
        <div className="absolute inset-0 reticle-grid opacity-30" />
        <header className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-6 sm:px-8"><Logo dark /><span className="hidden rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs text-slate-300 backdrop-blur sm:block">Privacy-first identity infrastructure</span></header>
        <div className="relative mx-auto max-w-6xl px-4 pt-10 sm:px-8 lg:pt-16">
          <p className="tid-label text-emerald-300 rise">Your Identity. Your Control.</p>
          <h1 className="mt-4 max-w-2xl font-display text-4xl font-bold leading-[1.04] tracking-tight sm:text-5xl lg:text-6xl rise rise-1">Prove who you are.<br /><span className="bg-gradient-to-r from-emerald-300 to-teal-200 bg-clip-text text-transparent">Share nothing more.</span></h1>
          <p className="mt-5 max-w-lg text-base text-slate-300 rise rise-2">One biometric identity for people, businesses and government — every claim consented, every access signed and audited.</p>
          <div className="mt-10 grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-4 rise rise-3">
            {FEATURES.map(([I, t, s]) => <div key={t}><I className="h-5 w-5 text-emerald-300" /><p className="mt-2 text-sm font-semibold">{t}</p><p className="text-[11px] text-slate-400">{s}</p></div>)}
          </div>
        </div>
      </section>
      <main className="relative mx-auto -mt-28 max-w-6xl px-4 pb-16 sm:px-8">
        <p className="mb-4 text-sm font-semibold text-white">Choose your portal</p>
        <div className="grid gap-5 md:grid-cols-3">
          {OPTIONS.map((o, i) => {
            const Icon = o.icon;
            return (
              <Link key={o.key} to={user?.roles?.includes(o.key) ? o.home : o.to} data-testid={`choose-${o.key}`} className={`group relative flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white p-7 shadow-[0_20px_50px_-20px_rgba(11,22,38,.25)] transition-[transform,box-shadow] hover:-translate-y-1 hover:shadow-[0_30px_60px_-20px_rgba(11,22,38,.35)] rise rise-${i + 1}`}>
                <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${o.tone}`} />
                <span className={`grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br ${o.tone} text-white shadow-lg`}><Icon className="h-6 w-6" /></span>
                <p className="tid-label mt-7">{o.sub}</p>
                <h2 className="mt-1 font-display text-2xl font-bold text-slate-900">{o.title}</h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-500">{o.text}</p>
                <span className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-slate-900">Enter portal <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
              </Link>
            );
          })}
        </div>
        <p className="mt-10 text-center text-xs text-slate-400">Webcam liveness is head-turn + blink; retina scanning requires dedicated IR hardware. TrustID stores your documents securely but does not query government registries.</p>
      </main>
    </div>
  );
}

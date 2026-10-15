import { Link } from "react-router-dom";
import { User, Building2, Landmark, ArrowRight, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";

const OPTIONS = [
  { key: "citizen", to: "/individual", home: "/vault", icon: User, title: "Individual", sub: "TrustID Vault", text: "Scan your face, open your personal document vault, and approve every share yourself.", tone: "bg-emerald-50 text-emerald-600", ring: "hover:border-emerald-300" },
  { key: "business", to: "/business", home: "/nexus", icon: Building2, title: "Business", sub: "TrustID Nexus", text: "Create verification QR codes, collect consented claims and keep private remarks.", tone: "bg-blue-50 text-blue-600", ring: "hover:border-blue-300" },
  { key: "government", to: "/government", home: "/sentinel", icon: Landmark, title: "Government", sub: "TrustID Sentinel", text: "Review assigned cases with a declared purpose and a complete audit trail.", tone: "bg-violet-50 text-violet-600", ring: "hover:border-violet-300" },
];

export default function Landing() {
  const { user } = useAuth();
  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC]">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-6 sm:px-8"><Logo /><span className="hidden items-center gap-2 text-xs text-slate-500 sm:flex"><ShieldCheck className="h-4 w-4 text-emerald-600" />Premium Identity Verification</span></header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 pb-16 sm:px-8">
        <p className="tid-label text-emerald-700 rise">Welcome to TrustID</p>
        <h1 className="mt-3 max-w-2xl font-display text-4xl font-bold leading-[1.05] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl rise rise-1">Who are you verifying as today?</h1>
        <p className="mt-4 max-w-xl text-base text-slate-500 rise rise-2">Choose your portal. Each one is separate, with its own sign-in and its own permissions.</p>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {OPTIONS.map((o, i) => {
            const Icon = o.icon;
            const target = user?.roles?.includes(o.key) ? o.home : o.to;
            return (
              <Link key={o.key} to={target} data-testid={`choose-${o.key}`} className={`group tid-card flex flex-col p-7 transition-[transform,box-shadow,border-color] hover:-translate-y-1 hover:shadow-lg rise rise-${i + 1} ${o.ring}`}>
                <span className={`grid h-14 w-14 place-items-center rounded-2xl ${o.tone}`}><Icon className="h-6 w-6" /></span>
                <p className="tid-label mt-8">{o.sub}</p>
                <h2 className="mt-1 font-display text-2xl font-bold text-slate-900">{o.title}</h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-500">{o.text}</p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-900">Continue <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
              </Link>
            );
          })}
        </div>
      </main>
      <footer className="border-t border-slate-200 py-5 text-center text-xs text-slate-500">TrustID · Your Identity. Your Control. · Face matching is not liveness detection.</footer>
    </div>
  );
}

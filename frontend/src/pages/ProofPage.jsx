import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ShieldCheck, ShieldX, ShieldAlert } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Loader } from "@/components/Shared";
import { api, errMsg, fmt } from "@/lib/api";

const LOOK = {
  valid: [ShieldCheck, "Authentic & valid", "bg-emerald-50 text-emerald-700", "text-emerald-600"],
  revoked: [ShieldAlert, "Consent withdrawn", "bg-amber-50 text-amber-800", "text-amber-600"],
  tampered: [ShieldX, "Signature invalid", "bg-rose-50 text-rose-700", "text-rose-600"],
};

export default function ProofPage() {
  const { pid } = useParams();
  const [p, setP] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    api.get(`/proofs/${pid}`).then((r) => setP(r.data)).catch((e) => setError(errMsg(e)));
  }, [pid]);
  const [Icon, label, tone, ic] = p ? LOOK[p.status] : LOOK.valid;
  return (
    <div className="min-h-screen bg-[#F6F8FA]">
      <header className="mx-auto max-w-2xl px-4 py-5"><Logo /></header>
      <main className="mx-auto max-w-2xl px-4 pb-16">
        <div className="tid-card overflow-hidden rise" data-testid="proof-card">
          {!p && !error && <Loader />}
          {error && <div className="p-10 text-center"><ShieldX className="mx-auto h-12 w-12 text-rose-500" /><p className="mt-3 font-display text-xl font-bold" data-testid="proof-error">Proof not found</p><p className="text-sm text-slate-500">{error}</p></div>}
          {p && (
            <>
              <div className={`flex items-center gap-4 px-6 py-6 ${tone}`}><Icon className={`h-10 w-10 ${ic}`} /><div><p className="tid-label">TrustID verification proof</p><p className="font-display text-2xl font-bold" data-testid="proof-status">{label}</p></div></div>
              <dl className="grid gap-5 p-6 sm:grid-cols-2">
                {[["Verified for", p.org_name], ["Purpose", p.purpose], ["Method", p.channel === "in_person" ? "In-person face scan" : "Consented QR request"], ["Issued", fmt(p.issued_at)], ["Subject", p.subject_ref], ["Issuer", p.issuer]].map(([k, v]) => <div key={k}><dt className="tid-label">{k}</dt><dd className="mt-1 text-sm font-semibold">{v}</dd></div>)}
              </dl>
              <div className="border-t border-slate-100 px-6 py-5"><p className="tid-label">Claims attested</p><ul className="mt-2 flex flex-wrap gap-2">{p.claims.map((c) => <li key={c} className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-medium">{c}</li>)}</ul><p className="mt-2 text-[11px] text-slate-400">Values are visible only to the verifying organisation.</p></div>
              <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 font-mono text-[10px] text-slate-500 break-all">{p.alg} · signature {p.signature_valid ? "verified" : "FAILED"} · digest {p.digest}</div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

import { useState } from "react";
import { Download, MessageCircle, Copy, Share2, Loader2, ShieldCheck, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg, fmt } from "@/lib/api";
import { StatusBadge } from "@/components/Shared";

const show = (v) => (v === true ? "Yes" : v === false ? "No" : String(v));

export function ProofResult({ vs, labels }) {
  const [busy, setBusy] = useState(false);
  const p = vs.proof;
  const url = p ? `${window.location.origin}/proof/${p.proof_id}` : null;
  const text = p ? `TrustID verification proof for "${vs.purpose}" by ${vs.org_name}. Check authenticity: ${url}` : "";
  const download = async () => {
    setBusy(true);
    try {
      const r = await api.get(`/nexus/verifications/${vs.id}/certificate`, { responseType: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(r.data);
      a.download = `trustid-proof-${p.proof_id}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      toast.error(e?.response?.status === 410 ? "The person withdrew consent — certificate unavailable." : errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  const copy = () => navigator.clipboard.writeText(url).then(() => toast.success("Proof link copied")).catch(() => toast.error("Copy failed"));
  const native = () => navigator.share({ title: "TrustID proof", text, url }).catch(() => {});
  const live = vs.status === "active" && vs.proof_status !== "revoked";
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white" data-testid="proof-result">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0B1626] px-6 py-5 text-white">
        <div className="flex items-center gap-3"><ShieldCheck className="h-8 w-8 text-emerald-400" /><div><p className="text-[11px] uppercase tracking-wider text-slate-400">Verified identity</p><p className="font-display text-xl font-bold" data-testid="proof-subject">{vs.citizen_label || "Deleted user"}</p></div></div>
        <div className="flex gap-2"><StatusBadge value={vs.decision} /><StatusBadge value={vs.proof_status || vs.status} /></div>
      </div>
      <div className="grid gap-0 sm:grid-cols-2">
        {Object.entries(vs.released_claims).map(([k, v]) => <div key={k} className="border-b border-r border-slate-100 px-6 py-4"><p className="text-[11px] text-slate-500">{labels[k] || k}</p><p className="font-display text-lg font-semibold" data-testid={`claim-value-${k}`}>{show(v)}</p></div>)}
        {!Object.keys(vs.released_claims).length && <p className="px-6 py-5 text-sm text-slate-500">No claims available — consent was declined or withdrawn.</p>}
      </div>
      {p && (
        <div className="space-y-4 px-6 py-5">
          <p className="font-mono text-[10px] text-slate-500 break-all">Proof {p.proof_id} · {fmt(p.issued_at)} · {p.alg} · {p.digest.slice(0, 32)}…</p>
          <div className="flex flex-wrap gap-2">
            <button className="tid-btn-dark" onClick={download} disabled={busy || !live} data-testid="proof-download-btn">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}PDF certificate</button>
            <button className="tid-btn bg-[#25D366] text-white hover:bg-[#1ebe5b]" disabled={!live} onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener")} data-testid="proof-whatsapp-btn"><MessageCircle className="h-4 w-4" />WhatsApp</button>
            <button className="tid-btn-ghost" onClick={copy} data-testid="proof-copy-btn"><Copy className="h-4 w-4" />Copy link</button>
            {typeof navigator.share === "function" && <button className="tid-btn-ghost" onClick={native} data-testid="proof-share-btn"><Share2 className="h-4 w-4" />Share</button>}
            <a href={url} target="_blank" rel="noreferrer" className="tid-btn-ghost" data-testid="proof-open-btn"><ExternalLink className="h-4 w-4" />Public check</a>
          </div>
          <p className="text-[11px] text-slate-400">Shared links show only proof validity and claim names — never the values above.</p>
        </div>
      )}
    </div>
  );
}

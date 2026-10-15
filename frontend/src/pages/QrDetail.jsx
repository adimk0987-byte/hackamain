import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import { Download, Copy, Share2, Ban, ArrowLeft, MessageCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { api, errMsg, fmt, verifyUrl } from "@/lib/api";
import { Loader, StatusBadge, EmptyState, ActivityList } from "@/components/Shared";
import { RemarksWorkspace } from "@/components/RemarksWorkspace";

function SharePanel({ qr, onRevoke }) {
  const url = verifyUrl(qr.token);
  const message = `${qr.org_name} is requesting a TrustID verification for "${qr.purpose}". Open this secure link to review exactly what is requested before you consent: ${url} (expires ${fmt(qr.expires_at)})`;
  const log = (channel) => api.post(`/nexus/qrs/${qr.id}/share-event`, { channel }).catch(() => {});
  const download = () => {
    const c = document.getElementById("qr-canvas");
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = `trustid-${qr.name.replace(/\W+/g, "-").toLowerCase()}.png`;
    a.click();
    log("download");
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Secure link copied");
      log("copy");
    } catch {
      toast.error("Copy failed — select the link below and copy it manually.");
    }
  };
  const whatsapp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener");
    log("whatsapp");
  };
  const native = async () => {
    try {
      await navigator.share({ title: "TrustID verification", text: message, url });
      log("native");
    } catch (e) {
      if (e?.name !== "AbortError") toast.error("Sharing failed — copy the link instead.");
    }
  };
  const live = qr.status === "active";
  return (
    <div className="tid-card p-6" data-testid="qr-share-panel">
      <div className="mx-auto w-fit rounded-2xl border border-slate-200 bg-white p-4"><QRCodeCanvas id="qr-canvas" value={url} size={220} level="M" marginSize={2} data-testid="qr-canvas" /></div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button className="tid-btn-dark" onClick={download} data-testid="qr-download-btn"><Download className="h-4 w-4" />PNG</button>
        <button className="tid-btn-ghost" onClick={copy} data-testid="qr-copy-btn"><Copy className="h-4 w-4" />Copy link</button>
        <button className="tid-btn bg-[#25D366] text-white hover:bg-[#1ebe5b]" disabled={!live} onClick={whatsapp} data-testid="qr-whatsapp-btn"><MessageCircle className="h-4 w-4" />WhatsApp</button>
        {typeof navigator.share === "function" ? <button className="tid-btn-ghost" disabled={!live} onClick={native} data-testid="qr-native-share-btn"><Share2 className="h-4 w-4" />Share</button> : <span className="tid-btn-ghost cursor-not-allowed opacity-50" title="Not supported in this browser" data-testid="qr-native-share-unavailable"><Share2 className="h-4 w-4" />Share n/a</span>}
      </div>
      <p className="tid-label mt-5">Message preview</p>
      <p className="mt-2 break-all rounded-xl bg-slate-50 p-3 text-xs text-slate-600" data-testid="qr-message-preview">{message}</p>
      <p className="mt-2 text-[11px] text-slate-400">WhatsApp opens with this text prefilled — you choose the recipient and send it yourself.</p>
      {qr.status !== "revoked" && <button className="tid-btn-ghost mt-4 w-full text-rose-600" onClick={onRevoke} data-testid="qr-revoke-btn"><Ban className="h-4 w-4" />Revoke QR</button>}
    </div>
  );
}

function Outcomes({ sessions }) {
  if (!sessions.length) return <EmptyState title="No responses yet" text="Recipient decisions will appear here." testId="outcomes-empty" />;
  return (
    <ul className="space-y-3" data-testid="outcomes-list">
      {sessions.map((s) => (
        <li key={s.id} className="rounded-2xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{s.citizen_label || "Deleted user"}</p><div className="flex gap-2"><StatusBadge value={s.decision} /><StatusBadge value={s.status} /></div></div>
          <p className="text-xs text-slate-500">{fmt(s.created_at)}</p>
          <div className="mt-2 flex flex-wrap gap-2">{Object.entries(s.released_claims).map(([k, v]) => <span key={k} className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800">{k.replace(/_/g, " ")}: <b>{String(v)}</b></span>)}{s.status === "revoked" && <span className="text-xs text-rose-600">Citizen revoked consent — claims hidden.</span>}</div>
        </li>
      ))}
    </ul>
  );
}

export default function QrDetail() {
  const { id } = useParams();
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("outcomes");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api.get(`/nexus/qrs/${id}`).then((r) => setD(r.data)).catch((e) => setError(errMsg(e))), [id]);
  useEffect(() => {
    load();
  }, [load]);
  const revoke = async () => {
    setBusy(true);
    try {
      await api.post(`/nexus/qrs/${id}/revoke`);
      toast.success("QR revoked — the link no longer works");
      setConfirm(false);
      load();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  if (error) return <EmptyState title="QR not available" text={error} testId="qr-error" />;
  if (!d) return <Loader />;
  const qr = d.qr;
  return (
    <div data-testid="qr-detail">
      <Link to="/nexus/qrs" className="mb-4 inline-flex min-h-[44px] items-center gap-2 text-sm text-slate-500 hover:text-slate-800" data-testid="qr-back-link"><ArrowLeft className="h-4 w-4" />All QR codes</Link>
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <SharePanel qr={qr} onRevoke={() => setConfirm(true)} />
        <div className="space-y-6">
          <div className="tid-card p-6">
            <div className="flex flex-wrap items-center gap-3"><h1 className="font-display text-2xl font-bold" data-testid="qr-detail-name">{qr.name}</h1><StatusBadge value={qr.status} testId="qr-detail-status" /></div>
            <p className="text-sm text-slate-500">{qr.purpose}</p>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-4">
              <div><dt className="tid-label">Uses</dt><dd className="font-semibold" data-testid="qr-uses">{qr.uses} / {qr.max_uses}</dd></div>
              <div><dt className="tid-label">Created</dt><dd>{fmt(qr.created_at)}</dd></div>
              <div><dt className="tid-label">Expires</dt><dd>{fmt(qr.expires_at)}</dd></div>
              <div><dt className="tid-label">Created by</dt><dd>{qr.created_by}</dd></div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">{qr.claims.map((c) => <span key={c} className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{c.replace(/_/g, " ")}</span>)}{qr.reduced_claims.map((c) => <span key={c} className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs text-amber-700 line-through" title="Removed by policy">{c.replace(/_/g, " ")}</span>)}</div>
          </div>
          <div className="tid-card p-6">
            <div className="mb-5 flex gap-1 overflow-x-auto border-b border-slate-100">
              {[["outcomes", "Outcomes"], ["remarks", "Private remarks & tasks"], ["history", "History"]].map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`min-h-[44px] whitespace-nowrap px-4 text-sm ${tab === k ? "border-b-2 border-emerald-500 font-semibold text-emerald-700" : "text-slate-500"}`} data-testid={`qr-tab-${k}`}>{l}</button>)}
            </div>
            {tab === "outcomes" && <Outcomes sessions={d.sessions} />}
            {tab === "remarks" && <RemarksWorkspace qid={qr.id} />}
            {tab === "history" && <ActivityList items={d.history} testId="qr-history" />}
          </div>
        </div>
      </div>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent className="bg-white" data-testid="qr-revoke-dialog">
          <AlertDialogHeader><AlertDialogTitle>Revoke this QR?</AlertDialogTitle><AlertDialogDescription>Anyone opening the link will see it as revoked. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel data-testid="qr-revoke-cancel">Cancel</AlertDialogCancel><AlertDialogAction onClick={(e) => { e.preventDefault(); revoke(); }} disabled={busy} className="bg-rose-600 hover:bg-rose-700" data-testid="qr-revoke-confirm">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Revoke</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

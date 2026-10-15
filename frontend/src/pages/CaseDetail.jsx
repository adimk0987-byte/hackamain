import { useCallback, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldOff, Loader2, FileLock2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { api, errMsg, errCode, fmt } from "@/lib/api";
import { StatusBadge, ActivityList, DemoTag, EmptyState } from "@/components/Shared";

function ReasonDialog({ open, onGranted }) {
  const { id } = useParams();
  const nav = useNavigate();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    if (reason.trim().length < 10) return toast.error("Describe the purpose in at least 10 characters.");
    setBusy(true);
    try {
      const { data } = await api.post(`/sentinel/cases/${id}/access`, { reason: reason.trim() });
      onGranted(data.grant_id);
    } catch (err) {
      if (errCode(err) === "NOT_ASSIGNED") setDenied(errMsg(err));
      else toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && nav("/sentinel")}>
      <DialogContent className="bg-white" data-testid="access-reason-dialog">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><FileLock2 className="h-5 w-5 text-violet-600" />Declare access purpose</DialogTitle><DialogDescription>Your reason, identity and time of access are permanently recorded in the case audit log. Access lasts 15 minutes.</DialogDescription></DialogHeader>
        {denied ? <p className="flex gap-2 rounded-xl bg-rose-50 p-4 text-sm text-rose-700" data-testid="case-not-assigned"><ShieldOff className="h-4 w-4 shrink-0" />{denied}</p> : (
          <form onSubmit={submit} className="space-y-3">
            <textarea className="tid-input h-24 py-2" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Reviewing duplicate enrolment flag raised on 12 Oct" data-testid="access-reason-input" />
            <button className="tid-btn w-full bg-violet-600 text-white hover:bg-violet-700" disabled={busy} data-testid="access-reason-submit">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Open case</button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatusForm({ c, grant, onDone }) {
  const [status, setStatus] = useState(c.status);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    if (reason.trim().length < 10) return toast.error("A justification of 10+ characters is required.");
    setBusy(true);
    try {
      await api.post(`/sentinel/cases/${c.id}/status`, { status, reason: reason.trim(), grant_id: grant });
      toast.success("Case status updated");
      setReason("");
      onDone();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={save} className="space-y-2">
      <select className="tid-input" value={status} onChange={(e) => setStatus(e.target.value)} data-testid="case-status-select">{["open", "under_review", "cleared", "escalated"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select>
      <input className="tid-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Justification (required, audited)" data-testid="case-status-reason" />
      <button className="tid-btn-dark w-full" disabled={busy} data-testid="case-status-save">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Update review status</button>
    </form>
  );
}

function Remarks({ cid, grant, remarks, onDone }) {
  const [body, setBody] = useState("");
  const add = async (e) => {
    e.preventDefault();
    if (body.trim().length < 2) return;
    try {
      await api.post(`/sentinel/cases/${cid}/remarks`, { body: body.trim(), grant_id: grant });
      setBody("");
      onDone();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };
  return (
    <div>
      <form onSubmit={add} className="flex gap-2"><input className="tid-input" value={body} maxLength={2000} onChange={(e) => setBody(e.target.value)} placeholder="Add a case remark (reviewers only)" data-testid="case-remark-input" /><button className="tid-btn-dark shrink-0" data-testid="case-remark-add">Add</button></form>
      <ul className="mt-3 space-y-2" data-testid="case-remarks">{remarks.map((r) => <li key={r.id} className="rounded-xl bg-slate-50 p-3 text-sm"><p>{r.body}</p><p className="mt-1 text-xs text-slate-500">{r.author} · {fmt(r.created_at)}</p></li>)}</ul>
    </div>
  );
}

function Detail({ d, reload }) {
  const c = d.case;
  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-6">
        <div className="tid-card p-6">
          <div className="flex flex-wrap items-center gap-3"><span className="font-mono text-sm font-bold text-violet-700">{c.ref}</span><StatusBadge value={c.status} testId="case-status" /><StatusBadge value={c.priority} /><DemoTag /></div>
          <h1 className="mt-2 font-display text-2xl font-bold" data-testid="case-title">{c.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{c.summary}</p>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3"><div><dt className="tid-label">Subject</dt><dd className="font-semibold">{c.subject.label}</dd></div><div><dt className="tid-label">TrustID</dt><dd className="font-mono">{c.subject.trust_id}</dd></div><div><dt className="tid-label">City</dt><dd>{c.subject.city}</dd></div></dl>
        </div>
        <div className="tid-card p-6"><h3 className="font-display font-bold">Claim verification results</h3><ul className="mt-3 space-y-2" data-testid="case-claims">{c.claims.map((x) => <li key={x.claim} className="flex justify-between text-sm"><span>{x.claim}</span><StatusBadge value={x.result} /></li>)}</ul></div>
        <div className="tid-card p-6"><h3 className="font-display font-bold">Credentials & issuer status</h3><ul className="mt-3 space-y-2">{c.credentials.map((x) => <li key={x.type} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 text-sm"><div><p className="font-semibold">{x.type}</p><p className="text-xs text-slate-500">{x.issuer}</p></div><div className="flex gap-2"><StatusBadge value={x.issuer_status} /><StatusBadge value={x.status} /></div></li>)}</ul><p className="mt-2 text-[11px] text-slate-400">Issuer data is synthetic. No official registry is queried.</p></div>
        <div className="tid-card p-6"><h3 className="mb-3 font-display font-bold">Case remarks</h3><Remarks cid={c.id} grant={d.grant.id} remarks={d.remarks} onDone={reload} /></div>
      </div>
      <div className="space-y-6">
        <div className="tid-card p-6"><h3 className="mb-3 font-display font-bold">Review status</h3><StatusForm c={c} grant={d.grant.id} onDone={reload} /><p className="mt-3 text-xs text-slate-500">Your access expires {fmt(d.grant.expires_at)}.</p></div>
        <div className="tid-card p-6"><h3 className="font-display font-bold">Access log</h3><ul className="mt-3 space-y-2" data-testid="case-access-log">{d.access_log.map((a) => <li key={a.id} className="text-xs"><b>{a.user_name}</b> · {fmt(a.created_at)}<p className="text-slate-500">“{a.reason}”</p></li>)}</ul></div>
        <div className="tid-card p-6"><h3 className="font-display font-bold">Audit history</h3><ActivityList items={d.history} testId="case-history" /></div>
      </div>
    </div>
  );
}

export default function CaseDetail() {
  const { id } = useParams();
  const [grant, setGrant] = useState(null);
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(async (g) => {
    try {
      const { data } = await api.get(`/sentinel/cases/${id}`, { params: { grant_id: g } });
      setD(data);
    } catch (e) {
      if (errCode(e) === "ACCESS_REASON_REQUIRED") {
        setGrant(null);
        setD(null);
        toast.error(errMsg(e));
      } else setError(errMsg(e));
    }
  }, [id]);
  const onGranted = (g) => {
    setGrant(g);
    load(g);
  };
  return (
    <div data-testid="case-detail">
      <Link to="/sentinel" className="mb-4 inline-flex min-h-[44px] items-center gap-2 text-sm text-slate-500 hover:text-slate-800" data-testid="case-back-link"><ArrowLeft className="h-4 w-4" />All cases</Link>
      {error && <EmptyState title="Case unavailable" text={error} testId="case-error" />}
      {d && <Detail d={d} reload={() => load(grant)} />}
      <ReasonDialog open={!grant && !error} onGranted={onGranted} />
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BadgeCheck, Clock, ShieldCheck, XCircle, CheckCircle2, Loader2, Lock } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Loader, StatusBadge } from "@/components/Shared";
import { api, errMsg, fmt } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

function Result({ r }) {
  const ok = r.decision === "ALLOWED";
  return (
    <div className="text-center" data-testid="verify-result">
      {ok ? <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" /> : <XCircle className="mx-auto h-14 w-14 text-rose-500" />}
      <div className="mt-3"><StatusBadge value={r.decision} testId="verify-decision" /></div>
      <p className="mt-3 text-sm text-slate-600">{r.message}</p>
      {ok && (
        <ul className="mt-5 space-y-2 text-left" data-testid="released-claims">
          {Object.entries(r.released_claims).map(([k, v]) => (
            <li key={k} className="flex justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm"><span className="text-slate-500">{r.claim_labels[k]}</span><span className="font-semibold">{String(v)}</span></li>
          ))}
        </ul>
      )}
      <Link to="/vault/consents" className="tid-btn-ghost mt-6" data-testid="verify-view-consents-btn">View my consents</Link>
    </div>
  );
}

function ConsentForm({ token, info, onResult }) {
  const { user } = useAuth();
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const respond = async (decision) => {
    setBusy(decision);
    setError(null);
    try {
      const { data } = await api.post(`/verify/${token}/respond`, { decision });
      onResult(data);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  };
  if (!user) {
    return (
      <div className="rounded-2xl bg-slate-50 p-5 text-center" data-testid="verify-signin-required">
        <Lock className="mx-auto h-6 w-6 text-slate-500" />
        <p className="mt-2 text-sm text-slate-600">Sign in to your TrustID to review and respond. Nothing is shared until you consent.</p>
        <Link to="/login" state={{ from: `/v/${token}` }} className="tid-btn-primary mt-4" data-testid="verify-signin-btn">Sign in to respond</Link>
      </div>
    );
  }
  return (
    <div>
      <p className="text-sm text-slate-600">Signed in as <b>{user.name}</b></p>
      <label className="mt-3 flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm">
        <input type="checkbox" className="mt-0.5 h-5 w-5 accent-emerald-600" checked={agree} onChange={(e) => setAgree(e.target.checked)} data-testid="verify-consent-checkbox" />
        I consent to share exactly the {info.claims.length} claim(s) listed above with {info.org_name} for “{info.purpose}”.
      </label>
      {error && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700" data-testid="verify-error">{error}</p>}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button className="tid-btn-ghost" disabled={!!busy} onClick={() => respond("deny")} data-testid="verify-deny-btn">{busy === "deny" && <Loader2 className="h-4 w-4 animate-spin" />}Decline</button>
        <button className="tid-btn-primary" disabled={!agree || !!busy} onClick={() => respond("approve")} data-testid="verify-approve-btn">{busy === "approve" && <Loader2 className="h-4 w-4 animate-spin" />}Approve & share</button>
      </div>
    </div>
  );
}

export default function Verify() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api.get(`/verify/${token}`).then((r) => setInfo(r.data)).catch((e) => setError(errMsg(e)));
  }, [token]);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="mx-auto max-w-xl px-4 py-5"><Logo /></header>
      <main className="mx-auto max-w-xl px-4 pb-16">
        <div className="tid-card p-6 sm:p-8 rise" data-testid="verify-card">
          {!info && !error && <Loader />}
          {error && <div className="py-10 text-center" data-testid="verify-invalid"><XCircle className="mx-auto h-12 w-12 text-rose-500" /><p className="mt-3 font-display text-xl font-bold">Link not valid</p><p className="mt-1 text-sm text-slate-500">{error}</p></div>}
          {info && result && <Result r={result} />}
          {info && !result && (
            <>
              <p className="tid-label">Verification request</p>
              <div className="mt-2 flex items-center gap-2">
                <h1 className="font-display text-2xl font-bold" data-testid="verify-org-name">{info.org_name}</h1>
                {info.org_verified && <BadgeCheck className="h-5 w-5 text-emerald-600" />}
              </div>
              <p className="text-sm text-slate-500">{info.org_type}</p>
              <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Purpose</p>
                <p className="font-semibold" data-testid="verify-purpose">{info.purpose}</p>
                {info.description && <p className="mt-2 text-sm text-slate-600">{info.description}</p>}
              </div>
              <p className="tid-label mt-6">They are requesting only</p>
              <ul className="mt-2 space-y-2" data-testid="verify-claims">
                {info.claims.map((c) => <li key={c.key} className="flex items-center gap-2 text-sm"><ShieldCheck className="h-4 w-4 text-emerald-600" />{c.label}</li>)}
              </ul>
              <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />Expires {fmt(info.expires_at)}</span>
                <StatusBadge value={info.status} testId="verify-status" />
                {info.single_use && <span>Single-use</span>}
              </div>
              <div className="mt-6 border-t border-slate-100 pt-6">
                {info.status === "active" ? <ConsentForm token={token} info={info} onResult={setResult} /> : (
                  <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700" data-testid="verify-unavailable">This request is {info.status} and can no longer be answered.</p>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

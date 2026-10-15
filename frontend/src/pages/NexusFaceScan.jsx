import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ScanFace } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { PageHeader } from "@/components/Shared";
import { BiometricScanner } from "@/components/BiometricScanner";
import { ProofResult } from "@/components/ProofResult";

export default function NexusFaceScan() {
  const [meta, setMeta] = useState(null);
  const [purpose, setPurpose] = useState("In-branch KYC");
  const [claims, setClaims] = useState(["full_name", "age_over_18", "identity_verified"]);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(0);
  useEffect(() => {
    api.get("/nexus/meta").then((r) => setMeta(r.data)).catch((e) => toast.error(errMsg(e)));
  }, []);
  const toggle = (k) => setClaims(claims.includes(k) ? claims.filter((c) => c !== k) : [...claims, k]);
  const run = async (scan) => {
    if (purpose.trim().length < 3) return "Enter the purpose of verification first.";
    if (!claims.length) return "Select at least one claim.";
    setBusy(true);
    try {
      const { data } = await api.post("/nexus/face-verify", { ...scan, purpose: purpose.trim(), claims });
      setResult(data);
      return null;
    } catch (e) {
      return errMsg(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div data-testid="nexus-face-scan">
      <PageHeader eyebrow="TrustID Nexus" title="Scan Customer Face" subtitle="Verify a person at your counter. Claims are released only if they've allowed in-person sharing." />
      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <div className="tid-card space-y-5 p-6">
          <div><label className="tid-label">Purpose</label><input className="tid-input mt-2" maxLength={120} value={purpose} onChange={(e) => setPurpose(e.target.value)} data-testid="fv-purpose-input" /></div>
          <div>
            <label className="tid-label">Claims to request</label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {meta && Object.entries(meta.claims).filter(([k]) => meta.org.allowed_claims.includes(k)).map(([k, l]) => (
                <label key={k} className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border px-3 text-sm ${claims.includes(k) ? "border-blue-300 bg-blue-50" : "border-slate-200"}`}><input type="checkbox" className="h-4 w-4 accent-blue-600" checked={claims.includes(k)} onChange={() => toggle(k)} data-testid={`fv-claim-${k}`} />{l}</label>
              ))}
            </div>
          </div>
          {result && <button className="tid-btn-ghost" onClick={() => { setResult(null); setKey(key + 1); }} data-testid="fv-new-scan-btn"><ScanFace className="h-4 w-4" />Scan another person</button>}
        </div>
        <div className="space-y-5">
          {!result && <div className="tid-card p-6"><BiometricScanner key={key} onComplete={run} busy={busy} title="Customer face & liveness" /></div>}
          {result && result.decision === "ALLOWED" && <ProofResult vs={{ ...result.session, proof_status: "valid" }} labels={result.claim_labels} />}
          {result && result.decision !== "ALLOWED" && <div className="tid-card p-6" data-testid="fv-blocked"><p className="font-display text-lg font-bold">{result.decision === "CONSENT_REQUIRED" ? "Consent required" : "Not permitted"}</p><p className="mt-1 text-sm text-slate-600">{result.message}</p></div>}
          {result?.withheld?.length > 0 && <p className="text-xs text-amber-700" data-testid="fv-withheld">Withheld by the person's permissions or your policy: {result.withheld.join(", ")}</p>}
        </div>
      </div>
    </div>
  );
}

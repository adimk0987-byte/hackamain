import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ScanFace, QrCode } from "lucide-react";
import { api, errMsg, fmt } from "@/lib/api";
import { Loader, PageHeader, StatusBadge, EmptyState } from "@/components/Shared";
import { ProofResult } from "@/components/ProofResult";

export default function NexusVerifications() {
  const [data, setData] = useState(null);
  const [sel, setSel] = useState(null);
  useEffect(() => {
    api.get("/nexus/verifications").then((r) => { setData(r.data); setSel(r.data.items[0] || null); }).catch((e) => toast.error(errMsg(e)));
  }, []);
  if (!data) return <Loader />;
  return (
    <div data-testid="nexus-verifications">
      <PageHeader eyebrow="TrustID Nexus" title="Verified People" subtitle="Every person verified by QR or face scan, with signed proof you can download and share." />
      {data.items.length === 0 ? <EmptyState title="No verifications yet" text="Share a QR or scan a customer's face to get started." /> : (
        <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
          <ul className="tid-card max-h-[70vh] divide-y divide-slate-100 overflow-y-auto" data-testid="verification-list">
            {data.items.map((v) => (
              <li key={v.id}>
                <button onClick={() => setSel(v)} className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${sel?.id === v.id ? "bg-blue-50" : "hover:bg-slate-50"}`} data-testid={`verification-row-${v.id}`}>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600">{v.channel === "in_person" ? <ScanFace className="h-4 w-4" /> : <QrCode className="h-4 w-4" />}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{v.citizen_label || "Deleted user"}</span><span className="block truncate text-xs text-slate-500">{v.purpose} · {fmt(v.created_at)}</span></span>
                  <StatusBadge value={v.proof_status || v.decision} />
                </button>
              </li>
            ))}
          </ul>
          {sel && <ProofResult vs={sel} labels={data.claim_labels} />}
        </div>
      )}
    </div>
  );
}

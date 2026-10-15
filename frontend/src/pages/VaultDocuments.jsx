import { useCallback, useEffect, useState } from "react";
import { Upload, Search } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { Loader, PageHeader, EmptyState } from "@/components/Shared";
import { DocCard, DocViewer, UploadDocDialog, DOC_TABS } from "@/components/Documents";

export default function VaultDocuments() {
  const [docs, setDocs] = useState(null);
  const [enrolled, setEnrolled] = useState(false);
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [viewing, setViewing] = useState(null);
  const [upload, setUpload] = useState(false);
  const load = useCallback(() => api.get("/vault/overview").then((r) => { setDocs(r.data.documents); setEnrolled(r.data.face_enrolled); }).catch((e) => toast.error(errMsg(e))), []);
  useEffect(() => {
    load();
  }, [load]);
  if (!docs) return <Loader />;
  const rows = docs.filter((d) => (tab === "all" || d.doc_type === tab) && (!q || `${d.title} ${d.original_filename}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <div data-testid="vault-documents">
      <PageHeader eyebrow="My Vault" title="Document Vault" subtitle="Your real documents, encrypted and unlocked only by your face login."
        action={<button className="tid-btn bg-[#0F3D2E] text-white hover:bg-[#0B2F23]" disabled={!enrolled} onClick={() => setUpload(true)} data-testid="upload-document-btn"><Upload className="h-4 w-4" />Upload Document</button>} />
      <div className="tid-card p-5 sm:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-1 overflow-x-auto">{DOC_TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k)} data-testid={`doc-tab-${k}`} className={`min-h-[44px] whitespace-nowrap rounded-xl px-3 text-sm ${tab === k ? "bg-emerald-50 font-semibold text-emerald-800" : "text-slate-500 hover:bg-slate-50"}`}>{l}</button>)}</div>
          <div className="relative md:w-64"><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input className="tid-input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search documents" data-testid="doc-search-input" /></div>
        </div>
        {!enrolled && <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Enrol your face (Face Scan) before uploading documents.</p>}
        <div className="mt-5">{rows.length === 0 ? <EmptyState title="No documents" text="Upload Aadhaar, PAN, Voter ID, Driving License, Passport or other files." testId="docs-empty" /> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{rows.map((d) => <DocCard key={d.id} doc={d} onOpen={setViewing} />)}</div>}</div>
        <p className="mt-5 text-xs text-slate-400">Documents are stored as uploaded copies. Businesses never receive your files — at most they see which document types you hold, and only with your consent.</p>
      </div>
      <UploadDocDialog open={upload} defaultType={tab} onClose={() => setUpload(false)} onUploaded={load} />
      {viewing && <DocViewer doc={viewing} onClose={() => setViewing(null)} onDeleted={load} />}
    </div>
  );
}

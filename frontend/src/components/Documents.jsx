import { useEffect, useState } from "react";
import { FileText, Loader2, Upload, Download, Trash2, ImageOff } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { api, errMsg, fmt } from "@/lib/api";
import { StatusBadge } from "@/components/Shared";

export const DOC_TABS = [["all", "All Documents"], ["aadhaar", "Aadhaar"], ["pan", "PAN"], ["driving_licence", "Driving License"], ["passport", "Passport"], ["voter_id", "Voter ID"], ["other", "Others"]];
const ACCEPT = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

function useBlobUrl(doc, enabled = true) {
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!enabled) return undefined;
    let u = null;
    let alive = true;
    api.get(`/vault/documents/${doc.id}/file`, { responseType: "blob" })
      .then((r) => {
        u = URL.createObjectURL(r.data);
        if (alive) setUrl(u);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      if (u) URL.revokeObjectURL(u);
    };
  }, [doc.id, enabled]);
  return { url, failed };
}

function DocThumb({ doc }) {
  const isImg = doc.content_type.startsWith("image/");
  const { url, failed } = useBlobUrl(doc, isImg);
  if (!isImg) return <div className="grid h-full w-full place-items-center bg-rose-50"><FileText className="h-8 w-8 text-rose-500" /></div>;
  if (failed) return <div className="grid h-full w-full place-items-center bg-slate-100"><ImageOff className="h-6 w-6 text-slate-400" /></div>;
  if (!url) return <div className="h-full w-full animate-pulse bg-slate-100" />;
  return <img src={url} alt={doc.title} className="h-full w-full object-cover" />;
}

export function DocCard({ doc, onOpen }) {
  return (
    <button onClick={() => onOpen(doc)} className="group rounded-2xl border border-slate-200 bg-white p-3 text-left transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-md" data-testid={`doc-card-${doc.id}`}>
      <p className="truncate text-sm font-semibold text-slate-900">{doc.title}</p>
      <p className="truncate text-[11px] text-slate-500">{doc.type_label}</p>
      <div className="mt-3 flex gap-3">
        <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-slate-100"><DocThumb doc={doc} /></div>
        <div className="flex flex-col justify-between">
          <StatusBadge value="uploaded" />
          <p className="text-[11px] text-slate-500">Added on<br />{new Date(doc.created_at).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}</p>
        </div>
      </div>
    </button>
  );
}

export function UploadDocDialog({ open, onClose, onUploaded, defaultType = "aadhaar" }) {
  const [type, setType] = useState(defaultType);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setType(defaultType === "all" ? "aadhaar" : defaultType);
      setFile(null);
      setTitle("");
    }
  }, [open, defaultType]);
  const pick = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!ACCEPT.includes(f.type)) return toast.error("Upload a JPG, PNG, WEBP or PDF file.");
    if (f.size > 5 * 1024 * 1024) return toast.error("Files must be 5 MB or smaller.");
    setFile(f);
  };
  const submit = async (e) => {
    e.preventDefault();
    if (!file) return toast.error("Choose a file to upload.");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("doc_type", type);
      fd.append("title", title.trim());
      const { data } = await api.post("/vault/documents", fd);
      toast.success(`${data.type_label} added to your vault`);
      onUploaded(data);
      onClose();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-white" data-testid="upload-doc-dialog">
        <DialogHeader><DialogTitle className="font-display text-xl">Upload Document</DialogTitle><DialogDescription>Files are encrypted before storage and only you can open them. TrustID stores your copy — it does not verify it with the issuing authority.</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div><label className="tid-label">Document type</label><select className="tid-input mt-2" value={type} onChange={(e) => setType(e.target.value)} data-testid="doc-type-select">{DOC_TABS.slice(1).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          <div><label className="tid-label">Label (optional)</label><input className="tid-input mt-2" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Aadhaar – front side" data-testid="doc-title-input" /></div>
          <label className="flex min-h-[110px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-4 text-center hover:border-emerald-300" data-testid="doc-file-dropzone">
            <Upload className="h-6 w-6 text-emerald-600" />
            <span className="text-sm font-semibold">{file ? file.name : "Choose a file"}</span>
            <span className="text-xs text-slate-500">JPG, PNG, WEBP or PDF · max 5 MB</span>
            <input type="file" accept={ACCEPT.join(",")} className="hidden" onChange={pick} data-testid="doc-file-input" />
          </label>
          <button className="tid-btn-primary w-full" disabled={busy || !file} data-testid="doc-upload-submit">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Upload securely</button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DocViewer({ doc, onClose, onDeleted }) {
  const { url, failed } = useBlobUrl(doc);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const del = async () => {
    setBusy(true);
    try {
      await api.delete(`/vault/documents/${doc.id}`);
      toast.success("Document deleted");
      onDeleted(doc.id);
      onClose();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[92vh] overflow-y-auto bg-white sm:max-w-3xl" data-testid="doc-viewer">
        <DialogHeader><DialogTitle className="font-display text-xl">{doc.title}</DialogTitle><DialogDescription>{doc.type_label} · {doc.original_filename} · {(doc.size / 1024).toFixed(0)} KB · added {fmt(doc.created_at)}</DialogDescription></DialogHeader>
        <div className="grid min-h-[300px] place-items-center overflow-hidden rounded-2xl bg-slate-100">
          {failed && <p className="text-sm text-rose-600">Could not load this document. Please try again.</p>}
          {!url && !failed && <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />}
          {url && doc.content_type.startsWith("image/") && <img src={url} alt={doc.title} className="max-h-[60vh] w-auto" data-testid="doc-viewer-image" />}
          {url && doc.content_type === "application/pdf" && <iframe src={url} title={doc.title} className="h-[60vh] w-full" data-testid="doc-viewer-pdf" />}
        </div>
        <div className="flex flex-wrap gap-2">
          {url && <a href={url} download={doc.original_filename} className="tid-btn-dark" data-testid="doc-download-btn"><Download className="h-4 w-4" />Download</a>}
          {!confirm ? <button className="tid-btn-ghost text-rose-600" onClick={() => setConfirm(true)} data-testid="doc-delete-btn"><Trash2 className="h-4 w-4" />Delete</button> : (
            <button className="tid-btn-danger" disabled={busy} onClick={del} data-testid="doc-delete-confirm-btn">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Confirm delete</button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

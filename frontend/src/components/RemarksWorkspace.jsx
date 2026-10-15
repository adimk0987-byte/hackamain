import { useCallback, useEffect, useState } from "react";
import { Search, Archive, ArchiveRestore, Pencil, History, Loader2, Lock, Plus, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg, fmt } from "@/lib/api";
import { EmptyState } from "@/components/Shared";

function NoteItem({ n, onChanged }) {
  const [edit, setEdit] = useState(false);
  const [body, setBody] = useState(n.body);
  const [showHist, setShowHist] = useState(false);
  const [busy, setBusy] = useState(false);
  const patch = async (payload, ok) => {
    setBusy(true);
    try {
      await api.patch(`/nexus/notes/${n.id}`, payload);
      toast.success(ok);
      setEdit(false);
      onChanged();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="rounded-2xl border border-slate-200 p-4" data-testid={`note-${n.id}`}>
      {edit ? (
        <div>
          <textarea className="tid-input h-24 py-2" value={body} maxLength={2000} onChange={(e) => setBody(e.target.value)} data-testid="note-edit-input" />
          <div className="mt-2 flex gap-2"><button className="tid-btn-primary" disabled={busy || !body.trim()} onClick={() => patch({ body }, "Remark updated")} data-testid="note-save-btn">Save</button><button className="tid-btn-ghost" onClick={() => setEdit(false)} data-testid="note-cancel-btn">Cancel</button></div>
        </div>
      ) : <p className="whitespace-pre-wrap text-sm text-slate-800" data-testid="note-body">{n.body}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        {n.tags.map((t) => <span key={t} className="rounded bg-violet-50 px-2 py-0.5 font-semibold text-violet-700">#{t}</span>)}
        <span>{n.author} · {fmt(n.updated_at)}</span>
        <div className="ml-auto flex gap-1">
          {!n.archived && <button className="grid h-11 w-11 place-items-center rounded-lg hover:bg-slate-100" onClick={() => setEdit(true)} title="Edit" data-testid="note-edit-btn"><Pencil className="h-4 w-4" /></button>}
          <button className="grid h-11 w-11 place-items-center rounded-lg hover:bg-slate-100" onClick={() => patch({ archived: !n.archived }, n.archived ? "Remark restored" : "Remark archived")} title={n.archived ? "Restore" : "Archive"} data-testid="note-archive-btn">{n.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}</button>
          {n.history.length > 0 && <button className="grid h-11 w-11 place-items-center rounded-lg hover:bg-slate-100" onClick={() => setShowHist(!showHist)} title="History" data-testid="note-history-btn"><History className="h-4 w-4" /></button>}
        </div>
      </div>
      {showHist && <ul className="mt-3 space-y-2 border-t border-slate-100 pt-3" data-testid="note-history">{n.history.slice().reverse().map((h, i) => <li key={i} className="text-xs text-slate-500"><b>{h.changed_by}</b> · {fmt(h.changed_at)} — previous: “{h.body.slice(0, 120)}”{h.archived ? " (archived)" : ""}</li>)}</ul>}
    </li>
  );
}

function AddNote({ qid, onAdded }) {
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const add = async (e) => {
    e.preventDefault();
    if (!body.trim()) return toast.error("Write a remark first.");
    setBusy(true);
    try {
      await api.post(`/nexus/qrs/${qid}/notes`, { body: body.trim(), tags: tags.split(",").map((t) => t.trim()).filter(Boolean) });
      setBody("");
      setTags("");
      toast.success("Private remark saved");
      onAdded();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={add} className="space-y-2">
      <textarea className="tid-input h-20 py-2" maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Internal remark — don't store passwords, biometrics or ID numbers here." data-testid="note-input" />
      <div className="flex gap-2"><input className="tid-input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="tags, comma separated" data-testid="note-tags-input" /><button className="tid-btn-dark shrink-0" disabled={busy} data-testid="note-add-btn">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Add</button></div>
    </form>
  );
}

function Tasks({ qid, tasks, onChanged }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const add = async (e) => {
    e.preventDefault();
    if (title.trim().length < 2) return toast.error("Task title needs 2+ characters.");
    try {
      await api.post(`/nexus/qrs/${qid}/tasks`, { title: title.trim(), due_date: due || null });
      setTitle("");
      setDue("");
      onChanged();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };
  const toggle = async (t) => {
    try {
      await api.patch(`/nexus/tasks/${t.id}`, { done: !t.done });
      onChanged();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };
  return (
    <div>
      <h4 className="font-display font-bold">Follow-up tasks</h4>
      <form onSubmit={add} className="mt-3 flex flex-col gap-2 sm:flex-row"><input className="tid-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Call back about missing claim" data-testid="task-title-input" /><input type="date" className="tid-input sm:w-44" value={due} onChange={(e) => setDue(e.target.value)} data-testid="task-due-input" /><button className="tid-btn-dark shrink-0" data-testid="task-add-btn"><Plus className="h-4 w-4" />Task</button></form>
      <ul className="mt-3 space-y-2" data-testid="task-list">
        {tasks.map((t) => (
          <li key={t.id} className="flex min-h-[44px] items-center gap-3 rounded-xl border border-slate-200 px-3">
            <input type="checkbox" className="h-5 w-5 accent-emerald-600" checked={t.done} onChange={() => toggle(t)} data-testid={`task-toggle-${t.id}`} />
            <span className={`flex-1 text-sm ${t.done ? "text-slate-400 line-through" : ""}`}>{t.title}</span>
            {t.due_date && <span className="flex items-center gap-1 text-xs text-slate-500"><CalendarClock className="h-3.5 w-3.5" />{t.due_date}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RemarksWorkspace({ qid }) {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [archived, setArchived] = useState(false);
  const [data, setData] = useState({ notes: [], tasks: [] });
  const load = useCallback(() => api.get(`/nexus/qrs/${qid}/notes`, { params: { q, tag, archived } }).then((r) => setData(r.data)).catch((e) => toast.error(errMsg(e))), [qid, q, tag, archived]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);
  return (
    <div className="space-y-6" data-testid="remarks-workspace">
      <p className="flex items-center gap-2 rounded-xl bg-violet-50 px-4 py-3 text-xs font-medium text-violet-800"><Lock className="h-4 w-4" />Private to your organisation. Never shown in QR codes, recipient pages, WhatsApp messages or citizen results.</p>
      <AddNote qid={qid} onAdded={load} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1"><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input className="tid-input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search remarks" data-testid="note-search-input" /></div>
        <input className="tid-input sm:w-40" value={tag} onChange={(e) => setTag(e.target.value.trim())} placeholder="Filter tag" data-testid="note-tag-filter" />
        <button className={`tid-btn-ghost ${archived ? "border-emerald-300 bg-emerald-50" : ""}`} onClick={() => setArchived(!archived)} data-testid="note-archived-toggle"><Archive className="h-4 w-4" />{archived ? "Showing archived" : "Show archived"}</button>
      </div>
      {data.notes.length === 0 ? <EmptyState title={archived ? "No archived remarks" : "No remarks yet"} testId="notes-empty" /> : <ul className="space-y-3">{data.notes.map((n) => <NoteItem key={n.id} n={n} onChanged={load} />)}</ul>}
      <Tasks qid={qid} tasks={data.tasks} onChanged={load} />
    </div>
  );
}

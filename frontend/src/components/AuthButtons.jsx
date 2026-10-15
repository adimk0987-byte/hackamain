import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";

export function GoogleButton({ returnTo }) {
  const go = () => {
    sessionStorage.setItem("tid_return", returnTo);
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };
  return (
    <button onClick={go} className="tid-btn-ghost w-full" data-testid="google-login-btn">
      <svg viewBox="0 0 24 24" className="h-4 w-4"><path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.2-4.8 3.2-8.1Z" /><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23Z" /><path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8l3.7-2.8Z" /><path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4Z" /></svg>
      Continue with Google
    </button>
  );
}

export function DemoButton({ role, label, onDone }) {
  const [demo, setDemo] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.get("/config").then((r) => setDemo(r.data.demo_mode)).catch(() => {});
  }, []);
  if (!demo) return null;
  const go = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/auth/demo-login", { role });
      onDone(data);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 p-4" data-testid="demo-login-panel">
      <p className="tid-label">Development demo account</p>
      <button onClick={go} disabled={busy} className="tid-btn-ghost mt-3 w-full" data-testid={`demo-login-${role}`}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{label}</button>
      <p className="mt-2 text-[11px] text-slate-400">Shown only while DEMO_MODE is enabled on the server.</p>
    </div>
  );
}

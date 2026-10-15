import { Link, useLocation } from "react-router-dom";
import { ShieldOff, Compass } from "lucide-react";
import { Logo } from "@/components/Logo";

function Frame({ icon: Icon, code, title, text, testId }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC]">
      <header className="px-6 py-5"><Logo /></header>
      <main className="grid flex-1 place-items-center px-4">
        <div className="tid-card max-w-md p-10 text-center" data-testid={testId}>
          <Icon className="mx-auto h-12 w-12 text-emerald-600" />
          <p className="mt-4 font-mono text-xs text-slate-400">{code}</p>
          <h1 className="mt-1 font-display text-2xl font-bold">{title}</h1>
          <p className="mt-2 text-sm text-slate-500">{text}</p>
          <Link to="/" className="tid-btn-primary mt-6" data-testid="error-home-btn">Back to TrustID</Link>
        </div>
      </main>
    </div>
  );
}

export function Unauthorized() {
  const { state } = useLocation();
  return <Frame icon={ShieldOff} code="403" testId="unauthorized-page" title="Access denied"
    text={`Your account does not have ${state?.role || "the required"} access. Roles are assigned by TrustID administrators — they cannot be self-selected.`} />;
}

export function NotFound() {
  return <Frame icon={Compass} code="404" testId="not-found-page" title="Page not found" text="The page you are looking for does not exist or has moved." />;
}

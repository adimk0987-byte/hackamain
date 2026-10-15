import { Link } from "react-router-dom";

export function Logo({ to = "/", dark = false }) {
  return (
    <Link to={to} className="flex items-center gap-2.5" data-testid="logo-link">
      <span className="relative grid h-10 w-10 place-items-center rounded-xl bg-slate-900">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
          <path d="M12 2.5 4 5.5v6c0 5 3.4 8.9 8 10 4.6-1.1 8-5 8-10v-6l-8-3Z" stroke="#34D399" strokeWidth="1.6" />
          <circle cx="12" cy="10" r="2.6" stroke="#fff" strokeWidth="1.5" />
          <path d="M7.8 16.2c1-1.7 2.5-2.6 4.2-2.6s3.2.9 4.2 2.6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
      <span className="leading-tight">
        <span className={`block font-display text-lg font-extrabold tracking-tight ${dark ? "text-white" : "text-slate-900"}`}>TrustID</span>
        <span className={`block text-[10px] font-semibold uppercase tracking-[0.16em] ${dark ? "text-emerald-300" : "text-emerald-700"}`}>FaceGate Identity</span>
      </span>
    </Link>
  );
}

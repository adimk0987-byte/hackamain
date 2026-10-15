import { Logo } from "@/components/Logo";

export function AuthShell({ title, subtitle, children, side }) {
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="mx-auto flex max-w-6xl items-center px-4 py-5 sm:px-8"><Logo /></header>
      <main className="mx-auto grid max-w-6xl gap-8 px-4 pb-16 sm:px-8 lg:grid-cols-[1fr_1.05fr]">
        <div className="rise">
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl" data-testid="page-title">{title}</h1>
          <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
        <div className="tid-card p-5 sm:p-6 rise rise-1">{side}</div>
      </main>
    </div>
  );
}

import { SidebarNav } from "./SidebarNav";
import { UserCard } from "./UserCard";
import { Wordmark } from "./Wordmark";

export function AppSidebar({
  userName,
  onSignOut,
  onNavigate,
}: {
  userName: string;
  onSignOut: () => void;
  onNavigate?: (() => void) | undefined;
}) {
  return (
    <div className="flex h-full w-full flex-col gap-8 bg-sidebar px-4 py-5">
      <UserCard name={userName} onSignOut={onSignOut} />
      <div className="flex-1 overflow-y-auto">
        <SidebarNav onNavigate={onNavigate} />
      </div>
      <div className="rounded-[var(--radius)] bg-navy p-4 shadow-card">
        <div className="font-mono text-lg tracking-[0.28em] text-mint">LASSO</div>
        <div className="mt-1 text-xs text-cream/80">by Charlotte Labs</div>
        <button
          type="button"
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-mint px-3 py-1 font-mono text-[11px] tracking-[0.1em] text-navy transition-opacity hover:opacity-90"
        >
          <span aria-hidden>◆</span> Why Lasso
        </button>
      </div>
    </div>
  );
}
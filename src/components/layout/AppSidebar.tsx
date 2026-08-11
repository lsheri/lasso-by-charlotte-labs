import { Link } from "@tanstack/react-router";

import type { Profile } from "@/hooks/use-profile";
import { FeedbackDialog } from "@/components/feedback/FeedbackWidget";

import { OrgSwitcher } from "./OrgSwitcher";
import { LassoLogo } from "./LassoLogo";
import { SidebarNav } from "./SidebarNav";
import { UserCard } from "./UserCard";

export function AppSidebar({
  userName,
  userRole,
  profiles,
  activeProfile,
  onSignOut,
  onNavigate,
}: {
  userName: string;
  userRole: string | undefined;
  profiles: Profile[];
  activeProfile: Profile | null;
  onSignOut: () => void;
  onNavigate?: (() => void) | undefined;
}) {
  return (
    <div className="flex h-full w-full flex-col gap-8 bg-sidebar px-4 py-5">
      <UserCard name={userName} role={userRole} onSignOut={onSignOut} />
      <div className="flex-1 overflow-y-auto">
        <SidebarNav onNavigate={onNavigate} />
      </div>
      <OrgSwitcher profiles={profiles} active={activeProfile} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1">
        <Link
          to="/trust"
          onClick={onNavigate}
          className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
        >
          Trust &amp; data
        </Link>
        <Link
          to="/why"
          onClick={onNavigate}
          className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
        >
          Why Lasso
        </Link>
        <FeedbackDialog
          trigger={
            <button
              type="button"
              className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
            >
              Feedback
            </button>
          }
        />
      </div>
      <div className="rounded-[var(--radius)] bg-navy p-4 shadow-card">
        <div className="flex items-center gap-3">
          <LassoLogo size="md" />
          <div>
            <div className="font-mono text-lg tracking-[0.28em] text-mint">LASSO</div>
            <div className="mt-1 text-xs text-cream/80">by Charlotte Labs</div>
          </div>
        </div>
        <Link
          to="/why"
          onClick={onNavigate}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-mint px-3 py-1 font-mono text-[11px] tracking-[0.1em] text-navy transition-opacity hover:opacity-90"
        >
          <span aria-hidden>◆</span> Why Lasso
        </Link>
      </div>
    </div>
  );
}

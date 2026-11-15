import { Link } from "@tanstack/react-router";

import type { Profile } from "@/hooks/use-profile";
import { markWalkthroughEntry } from "@/lib/walkthrough-entry";

import { WorkspaceMenu } from "./WorkspaceMenu";
import { BrandLockup } from "./BrandLockup";
import { SidebarNav } from "./SidebarNav";
import { NotificationBell } from "@/components/notifications/NotificationBell";

const footerLink =
  "font-mono text-[9px] uppercase tracking-[0.08em] text-soft transition-colors hover:text-foreground";

export function AppSidebar({
  userName,
  userRole,
  profiles,
  activeProfile,
  onSignOut,
  onNavigate,
  onOpenSettings,
}: {
  userName: string;
  userRole: string | undefined;
  profiles: Profile[];
  activeProfile: Profile | null;
  onSignOut: () => void;
  onNavigate?: (() => void) | undefined;
  onOpenSettings?: (() => void) | undefined;
}) {
  return (
    <div className="lasso-sidebar-content flex h-full w-full flex-col gap-[22px] bg-sidebar px-4 pb-[18px] pt-[22px]">
      {/* Brand */}
      <div className="flex shrink-0 items-center gap-2.5">
        <BrandLockup size="sm" />
        <div className="ml-auto shrink-0">
          <NotificationBell side="right" align="start" />
        </div>
      </div>

      <div className="shrink-0">
        <WorkspaceMenu profiles={profiles} active={activeProfile} name={userName} onOpenSettings={onOpenSettings} onNavigate={onNavigate} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <SidebarNav onNavigate={onNavigate} onOpenSettings={onOpenSettings} />
      </div>

      {/* Footer */}
      <div className="flex shrink-0 flex-col gap-1.5">
        <div className="h-px w-[208px] max-w-full bg-[var(--nb-pencil)]" aria-hidden />
        <div className="flex flex-wrap items-start gap-x-2.5 gap-y-1">
          <Link
            to="/how-lasso-works"
            onClick={() => {
              markWalkthroughEntry("sidebar");
              onNavigate?.();
            }}
            className={footerLink}
          >
            How Lasso works
          </Link>

        </div>
      </div>
    </div>
  );
}

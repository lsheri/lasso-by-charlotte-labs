import { Link } from "@tanstack/react-router";

import type { Profile } from "@/hooks/use-profile";
import { FeedbackDialog } from "@/components/feedback/FeedbackWidget";
import { ChecklistLauncher } from "@/components/onboarding/checklist/ChecklistLauncher";
import { markWalkthroughEntry } from "@/lib/walkthrough-entry";

import { OrgSwitcher } from "./OrgSwitcher";
import { LassoLogo } from "./LassoLogo";
import { SidebarNav } from "./SidebarNav";
import { UserCard } from "./UserCard";

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
    <div className="flex h-full w-full flex-col gap-[22px] bg-sidebar px-4 pb-[18px] pt-[22px]">
      {/* Brand */}
      <div className="flex items-center gap-2.5">
        <LassoLogo size="sm" />
        <div className="min-w-0">
          <div className="font-serif text-lg leading-6 text-foreground">Lasso</div>
          <div className="font-hand text-[11.5px] leading-4 text-green">by Charlotte Labs</div>
        </div>
      </div>

      <UserCard name={userName} role={userRole} onSignOut={onSignOut} />

      <div className="flex-1 overflow-y-auto">
        <SidebarNav onNavigate={onNavigate} onOpenSettings={onOpenSettings} />
      </div>

      <OrgSwitcher profiles={profiles} active={activeProfile} />

      {/* Footer */}
      <div className="flex flex-col gap-1.5">
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
          <Link to="/trust" onClick={onNavigate} className={footerLink}>
            Trust &amp; data
          </Link>
          <Link to="/why" onClick={onNavigate} className={footerLink}>
            Why Lasso
          </Link>
          <ChecklistLauncher />
          <FeedbackDialog
            trigger={
              <button type="button" className={footerLink}>
                Feedback
              </button>
            }
          />
        </div>
      </div>
    </div>
  );
}

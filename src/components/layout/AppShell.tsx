import { Outlet, useNavigate } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";

import { AppSidebar } from "./AppSidebar";
import { MobileTabBar } from "./MobileTabBar";
import { FeedbackDialog, FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import { AskLassoProvider } from "@/components/reflect/ask-lasso-context";
import { AskDockStateProvider } from "@/components/reflect/ask-dock-state";
import { ChecklistLauncher } from "@/components/onboarding/checklist/ChecklistLauncher";
import { StepPopover } from "@/components/onboarding/checklist/StepPopover";

export function AppShell() {
  const { data: profile, profiles } = useProfile();
  const navigate = useNavigate();
  const userName = profile?.display_name ?? "Signed in";

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <AskLassoProvider>
      <AskDockStateProvider>
      <div className="flex min-h-screen w-full bg-background">
        <aside className="hidden w-[264px] shrink-0 border-r border-border md:block">
          <div className="sticky top-0 h-screen">
            <AppSidebar
              userName={userName}
              userRole={profile?.role}
              profiles={profiles}
              activeProfile={profile}
              onSignOut={handleSignOut}
            />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-background/95 px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] backdrop-blur md:hidden">
            <span className="truncate font-mono text-sm tracking-[0.24em] text-foreground">
              LASSO
            </span>
            <div className="flex min-w-0 items-center gap-2">
              <span className="max-w-[28vw] truncate text-xs text-muted-foreground">
                {userName}
              </span>
              <ChecklistLauncher className="shrink-0 whitespace-nowrap rounded-md px-2 py-3 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground" />
              <FeedbackDialog
                trigger={
                  <button
                    type="button"
                    aria-label="Send feedback"
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-foreground/70 transition-colors hover:bg-secondary"
                  >
                    <MessageSquare className="h-5 w-5" />
                  </button>
                }
              />
            </div>
          </header>

          {/* Clears the 56px tab bar plus a 32px breathing gap. Pages with a
              sticky CTA (Work) add their own spacer rather than taxing every page. */}
          <main className="flex-1 px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-6 md:px-8 md:py-12 md:pb-14 lg:px-10 xl:px-14">
            <div className="mx-auto w-full max-w-[1440px]">
              <Outlet />
            </div>
          </main>

        </div>
        <ProvenanceAudit />
        <FeedbackWidget />
        <MobileTabBar />
        <StepPopover />
      </div>
      </AskDockStateProvider>
    </AskLassoProvider>
  );
}

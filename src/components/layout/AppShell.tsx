import { Outlet, useNavigate } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { useState } from "react";

import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";

import { AppSidebar } from "./AppSidebar";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";

export function AppShell() {
  const { data: profile, profiles } = useProfile();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const userName = profile?.display_name ?? "Signed in";

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
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
            <span className="max-w-[38vw] truncate text-xs text-muted-foreground">{userName}</span>
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger
                className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-foreground/70 transition-colors hover:bg-secondary"
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" />
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-[280px] max-w-[85vw] overflow-y-auto border-border bg-sidebar p-0 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]"
              >
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <AppSidebar
                  userName={userName}
                  userRole={profile?.role}
                  profiles={profiles}
                  activeProfile={profile}
                  onSignOut={handleSignOut}
                  onNavigate={() => setMobileOpen(false)}
                />
              </SheetContent>
            </Sheet>
          </div>
        </header>

        <main className="flex-1 px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-6 md:px-12 md:py-14">
          <div className="mx-auto max-w-3xl">
            <Outlet />
          </div>
        </main>
      </div>
      <FeedbackWidget />
    </div>
  );
}

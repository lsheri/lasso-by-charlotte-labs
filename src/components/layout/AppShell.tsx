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
        <div className="flex items-center gap-3 border-b border-border px-4 py-3 md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              className="rounded-md p-1.5 text-foreground/70 transition-colors hover:bg-secondary"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-[264px] border-border bg-sidebar p-0">
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
          <span className="font-mono text-sm tracking-[0.24em] text-foreground">LASSO</span>
        </div>

        <main className="flex-1 px-6 py-10 md:px-12 md:py-14">
          <div className="mx-auto max-w-3xl">
            <Outlet />
          </div>
        </main>
      </div>
      <FeedbackWidget />
    </div>
  );
}
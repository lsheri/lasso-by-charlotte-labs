import { createFileRoute, redirect } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/AppShell";
import { AppShellSkeleton } from "@/components/layout/AppShellSkeleton";
import { supabase } from "@/integrations/supabase/client";
import { ensureAuthUser, ensureProfileState } from "@/hooks/use-profile";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  pendingComponent: AppShellSkeleton,
  pendingMs: 150,
  pendingMinMs: 200,
  beforeLoad: async () => {
    // PERF-2a: identity and profiles come through the shared cache, so an
    // in-app navigation makes no network round trip while they are fresh.
    const identity = await ensureAuthUser().catch(() => null);
    if (!identity) throw redirect({ to: "/auth" });
    // Same user object shape as before, read locally (no network).
    const { data: sessionData } = await supabase.auth.getSession();
    const sessionUser = sessionData.session?.user;
    if (!sessionUser || sessionUser.id !== identity.id) throw redirect({ to: "/auth" });
    const { profiles, hasDeactivated } = await ensureProfileState();
    if (profiles.length === 0) throw redirect({ to: hasDeactivated ? "/no-access" : "/onboarding" });
    // The acting profile lives in useProfile, never here: a person can hold
    // several, and the gate must not pick one the page disagrees with.
    return { user: sessionUser, profiles, gate: "allowed" as const };
  },
  component: AppShell,
});

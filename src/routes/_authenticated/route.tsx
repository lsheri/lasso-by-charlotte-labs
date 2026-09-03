import { createFileRoute, redirect } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { fetchProfileState } from "@/hooks/use-profile";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const { profiles, hasDeactivated } = await fetchProfileState();
    if (profiles.length === 0) throw redirect({ to: hasDeactivated ? "/no-access" : "/onboarding" });
    // The acting profile lives in useProfile, never here: a person can hold
    // several, and the gate must not pick one the page disagrees with.
    return { user: data.user, profiles, gate: "allowed" as const };
  },
  component: AppShell,
});

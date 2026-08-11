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
    const profile = profiles[0];
    if (!profile) throw redirect({ to: hasDeactivated ? "/no-access" : "/onboarding" });
    return { user: data.user, profile };
  },
  component: AppShell,
});

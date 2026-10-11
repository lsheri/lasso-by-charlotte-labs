import type { NavigateFn } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { resetPostHog } from "@/lib/posthog-client";

/** Both signed-in shells clear the analytics identity before signing out. */
export async function signOut(navigate: NavigateFn) {
  resetPostHog();
  await supabase.auth.signOut();
  void navigate({ to: "/auth", replace: true });
}
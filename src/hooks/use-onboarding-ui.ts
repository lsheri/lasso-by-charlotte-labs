import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_ONBOARDING_UI,
  readOnboardingUi,
  type OnboardingUi,
} from "@/lib/onboarding-ui";

/**
 * Reads and writes only the three UI keys, per profile row, through the
 * ordinary self update path. A failed write is silent: this is memory, not
 * data the person asked us to keep.
 */
export function useOnboardingUi() {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const stored = readOnboardingUi(profile?.onboarding);
  const [local, setLocal] = useState<OnboardingUi>(stored);

  useEffect(() => {
    setLocal(readOnboardingUi(profile?.onboarding));
  }, [profile?.id, profile?.onboarding]);

  const update = useCallback(
    (patch: Partial<OnboardingUi>) => {
      const next = { ...local, ...patch };
      setLocal(next);
      if (!profile) return;
      void (async () => {
        await supabase.from("profiles").update({ onboarding: next }).eq("id", profile.id);
        await queryClient.invalidateQueries({ queryKey: ["profiles"] });
      })().catch(() => {
        /* onboarding memory never interrupts the person */
      });
    },
    [local, profile, queryClient],
  );

  return { ui: profile ? local : DEFAULT_ONBOARDING_UI, update };
}

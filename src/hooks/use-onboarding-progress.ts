import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { useProfile } from "@/hooks/use-profile";
import {
  getOnboardingProgress,
  type OnboardingProgress,
} from "@/lib/onboarding-progress.functions";

export type { OnboardingProgress } from "@/lib/onboarding-progress.functions";

/**
 * One query key shared by the card and the collapsed pill, so the checklist
 * costs exactly one request per page load and nothing when it is retired.
 */
export function useOnboardingProgress(enabled: boolean) {
  const { data: profile } = useProfile();
  const run = useServerFn(getOnboardingProgress);
  return useQuery<OnboardingProgress | null>({
    queryKey: ["onboarding-progress", profile?.id ?? null],
    enabled: enabled && Boolean(profile),
    staleTime: 60_000,
    queryFn: () => run({ data: { profile_id: profile?.id } }),
  });
}

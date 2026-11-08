import { useEffect, useState } from "react";

import { flagEnabled, type FeatureFlag } from "@/lib/feature-flags";
import { onFeatureFlagsLoaded } from "@/lib/posthog-client";

/**
 * FLAGS: a flag that should change a surface while it is open. Renders the
 * current answer (the code default before flags load) and re-renders when
 * PostHog loads or reloads flags. For a decision made once at mount, call
 * flagEnabled directly instead.
 */
export function useFeatureFlag(name: FeatureFlag): boolean {
  const [enabled, setEnabled] = useState(() => flagEnabled(name));
  useEffect(() => {
    setEnabled(flagEnabled(name));
    return onFeatureFlagsLoaded(() => setEnabled(flagEnabled(name)));
  }, [name]);
  return enabled;
}

import { useOnboardingProgress } from "@/hooks/use-onboarding-progress";
import { useOnboardingUi } from "@/hooks/use-onboarding-ui";

import { LauncherPill } from "./LauncherPill";
import { completedRequired, requiredCount, stepsFor } from "./steps";

/**
 * The collapsed form of the checklist. It sits in the chrome, never nags,
 * and disappears for good once the card retires.
 */
export function ChecklistLauncher({ className }: { className?: string }) {
  const { ui, update } = useOnboardingUi();
  const collapsed = ui.checklist === "collapsed" && ui.welcome_seen;
  const { data: progress } = useOnboardingProgress(collapsed);
  if (!collapsed || !progress) return null;
  const steps = stepsFor(progress);
  return (
    <LauncherPill
      complete={completedRequired(steps, progress)}
      total={requiredCount(steps)}
      onOpen={() => update({ checklist: "open" })}
      {...(className ? { className } : {})}
    />
  );
}

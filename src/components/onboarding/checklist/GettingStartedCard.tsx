import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { ProgressDots } from "@/components/onboarding/ProgressDots";
import { useOnboardingProgress } from "@/hooks/use-onboarding-progress";
import { useOnboardingUi } from "@/hooks/use-onboarding-ui";
import { markChecklistEntry } from "@/lib/onboarding-entry";
import { requestGuide } from "@/lib/onboarding-guide";

import { ChecklistStep } from "./ChecklistStep";
import { WelcomeCard } from "./WelcomeCard";
import {
  COACH_PRIVACY_LINE,
  completedRequired,
  requiredCount,
  stepsFor,
  type ChecklistStepDef,
} from "./steps";

/**
 * Pinned at the top of the workspace on first run. Every step is computed
 * from the record, so there is nothing to tick off by hand and nothing to
 * celebrate. When the record says the work is done, the card retires.
 */
export function GettingStartedCard() {
  const { ui, update } = useOnboardingUi();
  const navigate = useNavigate();
  const enabled = ui.checklist !== "retired";
  const { data: progress } = useOnboardingProgress(enabled);
  const [farewell, setFarewell] = useState(false);

  const steps = progress ? stepsFor(progress) : [];
  const total = requiredCount(steps);
  const complete = progress ? completedRequired(steps, progress) : 0;
  const allDone = Boolean(progress) && total > 0 && complete === total;

  useEffect(() => {
    if (!allDone || ui.checklist === "retired") return;
    setFarewell(true);
    update({ checklist: "retired", retired_at: new Date().toISOString() });
  }, [allDone, ui.checklist, update]);

  if (!enabled) {
    return farewell ? (
      <p className="mb-8 text-sm text-muted-foreground print:hidden">
        Setup is complete. Getting started is closed for good.
      </p>
    ) : null;
  }

  if (!progress) return null;

  if (!ui.welcome_seen) {
    return (
      <WelcomeCard
        variant={progress.role_variant}
        onStart={() => update({ welcome_seen: true, checklist: "open" })}
        onSkip={() => update({ welcome_seen: true, checklist: "collapsed" })}
      />
    );
  }

  if (ui.checklist === "collapsed") return null;

  function act(step: ChecklistStepDef) {
    markChecklistEntry();
    requestGuide(step.id);
    void navigate({ to: step.to as never });
  }

  return (
    <section className="mb-8 rounded-[var(--radius)] border border-border bg-card p-5 shadow-card print:hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="micro-label">Getting started</p>
          <p className="mt-1 text-sm text-foreground">
            {complete} of {total} done, read from your record
          </p>
        </div>
        <button
          type="button"
          onClick={() => update({ checklist: "collapsed" })}
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Collapse
        </button>
      </div>

      <div className="-mt-4">
        <ProgressDots total={Math.max(total, 1)} current={Math.min(complete, total - 1)} />
      </div>

      {progress.role_variant === "coach" ? (
        <p className="mt-4 rounded-[var(--radius)] border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          {COACH_PRIVACY_LINE}
        </p>
      ) : null}

      <ul className="mt-3 space-y-1">
        {steps
          .filter((s) => !s.optional)
          .map((step) => (
            <ChecklistStep key={step.id} step={step} progress={progress} onAct={act} />
          ))}
      </ul>
      {steps.some((s) => s.optional) ? (
        <ul className="mt-3 space-y-1 border-t border-border pt-3">
          {steps
            .filter((s) => s.optional)
            .map((step) => (
              <ChecklistStep key={step.id} step={step} progress={progress} onAct={act} />
            ))}
        </ul>
      ) : null}
    </section>
  );
}

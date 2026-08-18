import { Check } from "lucide-react";

import type { OnboardingProgress } from "@/lib/onboarding-progress.functions";

import type { ChecklistStepDef } from "./steps";

export function ChecklistStep({
  step,
  progress,
  onAct,
}: {
  step: ChecklistStepDef;
  progress: OnboardingProgress;
  onAct: (step: ChecklistStepDef) => void;
}) {
  const done = step.done(progress);
  return (
    <li>
      <button
        type="button"
        onClick={() => onAct(step)}
        className="flex min-h-[44px] w-full items-start gap-3 rounded-[var(--radius)] px-2 py-2 text-left transition-colors hover:bg-secondary/60"
      >
        <span
          aria-hidden
          className={
            done
              ? "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-accent-deep text-accent-foreground"
              : "mt-0.5 h-4 w-4 shrink-0 rounded-full border border-border"
          }
        >
          {done ? <Check className="h-3 w-3" /> : null}
        </span>
        <span className="min-w-0">
          <span className="block text-sm text-foreground">
            {step.label}
            {step.optional ? (
              <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                optional
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">{done ?? step.hint}</span>
        </span>
      </button>
    </li>
  );
}

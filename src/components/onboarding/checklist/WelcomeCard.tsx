import spiderAsset from "@/assets/coach-lasso-spider.png.asset.json";
import { Button } from "@/components/ui/button";
import type { OnboardingRoleVariant } from "@/lib/onboarding-progress.functions";

import { COACH_PRIVACY_LINE } from "./steps";

/** An embedded banner, shown once. Never a modal, never a blocker. */
export function WelcomeCard({
  variant,
  onStart,
  onSkip,
}: {
  variant: OnboardingRoleVariant;
  onStart: () => void;
  onSkip: () => void;
}) {
  return (
    <section className="mb-8 rounded-[var(--radius)] border border-border bg-card p-5 shadow-card print:hidden">
      <div className="flex items-start gap-4">
        <img
          src={spiderAsset.url}
          alt=""
          aria-hidden
          className="hidden h-12 w-auto shrink-0 select-none sm:block"
          loading="lazy"
          decoding="async"
        />
        <div className="min-w-0">
          <p className="micro-label">Welcome</p>
          <h2 className="mt-1 text-base font-medium text-foreground">
            {variant === "coach" ? "Your coaching workspace" : "Your work, your record"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {variant === "coach"
              ? COACH_PRIVACY_LINE
              : "Bring your work in, give it a home, and see your own thinking. Everything stays private to you until you map it."}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <Button type="button" onClick={onStart}>
              Show me around
            </Button>
            <button
              type="button"
              onClick={onSkip}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

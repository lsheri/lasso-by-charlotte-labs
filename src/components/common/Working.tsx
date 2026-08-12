import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * One spinner for the whole app. Ember, because working is an action, and
 * still for anyone who has asked their system for less motion.
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Working"
      className={cn(
        "inline-block size-3.5 shrink-0 rounded-full border-2 border-ember/30 border-t-ember",
        "motion-safe:animate-spin",
        className,
      )}
    />
  );
}

/**
 * A working state that says what is actually happening, and keeps saying it
 * for as long as the answer takes. The verbs are honest about the stages an
 * answer really goes through: gather, read, then think.
 */
export function ThinkingIndicator({
  stages = ["Gathering your work…", "Reading what's there…", "Thinking it through…"],
  className,
}: {
  stages?: string[];
  className?: string;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1 < stages.length ? prev + 1 : prev));
    }, 6000);
    return () => clearInterval(timer);
  }, [stages.length]);

  return (
    <div className={cn("flex items-center gap-2", className)} aria-live="polite">
      <Spinner />
      <span className="text-sm text-muted-foreground">{stages[index]}</span>
    </div>
  );
}

/** Inline label for a button that is mid-flight. */
export function WorkingLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Spinner />
      {children}
    </span>
  );
}
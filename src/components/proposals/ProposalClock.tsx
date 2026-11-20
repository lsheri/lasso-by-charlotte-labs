import { timeLeftLine, type TimeLeft } from "@/lib/proposal-desk-shared";
import { cn } from "@/lib/utils";

const CLOCK_COPY = {
  atGoal: (goal: number) => `At the ${goal} hour goal`,
} as const;

/** True at the exact moment the goal runs out. A date that cannot be read is never "at the goal". */
export function isAtGoal(receivedAt: string, goalHours: number, now?: Date | undefined): boolean {
  const received = Date.parse(receivedAt);
  if (!Number.isFinite(received) || goalHours <= 0) return false;
  return (now ?? new Date()).getTime() - received === goalHours * 3_600_000;
}

/** How much of the goal is used, 0 to 1. A proposal that has gone out, or run over, fills the bar. */
export function clockShare(left: TimeLeft, goalHours: number): number {
  if (left.state !== "running" || goalHours <= 0) return 1;
  return Math.min(1, Math.max(0, 1 - left.hoursLeft / goalHours));
}

/**
 * 20 Nov 2026 (Liam, D-86): the clock is a bar with a mark at the goal, so how close the edge is reads at a glance,
 * and its one line beneath says exactly what the bar shows. The bar only decorates the words: a screen reader gets
 * the line. Over the goal, or sent late, it is red; sent in time it is the good tint.
 */
export function ProposalClock({
  left,
  goalHours,
  atGoal,
  className,
}: {
  left: TimeLeft;
  goalHours: number;
  /** The very moment the goal runs out: not an hour to spare, and not over yet. */
  atGoal?: boolean | undefined;
  className?: string | undefined;
}) {
  const good = left.state === "sent" && left.withinGoal;
  const late = left.state === "over" || (left.state === "sent" && !left.withinGoal);
  return (
    <div className={cn("min-w-0", className)}>
      <div className="relative pr-1.5">
        <div
          aria-hidden="true"
          data-proposal-clock-bar
          className={cn("h-1.5 overflow-hidden rounded-full", good ? "bg-[var(--good-tint)]" : "bg-[var(--action-wash)]")}
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500 ease-[cubic-bezier(.45,0,.2,1)] motion-reduce:transition-none",
              late ? "bg-destructive" : good ? "bg-[var(--good-mark)]" : "bg-[var(--action-fill)]",
            )}
            style={{ width: `${Math.round(clockShare(left, goalHours) * 100)}%` }}
          />
        </div>
        {/* The goal itself: a short upright mark at the end of the bar. */}
        <span aria-hidden="true" data-proposal-goal-mark className="absolute right-0 top-1/2 h-3.5 w-0.5 -translate-y-1/2 rounded-full bg-foreground" />
      </div>
      <p
        data-proposal-clock={left.state}
        className={cn(
          "mt-1.5 text-(length:--type-small) font-medium",
          left.state === "over" ? "text-destructive" : "text-foreground",
        )}
      >
        {atGoal ? CLOCK_COPY.atGoal(goalHours) : timeLeftLine(left, goalHours)}
      </p>
    </div>
  );
}

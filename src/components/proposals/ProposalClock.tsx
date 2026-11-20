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

/**
 * How much of the goal is used, 0 to 1. Run over fills the bar. Gone out shows when it went out against the goal
 * (QA M3): under an hour is a sliver, at hour 71 nearly full, late is full.
 */
export function clockShare(left: TimeLeft, goalHours: number): number {
  if (goalHours <= 0 || left.state === "over") return 1;
  if (left.state === "sent") return left.underAnHour ? Math.min(1, 0.5 / goalHours) : Math.min(1, Math.max(0, left.hoursTaken / goalHours));
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
  large = false,
  className,
}: {
  left: TimeLeft;
  goalHours: number;
  /** The very moment the goal runs out: not an hour to spare, and not over yet. */
  atGoal?: boolean | undefined;
  /** Up next: time as a bolder shape, so the one proposal that matters reads from across the room. */
  large?: boolean | undefined;
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
          className={cn("overflow-hidden rounded-full", large ? "h-2.5" : "h-1.5", good ? "bg-[var(--good-tint)]" : "bg-[var(--action-wash)]")}
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
        <span aria-hidden="true" data-proposal-goal-mark className={cn("absolute right-0 top-1/2 w-0.5 -translate-y-1/2 rounded-full bg-foreground", large ? "h-5" : "h-3.5")} />
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

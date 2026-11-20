import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * SkeletonFrame: the quiet stand-in for a page section that is waiting for its first read. It holds the shape of what
 * will arrive (rows, stat columns, cards or a panel) in the page's own ground with muted placeholder bars, so nothing
 * jumps when the content lands. Use it instead of a spinner or a "Loading." line. Not for a button that is working
 * (that keeps its own label) and not for the whole signed-in shell (AppShellSkeleton covers that).
 *
 * The bars pulse gently and stand still under reduced motion. Screen readers hear one short line, from `label`.
 */
export type SkeletonFrameShape = "rows" | "stats" | "cards" | "panel";

export const SKELETON_FRAME_COPY = {
  label: "Loading",
} as const;

const bar = "motion-reduce:animate-none";

export function SkeletonFrame({
  shape = "rows",
  count = 3,
  label = SKELETON_FRAME_COPY.label,
  className,
  testId = "skeleton-frame",
  announce = true,
}: {
  shape?: SkeletonFrameShape;
  /** Rows, stat columns or cards to draw. Ignored for `panel`. */
  count?: number;
  /** What a screen reader hears, such as "Loading proposals". */
  label?: string;
  className?: string;
  testId?: string;
  /** False for a second frame in the same section, so a screen reader hears one status line, not two. */
  announce?: boolean;
}) {
  const n = Math.max(1, Math.min(count, 12));
  if (!announce) {
    return (
      <div aria-hidden="true" data-testid={testId} data-shape={shape} className={className}>
        {body(shape, n)}
      </div>
    );
  }
  return (
    <div role="status" aria-busy="true" aria-live="polite" data-testid={testId} data-shape={shape} className={className}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">{body(shape, n)}</div>
    </div>
  );
}

function body(shape: SkeletonFrameShape, n: number) {
  if (shape === "stats") {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: n }, (_, i) => (
          <div key={i} className="flex flex-col gap-2 border-t border-border pt-3">
            <Skeleton className={cn(bar, "h-2.5 w-24")} />
            <Skeleton className={cn(bar, "h-7 w-16")} />
            <Skeleton className={cn(bar, "h-2.5 w-32")} />
          </div>
        ))}
      </div>
    );
  }
  if (shape === "cards") {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: n }, (_, i) => (
          <Skeleton key={i} className={cn(bar, "h-32 w-full border border-border")} />
        ))}
      </div>
    );
  }
  if (shape === "panel") {
    return (
      <div className="flex flex-col gap-3 rounded-[var(--corner-card)] border border-border p-4">
        <Skeleton className={cn(bar, "h-3 w-40")} />
        <Skeleton className={cn(bar, "h-2.5 w-full")} />
        <Skeleton className={cn(bar, "h-2.5 w-5/6")} />
        <Skeleton className={cn(bar, "h-2.5 w-2/3")} />
      </div>
    );
  }
  return (
    <ul className="flex flex-col">
      {Array.from({ length: n }, (_, i) => (
        <li key={i} className="flex flex-col gap-2 border-b border-border px-1 py-3">
          <Skeleton className={cn(bar, "h-3", i % 2 === 0 ? "w-2/3" : "w-1/2")} />
          <Skeleton className={cn(bar, "h-2.5 w-1/3")} />
        </li>
      ))}
    </ul>
  );
}

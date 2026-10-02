import { forwardRef, type ReactNode } from "react";

import { LassoLoopMark } from "@/components/layout/LassoLoopMark";
import { cn } from "@/lib/utils";

export function WorkboardSideRail({ menuControl, closeControl, className }: {
  menuControl: ReactNode;
  closeControl: ReactNode;
  className?: string;
}) {
  return (
    <aside className={cn("workboard-side-rail z-30 flex w-[52px] shrink-0 flex-col items-center border-r border-border bg-card py-3", className)}>
      <LassoLoopMark className="h-7 w-7 text-lasso-green" />
      <div className="mt-5">{menuControl}</div>
      <div className="mt-auto">{closeControl}</div>
    </aside>
  );
}

export function WorkboardHeader({ title, status, toolbar, className }: {
  title: string;
  status: string;
  toolbar: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("workboard-header relative z-20 flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4", className)}>
      <div className="min-w-0 shrink">
        <span className="block truncate text-[13px] font-medium text-foreground">{title}</span>
        <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-soft">{status}</span>
      </div>
      {toolbar}
    </header>
  );
}

export const WorkboardToolbar = forwardRef<HTMLDivElement, { children: ReactNode; className?: string; ariaLabel?: string }>(function WorkboardToolbar({ children, className, ariaLabel }, ref) {
  return <div ref={ref} className={cn("canvas-lab-toolbar flex min-w-0 flex-1 items-center justify-end gap-2 overflow-hidden", className)} aria-label={ariaLabel}>{children}</div>;
});
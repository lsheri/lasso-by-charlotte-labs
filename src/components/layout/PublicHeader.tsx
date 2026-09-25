import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { LassoLoopMark } from "./LassoLoopMark";

const LINKS = [
  { to: "/why" as const, label: "Why Lasso" },
  { to: "/trust" as const, label: "Trust & data" },
];

/** Shared marketing header. `current` hides the link for the page you're on. */
export function PublicHeader({ current, cta }: { current?: "/" | "/why" | "/trust"; cta?: ReactNode }) {
  return (
    <header className="sticky top-0 z-50 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="grid w-full grid-cols-1 items-center gap-3 px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-6 sm:px-8 sm:pb-6 sm:pt-[calc(1.5rem+env(safe-area-inset-top))] md:px-12">
        <Link
          to="/"
          className="flex min-w-0 items-center gap-2 font-mono text-base font-bold tracking-[0.18em] text-foreground sm:gap-4 sm:text-2xl sm:tracking-[0.24em]"
          aria-current={current === "/" ? "page" : undefined}
        >
          <LassoLoopMark className="h-8 w-8 shrink-0 text-lasso-green sm:h-10 sm:w-10" />
          <span className="truncate">LASSO</span>
        </Link>
        <nav className={`grid min-w-0 shrink-0 items-center gap-2 sm:flex sm:gap-10 ${cta ? "grid-cols-2" : "grid-cols-1"}`}>
          {LINKS.filter((link) => link.to !== current).map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="hidden font-mono text-[18px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground sm:inline"
            >
              {link.label}
            </Link>
          ))}
          <Link
            to="/auth"
            className="flex min-h-11 min-w-0 items-center justify-center rounded-[var(--radius)] border-2 border-accent px-3 py-2 font-mono text-[13px] uppercase tracking-[0.08em] text-accent-deep transition-colors hover:bg-accent-soft sm:px-6 sm:py-3 sm:text-[18px]"
          >
            Sign in
          </Link>
          {cta}
        </nav>
      </div>
    </header>
  );
}

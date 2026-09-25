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
      <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-6 px-6 pb-6 pt-[calc(1.5rem+env(safe-area-inset-top))] sm:px-8 md:px-12">
<Link
          to="/"
          className="flex min-w-0 items-center gap-3 font-mono text-lg tracking-[0.18em] text-foreground sm:gap-4 sm:text-2xl sm:tracking-[0.24em]"
          aria-current={current === "/" ? "page" : undefined}
        >
          <LassoLoopMark className="h-10 w-10 text-lasso-green" />
          <span className="truncate">LASSO</span>
        </Link>
        <nav className="flex shrink-0 items-center gap-3 sm:gap-10">
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
            className="rounded-[var(--radius)] border-2 border-accent px-6 py-3 font-mono text-[18px] uppercase tracking-[0.08em] text-accent-deep transition-colors hover:bg-accent-soft"
          >
            Sign in
          </Link>
          {cta}
        </nav>
      </div>
    </header>
  );
}

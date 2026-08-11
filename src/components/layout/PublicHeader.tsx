import { Link } from "@tanstack/react-router";

import { LassoLogo } from "./LassoLogo";

const LINKS = [
  { to: "/why" as const, label: "Why Lasso" },
  { to: "/trust" as const, label: "Trust & data" },
];

/** Shared marketing header. `current` hides the link for the page you're on. */
export function PublicHeader({ current }: { current?: "/" | "/why" | "/trust" }) {
  return (
    <header className="border-b border-border">
      <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 sm:px-6 md:px-10">
        <Link
          to="/"
          className="flex min-w-0 items-center gap-2 font-mono text-sm tracking-[0.24em] text-foreground"
          aria-current={current === "/" ? "page" : undefined}
        >
          <LassoLogo size="sm" />
          <span className="truncate">LASSO</span>
        </Link>
        <nav className="flex shrink-0 items-center gap-3 sm:gap-5">
          {LINKS.filter((link) => link.to !== current).map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="hidden font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground sm:inline"
            >
              {link.label}
            </Link>
          ))}
          <Link
            to="/auth"
            className="rounded-[var(--radius)] border border-accent px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-accent-deep transition-colors hover:bg-accent-soft"
          >
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}

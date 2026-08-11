import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

import { LassoLogo } from "./LassoLogo";

/** Slim header for pre-workspace pages: identity plus a way out. */
export function SessionHeader() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setEmail(data.user?.email ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="border-b border-border">
      <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 sm:px-6 md:px-10">
        <Link
          to="/"
          className="flex min-w-0 items-center gap-2 font-mono text-sm tracking-[0.24em] text-foreground"
        >
          <LassoLogo size="sm" />
          <span className="truncate">LASSO</span>
        </Link>
        <div className="flex shrink-0 items-center gap-3">
          {email ? (
            <span className="hidden max-w-[220px] truncate text-xs text-muted-foreground sm:inline">
              {email}
            </span>
          ) : null}
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-[var(--radius)] border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}

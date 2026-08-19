import { Link, useRouterState } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { useAskLassoHandler } from "@/components/reflect/ask-lasso-context";
import { useProfile } from "@/hooks/use-profile";

const FAB_CLASS =
  "fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30 inline-flex min-h-[56px] items-center gap-2 rounded-full border border-accent-deep/30 bg-accent-deep px-5 text-sm text-accent-foreground shadow-card transition-opacity hover:opacity-90 md:hidden print:hidden";

const HINT_KEY = "lasso.askfab_hint_seen";

function readHintSeen(): boolean {
  try {
    return window.localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return true;
  }
}

function writeHintSeen(): void {
  try {
    window.localStorage.setItem(HINT_KEY, "1");
  } catch {
    /* the hint is a nicety, not a requirement */
  }
}

/**
 * On phones the thumb zone belongs to the thing people reach for most, so Ask
 * Lasso sits bottom right and feedback moves up into the header. Where the page
 * has its own Ask Lasso context, this opens that dock instead of navigating.
 */
export function AskLassoFab() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const handler = useAskLassoHandler();
  const { data: profile } = useProfile();
  const isCoach = profile?.role === "coach";
  const [hintSeen, setHintSeen] = useState(true);

  useEffect(() => {
    setHintSeen(readHintSeen());
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV && !handler && !path.startsWith("/reflect")) {
      // Dev-only nudge: a page showing the FAB without its own Ask Lasso
      // context falls back to /reflect, which is not always the right target.
      console.warn(`[AskLassoFab] no Ask Lasso handler registered for ${path}`);
    }
  }, [handler, path]);

  function dismissHint() {
    if (!hintSeen) {
      writeHintSeen();
      setHintSeen(true);
    }
  }

  useEffect(() => {
    if (hintSeen) return;
    const onTap = () => {
      writeHintSeen();
      setHintSeen(true);
    };
    document.addEventListener("pointerdown", onTap, { once: true });
    return () => document.removeEventListener("pointerdown", onTap);
  }, [hintSeen]);

  if (path.startsWith("/reflect")) return null;
  // A coach has no personal Reflect space, so a page with no context of its own
  // would send them nowhere useful. Show nothing rather than a dead affordance.
  if (!handler && isCoach) return null;

  const hint = isCoach
    ? "Ask about the work shared with you."
    : "Ask about the work on this page.";

  const label = (
    <>
      <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
      Ask Lasso
    </>
  );

  return (
    <>
      {hintSeen ? null : (
        <div
          aria-hidden
          className="pointer-events-none fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 max-w-[70vw] rounded-[var(--radius)] border border-border bg-card px-3 py-2 text-xs text-muted-foreground shadow-card md:hidden print:hidden"
        >
          {hint}
        </div>
      )}
      {handler ? (
        <button
          type="button"
          onClick={() => {
            dismissHint();
            handler();
          }}
          aria-label="Ask Lasso"
          className={FAB_CLASS}
        >
          {label}
        </button>
      ) : (
        <Link to="/reflect" aria-label="Ask Lasso" onClick={dismissHint} className={FAB_CLASS}>
          {label}
        </Link>
      )}
    </>
  );
}

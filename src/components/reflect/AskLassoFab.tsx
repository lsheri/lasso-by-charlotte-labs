import { Link, useRouterState } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

import { useAskLassoHandler } from "@/components/reflect/ask-lasso-context";

const FAB_CLASS =
  "fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30 inline-flex min-h-[56px] items-center gap-2 rounded-full border border-accent-deep/30 bg-accent-deep px-5 font-mono text-[12px] uppercase tracking-[0.08em] text-accent-foreground shadow-card transition-opacity hover:opacity-90 md:hidden print:hidden";

/**
 * On phones the thumb zone belongs to the thing people reach for most, so Ask
 * Lasso sits bottom right and feedback moves up into the header. Where the page
 * has its own Ask Lasso context, this opens that dock instead of navigating.
 */
export function AskLassoFab() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const handler = useAskLassoHandler();
  if (path.startsWith("/reflect")) return null;

  if (handler) {
    return (
      <button type="button" onClick={handler} aria-label="Ask Lasso" className={FAB_CLASS}>
        <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
        Ask Lasso
      </button>
    );
  }

  return (
    <Link to="/reflect" aria-label="Ask Lasso" className={FAB_CLASS}>
      <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
      Ask Lasso
    </Link>
  );
}

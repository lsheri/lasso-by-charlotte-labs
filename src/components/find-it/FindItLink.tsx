import { Link } from "@tanstack/react-router";

import { LassoLoopMark } from "@/components/layout/LassoLoopMark";

/** One name for this way in, wherever it is offered. */
export const FIND_IT_LINK_LABEL = "What fed this?";

/**
 * The quiet way into Find it from a finished piece of work. A handwritten
 * link, never a button: it is a low stakes escape to another page, and the
 * loud action on those surfaces belongs to something else.
 *
 * Visible on focus as well as on hover, so a keyboard finds it too.
 */
export function FindItLink({
  workItemId,
  className = "",
  revealOnHover = false,
}: {
  workItemId: string;
  className?: string;
  revealOnHover?: boolean;
}) {
  return (
    <Link
      to="/find-it"
      search={{ target: workItemId, entry: "peek" as const }}
      className={`inline-flex items-center gap-1.5 font-hand text-[16px] text-green underline underline-offset-2 ${
        revealOnHover
          ? "opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
          : ""
      } ${className}`}
    >
      <LassoLoopMark className="h-4 w-4 text-lasso-green" />
      <span>{FIND_IT_LINK_LABEL}</span>
    </Link>
  );
}

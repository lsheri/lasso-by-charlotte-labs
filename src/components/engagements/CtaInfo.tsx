import type { ReactNode } from "react";

/**
 * Pass 115: the small "i" that both pencil heroes carry. It lives inside the
 * button visually but is never a button element itself, because a button
 * inside a button is invalid and unreachable for a keyboard.
 */
export function CtaInfoTrigger({
  open,
  onToggle,
  label = "How this works",
}: {
  open: boolean;
  onToggle: () => void;
  label?: string;
}) {
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={label}
      title={label}
      aria-expanded={open}
      data-testid="cta-info-trigger"
      className="nb-cta-info"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
    >
      i
    </span>
  );
}

/** The panel the trigger opens, a sibling of the button and never inside it. */
export function CtaInfoPopover({ children }: { children: ReactNode }) {
  return (
    <div
      role="note"
      className="absolute right-0 top-full z-20 mt-2 w-72 rounded-[var(--radius-md)] border border-border bg-card px-3 py-2 text-xs leading-relaxed text-muted-foreground shadow-sm"
    >
      {children}
    </div>
  );
}

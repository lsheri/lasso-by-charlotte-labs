import { Button } from "@/components/ui/button";

/** A small graphite squiggle that lands under the map label. */
function MapPencilMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`pointer-events-none ${className}`}
      width="28"
      height="6"
      viewBox="0 0 28 6"
      fill="none"
      stroke="var(--nb-graphite)"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1 3.4c5.2.8 10.4-1.2 15.6-.4 4.4.7 8.4 1.2 11-.6" />
    </svg>
  );
}

/**
 * The primary map action: filled green, with a notebook graphite pencil mark
 * under the label so it is never mistaken for a secondary link.
 */
export function MapButton({
  children,
  onClick,
  stopPropagation = false,
  disabled = false,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  stopPropagation?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Button
      type="button"
      size="sm"
      disabled={disabled}
      onClick={(event) => {
        if (stopPropagation) event.stopPropagation();
        onClick();
      }}
      className={`nb-map-cta relative inline-flex h-9 items-center gap-1 rounded-full px-3.5 text-[11px] font-medium uppercase tracking-[0.08em] ${className}`}
    >
      <span className="relative z-10 flex flex-col items-center leading-none">
        <span>{children}</span>
        <MapPencilMark className="-mb-1 mt-0.5" />
      </span>
    </Button>
  );
}

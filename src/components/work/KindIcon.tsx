import { deliverableGlyph, type DeliverableGlyph } from "@/lib/deliverable-kinds";
import { cn } from "@/lib/utils";

/**
 * Pass 139: one small kind glyph per shipped card, drawn in graphite with a
 * single accent stroke per kind. Existing tokens only, never red.
 */
const ACCENT: Record<DeliverableGlyph, string> = {
  document: "var(--nb-graphite)",
  deck: "var(--nb-green)",
  sheet: "var(--nb-ink-yellow)",
  envelope: "var(--nb-green)",
  code: "var(--nb-ink-yellow)",
  pen: "var(--nb-green)",
};

/** Each glyph: graphite paths first, exactly one accent path last. */
const GLYPH_PATHS: Record<DeliverableGlyph, { base: string[]; accent: string }> = {
  document: {
    base: ["M5.5 3.5h6l3 3v10h-9z", "M11.5 3.5v3h3", "M7.5 10h5"],
    accent: "M7.5 12.8h3.6",
  },
  deck: {
    base: ["M3.8 4.6h12.4v8.6H3.8z", "M10 13.2v2.4", "M7.2 15.6h5.6"],
    accent: "M6 7.4h5.2",
  },
  sheet: {
    base: ["M4.2 4h11.6v12H4.2z", "M4.2 8h11.6", "M4.2 12h11.6", "M9 4v12"],
    accent: "M11.4 13.4h2.6",
  },
  envelope: {
    base: ["M3.6 5.4h12.8v9.2H3.6z"],
    accent: "M3.8 5.8L10 10.8l6.2-5",
  },
  code: {
    base: ["M7.2 6.4L3.8 10l3.4 3.6", "M12.8 6.4l3.4 3.6-3.4 3.6"],
    accent: "M11 4.6l-2 10.8",
  },
  pen: {
    base: ["M4.4 15.6l.7-2.8 7.6-7.6 2.1 2.1-7.6 7.6z", "M12 5.9l2.1 2.1"],
    accent: "M4.9 15.1l1.2.3",
  },
};

export function KindGlyph({
  glyph,
  size = 14,
  className,
}: {
  glyph: DeliverableGlyph;
  size?: number;
  className?: string;
}) {
  const def = GLYPH_PATHS[glyph];
  return (
    <svg
      data-testid={`kind-glyph-${glyph}`}
      data-glyph={glyph}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="var(--nb-graphite)"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      {def.base.map((d) => (
        <path key={d} d={d} />
      ))}
      <path d={def.accent} stroke={ACCENT[glyph]} />
    </svg>
  );
}

/** The glyph for a piece of work: deliverable kind first, type as fallback. */
export function KindIcon({
  meta,
  type,
  size = 14,
  className,
}: {
  meta: unknown;
  type: string | null | undefined;
  size?: number;
  className?: string;
}) {
  return <KindGlyph glyph={deliverableGlyph(meta, type)} size={size} className={className} />;
}

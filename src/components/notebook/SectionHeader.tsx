import type { ReactNode } from "react";

/**
 * Figma SectionHeader (10:49). Sections inside a page are handwritten; the page
 * title itself is Instrument Serif. Never both on one line.
 * Optional action sits right-aligned on the baseline, as a quiet link.
 */
export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <h2 className="section-title">{title}</h2>
      {action ?? null}
    </div>
  );
}

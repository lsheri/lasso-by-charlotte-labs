import { useEffect, useState } from "react";

import { measureAnchor, type AnchorBox as Box } from "./measure-anchor";

function same(a: Box | null, b: Box | null): boolean {
  if (!a || !b) return a === b;
  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;
}

/**
 * An outline around the real surface a beat points at, found by the test id the surface already carries, so the
 * story adds nothing to the surfaces it describes. Decoration only: it takes no clicks, is hidden from assistive
 * technology, and draws nothing when the surface is not on the page or a dialog is open over it.
 */
export function FirmStorySpotlight({ anchor }: { anchor: string }) {
  const [box, setBox] = useState<Box | null>(null);

  useEffect(() => {
    const read = () => setBox((current) => {
      const next = measureAnchor(anchor);
      return same(current, next) ? current : next;
    });
    read();
    // The surface can arrive late (a lazy page) and move (a loading answer), so keep looking while the beat is up.
    const timer = window.setInterval(read, 300);
    window.addEventListener("scroll", read, true);
    window.addEventListener("resize", read);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("scroll", read, true);
      window.removeEventListener("resize", read);
    };
  }, [anchor]);

  if (!box) return null;
  return (
    <div
      aria-hidden="true"
      data-testid="firm-story-spotlight"
      data-story-anchor={anchor}
      className="pointer-events-none fixed z-(--layer-ledger) rounded-[var(--radius)] border-2 border-primary print:hidden"
      style={{ top: box.top - 4, left: box.left - 4, width: box.width + 8, height: box.height + 8 }}
    />
  );
}

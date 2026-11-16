import { useEffect, useState, type ReactNode } from "react";

/** How long a folder takes to roll open or shut. Matches .nb-roll in styles.css. */
export const ROLL_MS = 200;

function reducedMotion(): boolean {
  // No matchMedia (tests, old browsers) means no motion: the content simply appears and goes.
  return typeof window === "undefined" || typeof window.matchMedia !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * A folder's contents rolling down when it opens and up when it closes (Liam, 15 Nov). The children stay mounted
 * only while rolling shut, then leave the DOM exactly as a closed folder did before. Reduced motion skips the roll.
 */
export function RollDown({ open, children }: { open: boolean; children: ReactNode }) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(open);

  useEffect(() => {
    if (reducedMotion()) {
      setMounted(open);
      setShown(open);
      return;
    }
    if (open) {
      setMounted(true);
      // One frame closed, then open, so the height has somewhere to roll from.
      const frame = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(frame);
    }
    setShown(false);
    const timer = window.setTimeout(() => setMounted(false), ROLL_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!mounted) return null;
  return (
    <div className="nb-roll" data-open={shown ? "true" : "false"}>
      <div className="nb-roll-inner">{children}</div>
    </div>
  );
}

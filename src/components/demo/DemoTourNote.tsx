import { useEffect, useLayoutEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { useReducedMotion } from "@/hooks/use-motion";

type NotePosition = { left: number; top: number; placement: "above" | "below" };

export function DemoTourNote({
  step,
  anchorTestId,
  children,
  onDismiss,
  final = false,
}: {
  step: number;
  anchorTestId: string;
  children: string;
  onDismiss: () => void;
  final?: boolean;
}) {
  const reduced = useReducedMotion();
  const [position, setPosition] = useState<NotePosition | null>(null);

  useLayoutEffect(() => {
    let frame = 0;
    const place = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const anchor = document.querySelector<HTMLElement>(`[data-testid="${anchorTestId}"]`);
        if (!anchor) return setPosition(null);
        const rect = anchor.getBoundingClientRect();
        const width = Math.min(286, window.innerWidth - 24);
        const height = 92;
        const gap = 12;
        const placement = rect.top >= height + gap + 12 ? "above" : "below";
        const top = placement === "above" ? rect.top - height - gap : rect.bottom + gap;
        const left = Math.max(12, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 12));
        setPosition({ left, top: Math.max(12, Math.min(top, window.innerHeight - height - 12)), placement });
      });
    };
    place();
    const observer = new MutationObserver(place);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-turn-focus", "aria-expanded"] });
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchorTestId]);

  useEffect(() => {
    if (!position) return;
    document.querySelector<HTMLElement>(`[data-testid="${anchorTestId}"]`)?.setAttribute("data-demo-tour-anchor", "true");
    return () => document.querySelector<HTMLElement>(`[data-testid="${anchorTestId}"]`)?.removeAttribute("data-demo-tour-anchor");
  }, [anchorTestId, position]);

  if (!position || typeof document === "undefined") return null;
  return createPortal(
    <aside
      data-testid={`demo-tour-note-${step}`}
      data-placement={position.placement}
      data-reduced-motion={reduced ? "true" : "false"}
      className="demo-tour-note"
      style={{ "--demo-note-left": `${position.left}px`, "--demo-note-top": `${position.top}px` } as CSSProperties}
      aria-label={`Demo guide step ${step}`}
    >
      <svg className="demo-tour-note-mark" viewBox="0 0 34 28" aria-hidden>
        <path d="M2 3c8 1 17 5 22 13m0 0-9-2m9 2-3-9" />
      </svg>
      <p>{children}</p>
      <Button type="button" variant="link" className="demo-tour-note-skip" onClick={onDismiss}>
        {final ? "Done" : "Skip the tour"}
      </Button>
    </aside>,
    document.body,
  );
}

import { useLayoutEffect, useRef, type RefObject } from "react";

const EASE = "cubic-bezier(.45,0,.2,1)";

/**
 * 20 Nov 2026 (Liam, D-86, fluid-flow-design): when a proposal changes place (sent, so it moves down; Up next, so it
 * rises), the row travels there as one object instead of jumping. Distance sets the time, about 0.85px a millisecond,
 * between 420ms and 1200ms. A row that is new to the list fades up into place. Reduced motion, or a browser with no
 * Web Animations, gets the end state at once.
 */
export function useRowFlip(ref: RefObject<HTMLElement | null>) {
  const last = useRef(new Map<string, { left: number; top: number }>());
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const seen = last.current.size > 0;
    const next = new Map<string, { left: number; top: number }>();
    root.querySelectorAll<HTMLElement>(":scope > [data-proposal-row]").forEach((el) => {
      const id = el.dataset["proposalRow"] ?? "";
      const box = el.getBoundingClientRect();
      next.set(id, { left: box.left, top: box.top });
      if (reduce || typeof el.animate !== "function") return;
      const before = last.current.get(id);
      if (before) {
        const dx = before.left - box.left;
        const dy = before.top - box.top;
        const distance = Math.hypot(dx, dy);
        if (distance > 1) el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: Math.min(1200, Math.max(420, distance / 0.85)), easing: EASE });
      } else if (seen) {
        el.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 520, easing: EASE });
      }
    });
    last.current = next;
  });
}

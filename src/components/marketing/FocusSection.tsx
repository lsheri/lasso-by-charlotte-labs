import { useEffect, useRef, useState } from "react";

/**
 * Marketing-only scroll focus. The section closest to the vertical centre of
 * the viewport stays crisp, everything else fades and softens. Disabled under
 * prefers-reduced-motion and on small screens (handled in CSS).
 */
export function FocusSection({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [active, setActive] = useState(true);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const evaluate = () => {
      const rect = node.getBoundingClientRect();
      const centre = window.innerHeight / 2;
      // Narrow band: only the section crossing the middle of the screen stays crisp.
      const band = window.innerHeight * 0.12;
      const inFocus = rect.top < centre + band && rect.bottom > centre - band;
      setActive(inFocus);
    };


    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        evaluate();
      });
    };

    evaluate();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <section ref={ref} className={`focus-section ${active ? "" : "focus-section-dim"} ${className}`}>
      {children}
    </section>
  );
}

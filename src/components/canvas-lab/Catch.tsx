import { useEffect, useRef, useState } from "react";

export const CATCH_PATH = "M206 9C180 2 96 1 46 7 11 11 4 24 20 31c20 9 112 10 164 2 34-5 52-14 40-22-9-6-33-9-62-9-9 0-14 1-18 3";

/** Arrival decoration; completion releases the session-only marker. */
export function Catch({ shown = true, onComplete }: { shown?: boolean; onComplete?: () => void }) {
  const [phase, setPhase] = useState<"ready" | "drawn" | "leaving">("ready");
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  useEffect(() => {
    if (!shown) return;
    setPhase("ready");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let hold = 0;
    let finish = 0;
    const draw = () => {
      setPhase("drawn");
      hold = window.setTimeout(() => setPhase("leaving"), (reduced ? 0 : 900) + 300);
      finish = window.setTimeout(() => completeRef.current?.(), (reduced ? 0 : 900) + 480);
    };
    if (reduced) draw();
    else frame = window.requestAnimationFrame(() => { frame = window.requestAnimationFrame(draw); });
    return () => { window.cancelAnimationFrame(frame); window.clearTimeout(hold); window.clearTimeout(finish); };
  }, [shown]);
  if (!shown) return null;
  return <svg aria-hidden="true" className="canvas-lab-catch" data-phase={phase} viewBox="0 0 240 40" preserveAspectRatio="none" fill="none">
    <path d={CATCH_PATH} pathLength={1} strokeWidth={2.6} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
  </svg>;
}

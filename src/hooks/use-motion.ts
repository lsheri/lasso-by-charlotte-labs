import { useEffect, useState } from "react";

import {
  type MotionEventName,
  type ResolvedMotion,
  prefersReducedMotion,
  resolveMotion,
} from "@/lib/motion-registry";

/**
 * Whether the reader asked for less movement. Read after hydration so the
 * server and the first client render agree.
 */
export function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return;
    setReduce(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduce(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduce;
}

/**
 * Name an event, get back what should play and the words that stand in for it
 * when nothing moves. A surface never names an animation.
 */
export function useMotion(event: MotionEventName): ResolvedMotion {
  const reduce = useReducedMotion();
  return resolveMotion(event, reduce);
}

export { prefersReducedMotion };

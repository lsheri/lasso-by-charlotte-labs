import { useCallback, useState } from "react";

import { noteDemoStepCompleted, noteDemoTourSkipped } from "@/lib/demo-telemetry";

const STORAGE_KEY = "lasso.demo.tour.step.v1";
export const DEMO_TOUR_DONE = 8;

function readStep(): number {
  if (typeof window === "undefined") return 1;
  try {
    const stored = Number(window.sessionStorage.getItem(STORAGE_KEY));
    return Number.isInteger(stored) && stored >= 1 && stored <= DEMO_TOUR_DONE ? stored : 1;
  } catch {
    return 1;
  }
}

function writeStep(step: number): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, String(step));
  } catch {
    // The demo remains usable when storage is blocked. A later mount restarts the notes.
  }
}

export function useDemoTour() {
  const [step, setStep] = useState(readStep);

  const complete = useCallback((expected: number, engagement: string) => {
    setStep((current) => {
      if (current !== expected) return current;
      const next = expected >= 7 ? DEMO_TOUR_DONE : expected + 1;
      writeStep(next);
      noteDemoStepCompleted(expected, engagement);
      return next;
    });
  }, []);

  const skipMissing = useCallback((expected: number) => {
    setStep((current) => {
      if (current !== expected) return current;
      const next = expected >= 7 ? DEMO_TOUR_DONE : expected + 1;
      writeStep(next);
      return next;
    });
  }, []);

  const dismiss = useCallback(() => {
    setStep((current) => {
      if (current >= DEMO_TOUR_DONE) return current;
      writeStep(DEMO_TOUR_DONE);
      noteDemoTourSkipped(current);
      return DEMO_TOUR_DONE;
    });
  }, []);

  return { step, complete, skipMissing, dismiss };
}

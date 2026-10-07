import { useCallback, useEffect, useRef, useState } from "react";

import { useTourActRenderers } from "@/components/tour/TourActs";
import { TourStage } from "@/components/tour/TourStage";
import { noteAnonymousTourEvent } from "@/lib/demo-telemetry";
import type { Register } from "@/lib/register";
import { logEvent } from "@/lib/telemetry";
import type { TourActId } from "@/lib/tour-content";

/**
 * TV5: the eight-act first-run tour as the onboarding step. TV4: the only
 * place the tour.* family is emitted. Dims are the act number and the closed
 * register, nothing else, ever.
 */
export function OnboardingTour({
  register,
  orgId,
  onDone,
  startAct = 1,
}: {
  register: Register;
  /** The person's workspace; events wait until it is known. */
  orgId: string | null;
  /** The route's existing completion path, used by both finish and skip. */
  onDone: () => void;
  /** Test seam only; onboarding always opens on act 1. */
  startAct?: TourActId;
}) {
  const [activeAct, setActiveAct] = useState<TourActId>(startAct);
  const orgRef = useRef(orgId);
  orgRef.current = orgId;
  const emit = useCallback(
    (
      event: "tour.started" | "tour.step_done" | "tour.step_continued" | "tour.skipped" | "tour.finished",
      dims: { step?: number },
    ) => {
      const org = orgRef.current;
      // TL1: signed in, the canonical org-scoped path, unchanged. Signed out
      // (the public landing How it works section), the same event and dims go
      // down the anonymous path the landing demo already uses.
      // TM1: one extra dim, derived from the same org the branch checks, so
      // the signed-in and landing populations never mix in one funnel.
      const surface = org ? "onboarding" : "landing";
      if (org) {
        logEvent(event, org, { ...dims, register, surface });
      } else {
        noteAnonymousTourEvent(event, { ...dims, register, surface });
      }
    },
    [register],
  );

  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    emit("tour.started", {});
  }, [emit]);

  const back = useCallback(() => setActiveAct((current) => Math.max(1, current - 1) as TourActId), []);
  const advance = useCallback(
    (act: TourActId) => {
      emit("tour.step_continued", { step: act });
      setActiveAct((act + 1) as TourActId);
    },
    [emit],
  );
  const finish = useCallback(() => {
    emit("tour.finished", {});
    onDone();
  }, [emit, onDone]);
  const skip = useCallback(() => {
    emit("tour.skipped", { step: activeAct });
    onDone();
  }, [emit, onDone, activeAct]);

  const { renderers, instructionOverride, hint } = useTourActRenderers({
    register,
    activeAct,
    onAdvance: advance,
    onHintShown: () => undefined,
    onFinish: finish,
  });

  // step_done fires the moment an act with an action completes, which is when its callout appears.
  const current = renderers.find((r) => r.id === activeAct);
  const doneNow = Boolean(current?.complete && current.hasAction !== false);
  const reported = useRef<number | null>(null);
  useEffect(() => {
    reported.current = null;
  }, [activeAct]);
  useEffect(() => {
    if (!doneNow || reported.current === activeAct) return;
    reported.current = activeAct;
    emit("tour.step_done", { step: activeAct });
  }, [doneNow, activeAct, emit]);

  return (
    <TourStage
      register={register}
      activeAct={activeAct}
      acts={renderers}
      onSkip={skip}
      onBack={back}
      onHintShown={hint}
      instructionOverride={instructionOverride}
    />
  );
}

import { useEffect, useState, type ReactNode } from "react";

import { DrawnCheck, GraphiteRule } from "@/components/notebook/marks";
import { Button } from "@/components/ui/button";
import { TOUR_CONTENT } from "@/lib/tour-content";
import type { Register } from "@/lib/register";

export type TourActRenderer = {
  content: ReactNode;
  primaryAction?: ReactNode;
};

type TourStageProps = {
  register: Register;
  activeAct: 1 | 2 | 3 | 4 | 5;
  acts: readonly TourActRenderer[];
  onSkip: () => void;
  onBack: () => void;
  onHintShown: (act: number) => void;
};

function useTouchPresentation(): boolean {
  const [touch, setTouch] = useState(false);

  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)");
    const narrow = window.matchMedia("(max-width: 767px)");
    const update = () => setTouch(coarse.matches || narrow.matches);
    update();
    coarse.addEventListener("change", update);
    narrow.addEventListener("change", update);
    return () => {
      coarse.removeEventListener("change", update);
      narrow.removeEventListener("change", update);
    };
  }, []);

  return touch;
}

/**
 * Act contract: acts own their focused keyboard controls and must provide a
 * keyboard equivalent for every gesture. The stage reserves Escape and
 * Backspace for its surrounding navigation.
 */
export function TourStage({
  register,
  activeAct,
  acts,
  onSkip,
  onBack,
  onHintShown,
}: TourStageProps) {
  const copy = TOUR_CONTENT[register];
  const touch = useTouchPresentation();
  const act = copy.acts[activeAct - 1];
  const renderer = acts[activeAct - 1];

  useEffect(() => {
    const timer = window.setTimeout(() => onHintShown(activeAct), 8000);
    return () => window.clearTimeout(timer);
  }, [activeAct, onHintShown]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onSkip();
      }
      if (event.key === "Backspace" && activeAct > 1) {
        event.preventDefault();
        onBack();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeAct, onBack, onSkip]);

  if (!act || !renderer) return null;

  return (
    <section className="tour-shell" aria-label={copy.stage.stageLabel} data-act={activeAct}>
      <div className="tour-stage">
        <header className="tour-stage-header">
          <nav className="tour-rail" aria-label={copy.stage.railLabel}>
            {copy.acts.map((item, index) => {
              const state = item.id < activeAct ? "complete" : item.id === activeAct ? "current" : "future";
              return (
                <div className="tour-rail-segment" data-state={state} key={item.id}>
                  <span className="tour-rail-mark" aria-current={state === "current" ? "step" : undefined}>
                    {state === "complete" ? <DrawnCheck persistent size={22} /> : item.id}
                  </span>
                  {index < copy.acts.length - 1 ? (
                    <GraphiteRule className="tour-rail-line" animated={state === "complete"} />
                  ) : null}
                </div>
              );
            })}
          </nav>
          <Button type="button" variant="ghost" className="tour-skip nb-pencil-cta" onClick={onSkip}>
            {copy.stage.skip}
          </Button>
        </header>

        <div className="tour-act" data-testid="tour-act">
          {renderer.content}
        </div>

        <footer className="tour-stage-actions">
          {activeAct > 1 ? (
            <Button type="button" variant="ghost" className="tour-back nb-pencil-cta" onClick={onBack}>
              {copy.stage.back}
            </Button>
          ) : (
            <span />
          )}
          <div className="tour-primary-action">{renderer.primaryAction}</div>
        </footer>
      </div>

      <p className="tour-caption" title={touch ? act.captionTouch : act.captionPointer}>
        {touch ? act.captionTouch : act.captionPointer}
      </p>
    </section>
  );
}
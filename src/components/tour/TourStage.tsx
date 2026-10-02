import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

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
  instructionOverride?: string | null;
};

function TourInstructionArrow({ stage, activeAct }: { stage: React.RefObject<HTMLElement | null>; activeAct: number }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useLayoutEffect(() => {
    const root = stage.current;
    const svg = svgRef.current;
    if (!root || !svg) return;
    let frame = 0;
    let observer: ResizeObserver | null = null;
    const draw = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const instruction = root.querySelector<HTMLElement>("[data-tour-do]");
        const target = root.querySelector<HTMLElement>(`[data-tour-target="${activeAct}"]`);
        if (!instruction || !target) { svg.hidden = true; return; }
        const base = root.getBoundingClientRect();
        const from = instruction.getBoundingClientRect();
        const to = target.getBoundingClientRect();
        const sx = Math.min(from.right - base.left + 18, base.width - 28);
        const sy = from.bottom - base.top + 4;
        const ex = to.left - base.left + to.width / 2;
        const ey = to.top - base.top + Math.min(to.height / 2, 22);
        const bend = Math.max(28, Math.abs(ey - sy) * 0.42);
        const line = `M ${sx} ${sy} C ${sx + 10} ${sy + bend}, ${ex - 18} ${ey - bend}, ${ex} ${ey}`;
        svg.hidden = false;
        svg.setAttribute("viewBox", `0 0 ${base.width} ${base.height}`);
        const paths = svg.querySelectorAll("path");
        paths[0]?.setAttribute("d", line);
        paths[1]?.setAttribute("d", `M ${ex} ${ey} l -11 -3`);
        paths[2]?.setAttribute("d", `M ${ex} ${ey} l -4 -10`);
      });
    };
    draw();
    const mutation = new MutationObserver(draw);
    const actSurface = root.querySelector<HTMLElement>("[data-testid='tour-act']");
    if (actSurface) mutation.observe(actSurface, { childList: true, subtree: true });
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(draw);
      observer.observe(root);
    }
    window.addEventListener("resize", draw);
    return () => {
      window.cancelAnimationFrame(frame);
      mutation.disconnect();
      observer?.disconnect();
      window.removeEventListener("resize", draw);
    };
  }, [activeAct, stage]);

  return (
    <svg ref={svgRef} className="tour-instruction-arrow" viewBox="0 0 1 1" aria-hidden hidden>
      <path pathLength={1} />
      <path pathLength={1} />
      <path pathLength={1} />
    </svg>
  );
}

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
  instructionOverride,
}: TourStageProps) {
  const copy = TOUR_CONTENT[register];
  const touch = useTouchPresentation();
  const act = copy.acts[activeAct - 1];
  const renderer = acts[activeAct - 1];
  const hintedActs = useRef(new Set<number>());
  const stageRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (hintedActs.current.has(activeAct)) return;
      hintedActs.current.add(activeAct);
      onHintShown(activeAct);
    }, 8000);
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
      <section ref={stageRef} className="tour-stage">
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

        <div className={`tour-instruction-band${instructionOverride ? " is-complete" : ""}`}>
          <span className="tour-step-marker">Step {activeAct} of 5</span>
          <p className="tour-do-line" data-tour-do>{instructionOverride ?? (touch ? act.captionTouch : act.captionPointer)}</p>
          <p className="tour-why-line">{act.why}</p>
        </div>

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
        <TourInstructionArrow stage={stageRef} activeAct={activeAct} />
      </section>
    </section>
  );
}
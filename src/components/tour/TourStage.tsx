import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { TourTeachBeatContext } from "@/components/tour/tour-beat";

import { DrawnCheck, GraphiteRule } from "@/components/notebook/marks";
import { Button } from "@/components/ui/button";
import { TOUR_CONTENT, actById, type TourActId } from "@/lib/tour-content";
import type { Register } from "@/lib/register";

export type TourActRenderer = {
  id: TourActId;
  content: ReactNode;
  primaryAction?: ReactNode;
};

type TourStageProps = {
  register: Register;
  activeAct: TourActId;
  acts: readonly TourActRenderer[];
  onSkip: () => void;
  onBack: () => void;
  onHintShown: (act: number) => void;
  instructionOverride?: string | null;
};

type ArrowPath = { width: number; height: number; line: string; headA: string; headB: string };

type RectLike = Pick<DOMRect, "left" | "top" | "right" | "bottom" | "width" | "height">;

/** Gap kept between the arrow tip and a target it must not cover. */
export const ARROW_EDGE_GAP = 8;

/**
 * Where the arrow tip lands. Acts 1 and 2 point at a control with text on it,
 * so the tip stops just outside the target's left edge instead of its centre.
 * Every later act keeps its original centre aim.
 */
export function arrowEnd(activeAct: number, _from: RectLike, to: RectLike, base: RectLike): { x: number; y: number } {
  if (activeAct <= 2) {
    return { x: to.left - base.left - ARROW_EDGE_GAP, y: to.top - base.top + to.height / 2 };
  }
  return { x: to.left - base.left + to.width / 2, y: to.top - base.top + Math.min(to.height / 2, 22) };
}

function TourInstructionArrow({ stage, activeAct }: { stage: React.RefObject<HTMLElement | null>; activeAct: number }) {
  const [path, setPath] = useState<ArrowPath | null>(null);

  useEffect(() => {
    const root = stage.current;
    // Act 8's target is the finish button in the footer; an arrow would cross the slide, so only the glow remains.
    if (!root || activeAct === 8) { setPath(null); return; }
    let frame = 0;
    let observer: ResizeObserver | null = null;
    const draw = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const instruction = root.querySelector<HTMLElement>("[data-tour-do]");
        const target = root.querySelector<HTMLElement>(`[data-tour-target="${activeAct}"]`);
        if (!instruction || !target) { setPath(null); return; }
        const base = root.getBoundingClientRect();
        const from = instruction.getBoundingClientRect();
        const to = target.getBoundingClientRect();
        const sx = Math.min(from.right - base.left + 18, base.width - 28);
        const sy = from.bottom - base.top + 4;
        const end = arrowEnd(activeAct, from, to, base);
        const ex = end.x;
        const ey = end.y;
        const bend = Math.max(28, Math.abs(ey - sy) * 0.42);
        const line = `M ${sx} ${sy} C ${sx + 10} ${sy + bend}, ${ex - 18} ${ey - bend}, ${ex} ${ey}`;
        setPath({
          width: base.width,
          height: base.height,
          line,
          headA: `M ${ex} ${ey} l -11 -3`,
          headB: `M ${ex} ${ey} l -4 -10`,
        });
      });
    };
    draw();
    const mutation = new MutationObserver(draw);
    mutation.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-tour-target"] });
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

  if (!path) return null;
  return (
    <svg className="tour-instruction-arrow" viewBox={`0 0 ${path.width} ${path.height}`} aria-hidden>
      <path pathLength={1} d={path.line} />
      <path pathLength={1} d={path.headA} />
      <path pathLength={1} d={path.headB} />
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
  const act = actById(register, activeAct);
  const renderer = acts.find((item) => item.id === activeAct);
  const hintedActs = useRef(new Set<number>());
  const stageRef = useRef<HTMLElement>(null);
  const gotItRef = useRef<HTMLButtonElement>(null);
  // Acts already read stay read for the life of the tour, so Back never re-gates them.
  const [readActs, setReadActs] = useState<ReadonlySet<number>>(() => new Set());
  const teaching = !readActs.has(activeAct);
  const dismissTeach = useCallback(() => {
    setReadActs((current) => (current.has(activeAct) ? current : new Set(current).add(activeAct)));
  }, [activeAct]);

  useEffect(() => {
    if (teaching) gotItRef.current?.focus();
  }, [teaching, activeAct]);

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
      if (teaching) {
        if (event.key === "Enter" || event.key === " " || event.key === "Escape") {
          event.preventDefault();
          dismissTeach();
        }
        return;
      }
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
  }, [activeAct, onBack, onSkip, teaching, dismissTeach]);

  if (!act || !renderer) return null;

  return (
    <section className="tour-shell" aria-label={copy.stage.stageLabel} data-act={activeAct}>
      <section ref={stageRef} className="tour-stage" data-beat={teaching ? "teach" : "do"}>
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
          <span className="tour-step-marker">Step {activeAct} of {copy.acts.length}</span>
          <p className="tour-do-line" data-tour-do>{instructionOverride ?? (touch ? act.captionTouch : act.captionPointer)}</p>
        </div>

        {teaching ? <div className="tour-teach-scrim" data-testid="tour-teach-scrim" aria-hidden onClick={dismissTeach} /> : null}

        <aside className={`tour-teaching-callout${teaching ? " is-teaching" : ""}`}>
          <p>{act.why}</p>
          {teaching ? (
            <Button ref={gotItRef} type="button" variant="ink" size="sm" className="tour-got-it" onClick={dismissTeach}>
              {copy.stage.gotIt}
            </Button>
          ) : null}
        </aside>

        <TourTeachBeatContext.Provider value={teaching}>
          <div className="tour-act" data-testid="tour-act" data-tour-beat={teaching ? "teach" : "do"} inert={teaching}>
            {renderer.content}
          </div>
        </TourTeachBeatContext.Provider>

        <footer className="tour-stage-actions" data-tour-beat={teaching ? "teach" : "do"} inert={teaching}>
          {activeAct > 1 ? (
            <Button type="button" variant="ghost" className="tour-back nb-pencil-cta" onClick={onBack}>
              {copy.stage.back}
            </Button>
          ) : (
            <span />
          )}
          <div className="tour-primary-action">{renderer.primaryAction}</div>
        </footer>
        {teaching ? null : <TourInstructionArrow stage={stageRef} activeAct={activeAct} />}
      </section>
    </section>
  );
}
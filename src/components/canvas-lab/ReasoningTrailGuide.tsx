import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { BOARD_GUIDE_RECTS, REASONING_STEPS, type LabJudgmentType, type LabTemplateKind, JUDGMENT_TYPES } from "@/components/canvas-lab/canvas-lab-model";
import { Button } from "@/components/ui/button";

/**
 * The trail panel. On a seeded board it is the fixed guide it has always been.
 * On a blank board a person adds it, so it is given a place of its own, a
 * handle to move it by, and a way to take it off again.
 */
export function ReasoningTrailGuide({ onAdd, rect: placed, onHandlePointerDown, onRemove }: {
  onAdd: (kind: LabTemplateKind, judgment?: LabJudgmentType) => void;
  rect?: { x: number; y: number; width: number; height: number } | undefined;
  onHandlePointerDown?: ((event: React.PointerEvent) => void) | undefined;
  onRemove?: (() => void) | undefined;
}) {
  const [judgmentOpen, setJudgmentOpen] = useState(false);
  const judgmentRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!judgmentOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!judgmentRef.current?.contains(event.target as Node)) setJudgmentOpen(false);
    };
    window.addEventListener("pointerdown", closeOutside);
    return () => window.removeEventListener("pointerdown", closeOutside);
  }, [judgmentOpen]);

  function closeFromEscape(event: React.KeyboardEvent) {
    if (event.key !== "Escape" || !judgmentOpen) return;
    event.preventDefault();
    event.stopPropagation();
    setJudgmentOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  }

  // One source for where this panel sits, shared with anything placing cards.
  const rect = placed ?? BOARD_GUIDE_RECTS[0]!;
  const movable = Boolean(onHandlePointerDown);
  return (
    <section
      className="canvas-lab-guide"
      data-trail-placed={placed ? "true" : undefined}
      style={{ left: rect.x, top: rect.y, width: rect.width, minHeight: rect.height }}
      aria-labelledby="reasoning-trail-title"
      onPointerDown={movable ? onHandlePointerDown : undefined}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="reasoning-trail-title" className="font-hand text-[18px] text-[var(--nb-mid)]">Reasoning trail</h2>
        <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-soft">Guide · no links implied</span>
        {onRemove ? <Button type="button" variant="ghost" size="sm" className="h-6 px-1 text-[9px]" onPointerDown={(event) => event.stopPropagation()} onClick={onRemove}>Remove</Button> : null}
      </div>
      <div className="mt-2 grid grid-cols-5 gap-2">
        {REASONING_STEPS.map((step, index) => (
          <div key={step.kind} className="relative min-w-[124px] border border-dashed border-[var(--nb-pencil)] bg-card p-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-soft">{index + 1}</span>
            <p className="mt-1 nb-type-small font-medium text-foreground">{step.label}</p>
            {step.kind === "judgment" ? (
              <div ref={judgmentRef} className="relative mt-1" onPointerDown={(event) => event.stopPropagation()} onKeyDown={closeFromEscape}>
                <Button ref={triggerRef} type="button" variant="ghost" size="sm" className="canvas-lab-step-add h-6 px-1 text-[9px]" aria-haspopup="menu" aria-expanded={judgmentOpen} aria-label="Add Human judgment local node" onPointerDown={(event) => event.stopPropagation()} onClick={() => setJudgmentOpen((open) => !open)}><Plus className="mr-1 h-3 w-3" />Add</Button>
                {judgmentOpen ? <div role="menu" aria-label="Human judgment type" className="canvas-lab-judgment-menu absolute left-0 top-full z-20 mt-1 border border-border bg-card shadow-[var(--shadow-modal)]" onPointerDown={(event) => event.stopPropagation()}>
                  {JUDGMENT_TYPES.map((choice) => (
                    <Button key={choice.value} type="button" role="menuitem" variant="ghost" size="sm" className="canvas-lab-judgment-item w-full justify-start" onClick={() => { onAdd("judgment", choice.value); setJudgmentOpen(false); }}>{choice.label}</Button>
                  ))}
                </div> : null}
              </div>
            ) : (
              <Button type="button" variant="ghost" size="sm" className="canvas-lab-step-add mt-1 h-6 px-1 text-[9px]" aria-label={`Add ${step.label} local node`} onPointerDown={(event) => event.stopPropagation()} onClick={() => onAdd(step.kind)}><Plus className="mr-1 h-3 w-3" />Add</Button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
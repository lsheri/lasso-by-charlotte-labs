import { stableMemo } from "@/components/canvas-lab/stable-memo";
import { MoreHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MarkdownMessage } from "@/components/markdown/MarkdownMessage";
import { Button } from "@/components/ui/button";

import { answerAsOf } from "@/lib/answer-card";
import type { LabNode } from "@/components/canvas-lab/canvas-lab-model";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const COPY = { showAll: "Show all", showLess: "Show less" };

/**
 * An answer kept on the board. White face, lime edge, so it reads apart from
 * work and decisions at a glance. The date is read from the saved row.
 * It belongs to a workstream like any other card, or to none at all.
 */
function LabAnswerCardInner({
  node,
  focused,
  stackZ,
  onFocus,
  onPointerDown,
  onDelete,
  frameChoices = [],
  onMoveToFrame,
}: {
  node: LabNode;
  focused: boolean;
  stackZ: number;
  onFocus: () => void;
  onPointerDown: (event: React.PointerEvent) => void;
  onDelete: () => void;
  frameChoices?: { id: string; name: string }[];
  onMoveToFrame?: ((id: string) => void) | undefined;
}) {
  const asOf = answerAsOf(node.createdAt ?? null);
  const moveTargets = onMoveToFrame ? frameChoices.filter((frame) => frame.id !== node.frame) : [];
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const measure = () => {
      if (!expanded) setOverflows(body.scrollHeight > body.clientHeight + 1);
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(body);
    const mutations = new MutationObserver(measure);
    mutations.observe(body, { childList: true, subtree: true, characterData: true });
    return () => { resize.disconnect(); mutations.disconnect(); };
  }, [expanded, node.summary, node.width, node.height]);
  return (
    <article
      data-testid="canvas-lab-answer-card"
      tabIndex={0}
      aria-label={`Answer kept by ${node.authorName ?? "you"}`}
      onFocus={onFocus}
      onPointerDown={onPointerDown}
      data-focused={focused ? "true" : undefined}
      data-expanded={expanded ? "true" : undefined}
      className="canvas-lab-answer-card absolute overflow-hidden"
      style={{ left: node.x, top: node.y, width: node.width, height: expanded ? "auto" : node.height, minHeight: expanded ? node.height : undefined, zIndex: stackZ }}
    >
      <header className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-soft">Answer</span>
        <span className="flex items-center gap-1">
          {asOf ? <span className="font-mono text-[9px] text-soft">{asOf}</span> : null}
          {moveTargets.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Move answer"
                  className="text-soft hover:text-foreground"
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="canvas-lab-card-menu">
                {moveTargets.map((frame) => (
                  <DropdownMenuItem key={frame.id} onSelect={() => onMoveToFrame?.(frame.id)}>
                    Move to {frame.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </span>
      </header>
      <div ref={bodyRef} className="canvas-lab-answer-body" data-overflow={overflows && !expanded ? "true" : undefined}>
        <MarkdownMessage content={node.summary} />
        {overflows && !expanded ? <span className="canvas-lab-answer-fade" aria-hidden="true" data-testid="answer-body-fade" /> : null}
      </div>
      {overflows ? (
        <Button
          variant="ghost"
          className="canvas-lab-answer-toggle"
          aria-expanded={expanded}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => { event.stopPropagation(); setExpanded((value) => !value); }}
        >
          {expanded ? COPY.showLess : COPY.showAll}
        </Button>
      ) : null}
      <footer className="mt-2 flex items-center justify-between gap-2">
        <span className="font-mono text-[9px] text-soft">Kept by {node.authorName ?? "you"}</span>
        {node.local ? (
          <button
            type="button"
            onClick={onDelete}
            className="font-mono text-[9px] uppercase tracking-[0.08em] text-soft hover:text-foreground"
          >
            Remove
          </button>
        ) : null}
      </footer>
    </article>
  );
}

/** BB-3: memoized so typing in one card never re-renders its siblings. */
export const LabAnswerCard = stableMemo(LabAnswerCardInner);

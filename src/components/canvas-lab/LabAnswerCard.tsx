import { MoreHorizontal } from "lucide-react";

import { answerAsOf } from "@/lib/answer-card";
import type { LabNode } from "@/components/canvas-lab/canvas-lab-model";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * An answer kept on the board. White face, lime edge, so it reads apart from
 * work and decisions at a glance. The date is read from the saved row.
 * It belongs to a workstream like any other card, or to none at all.
 */
export function LabAnswerCard({
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
  return (
    <article
      data-testid="canvas-lab-answer-card"
      tabIndex={0}
      aria-label={`Answer kept by ${node.authorName ?? "you"}`}
      onFocus={onFocus}
      onPointerDown={onPointerDown}
      data-focused={focused ? "true" : undefined}
      className="canvas-lab-answer-card absolute overflow-hidden"
      style={{ left: node.x, top: node.y, width: node.width, height: node.height, zIndex: stackZ }}
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
      <p className="mt-2 overflow-hidden whitespace-pre-wrap text-[12px] leading-[1.5] text-foreground">
        {node.summary}
      </p>
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

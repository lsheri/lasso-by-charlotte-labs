import { answerAsOf } from "@/lib/answer-card";
import type { LabNode } from "@/components/canvas-lab/canvas-lab-model";

/**
 * An answer kept on the board. White face, lime edge, so it reads apart from
 * work and decisions at a glance. The date is read from the saved row.
 */
export function LabAnswerCard({
  node,
  focused,
  stackZ,
  onFocus,
  onPointerDown,
  onDelete,
}: {
  node: LabNode;
  focused: boolean;
  stackZ: number;
  onFocus: () => void;
  onPointerDown: (event: React.PointerEvent) => void;
  onDelete: () => void;
}) {
  const asOf = answerAsOf(node.createdAt ?? null);
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
        {asOf ? <span className="font-mono text-[9px] text-soft">{asOf}</span> : null}
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

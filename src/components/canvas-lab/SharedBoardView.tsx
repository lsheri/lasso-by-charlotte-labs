/**
 * S1: the read only board. No command path reaches this component.
 *
 * It renders what it was handed and nothing else: no handlers that write, no
 * menus, no drag, no links out of this page, and no import of the editing
 * model. Everything a person can do here is read and scroll.
 */

import {
  sharedBoardBounds,
  sharedNodeCentre,
  type SharedBoardDto,
  type SharedBoardNode,
} from "@/lib/board-share-shared";

function itemLabel(type: string): string {
  return type.replaceAll("_", " ");
}

export function SharedBoardView({ board }: { board: SharedBoardDto }) {
  const bounds = sharedBoardBounds(board.frames, board.nodes);
  const itemsById = new Map(board.items.map((item) => [item.id, item]));
  const decisionsById = new Map(board.decisions.map((decision) => [decision.id, decision]));
  const nodesById = new Map(board.nodes.map((node) => [node.id, node]));

  return (
    <div className="relative overflow-auto" data-testid="shared-board-view">
      <div className="relative" style={{ width: bounds.width, height: bounds.height }}>
        <svg
          className="pointer-events-none absolute inset-0"
          width={bounds.width}
          height={bounds.height}
          aria-hidden="true"
        >
          {board.links.map((link) => {
            const from = nodesById.get(link.fromNodeId);
            const to = nodesById.get(link.toNodeId);
            if (!from || !to) return null;
            const a = sharedNodeCentre(from);
            const b = sharedNodeCentre(to);
            return (
              <line
                key={link.id}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="var(--nb-rule)"
                strokeWidth={1.4}
              />
            );
          })}
        </svg>

        {board.frames.map((frame) => (
          <div
            key={frame.id}
            className="absolute rounded-md border border-dashed border-border"
            style={{ left: frame.x, top: frame.y, width: frame.w, height: frame.h }}
          >
            <span className="absolute -top-5 left-0 font-mono text-[9px] uppercase tracking-[0.08em] text-soft">
              {frame.label ?? frame.kind}
            </span>
          </div>
        ))}

        {board.nodes.map((node) => (
          <SharedCard
            key={node.id}
            node={node}
            item={node.workItemId ? itemsById.get(node.workItemId) : undefined}
            decision={node.decisionId ? decisionsById.get(node.decisionId) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function SharedCard({
  node,
  item,
  decision,
}: {
  node: SharedBoardNode;
  item?: { title: string; type: string; turns: { turnNo: number; role: string; content: string }[] };
  decision?: { call: string; situation: string; why: string };
}) {
  return (
    <article
      className="absolute overflow-hidden rounded-md border border-border bg-card p-3 text-[12px] text-foreground"
      style={{ left: node.x, top: node.y, width: node.w, height: node.h }}
    >
      <p className="truncate text-[12px] font-medium">{item?.title ?? node.title ?? "Untitled"}</p>
      {item ? (
        <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-soft">
          {itemLabel(item.type)}
        </p>
      ) : null}
      {node.body ? <p className="mt-1 whitespace-pre-wrap text-[11.5px] text-muted">{node.body}</p> : null}
      {decision ? (
        <div className="mt-1 space-y-1 text-[11.5px] text-muted">
          <p>{decision.situation}</p>
          <p className="text-foreground">{decision.call}</p>
          <p>{decision.why}</p>
        </div>
      ) : null}
      {item && item.turns.length > 0 ? (
        <ol className="mt-2 max-h-full space-y-2 overflow-y-auto pr-1 text-[11.5px]">
          {item.turns.map((turn) => (
            <li key={turn.turnNo}>
              <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-soft">
                {turn.role}
              </span>
              <p className="whitespace-pre-wrap text-muted">{turn.content}</p>
            </li>
          ))}
        </ol>
      ) : null}
    </article>
  );
}

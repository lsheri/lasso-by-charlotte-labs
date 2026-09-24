import { GraphiteIcon, type GraphiteIconName } from "@/components/notebook/icons";
import { cardSizeTier, ownerLabel, type LabNode } from "@/components/canvas-lab/canvas-lab-model";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<Exclude<LabNode["kind"], "work" | "task">, GraphiteIconName> = {
  brief: "engagement",
  decision: "decisions",
  chat: "messages",
  source: "attach",
  ai_work: "ai-record",
  judgment: "reflect",
  deliverable: "work",
  shape: "work",
  text: "work",
  answer: "ask-lasso",
};

function nodeIcon(node: LabNode): GraphiteIconName {
  return node.kind === "task" || node.kind === "work" ? "work" : KIND_ICON[node.kind];
}

/** The editable face for board-native notes. Imported work always uses WorkNote. */
export function LabPaper({
  node,
  selected,
  onEdit,
  onEditCommitted,
  showOwnership = true,
  onOpenTrail,
}: {
  node: LabNode;
  selected: boolean;
  onEdit: (text: string) => void;
  onEditCommitted: () => void;
  showOwnership?: boolean;
  onOpenTrail?: (() => void) | undefined;
}) {
  const tier = cardSizeTier(node);

  return (
    <div className={cn("nb-paper canvas-lab-paper", `canvas-lab-paper-${node.ownership}`)} data-tier={tier}>
      <div className="canvas-lab-paper-body">
        <div className={cn("canvas-lab-paper-header shrink-0", selected && "canvas-lab-context-header")}>
          <span className="canvas-lab-paper-source">
            <GraphiteIcon name={nodeIcon(node)} size={13} animate={false} />
            <span className="min-w-0 shrink overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">{node.typeLabel}</span>
            {node.deliverable ? <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">Deliverable</span> : null}
          </span>
          {node.linkedItemRemovedAt ? <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">Item deleted</span> : null}
          {showOwnership ? <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">{ownerLabel(node)}</span> : null}
        </div>

        <p className={cn("canvas-lab-paper-title shrink-0 font-hand text-[16px] leading-[18px] text-foreground", selected && "canvas-lab-context-title")}>{node.title}</p>

        {node.local ? (
          <textarea
            aria-label={`Edit ${node.title} note`}
            value={node.summary}
            onChange={(event) => onEdit(event.target.value)}
            onBlur={onEditCommitted}
            onPointerDown={(event) => event.stopPropagation()}
            className="canvas-lab-paper-edit min-h-0 w-full flex-1 basis-0 resize-none overflow-auto border border-[var(--nb-rule)] bg-card px-2 py-1 nb-type-small leading-[17px] text-foreground outline-none focus:border-[var(--nb-green)]"
          />
        ) : node.summary ? (
          <p className={cn("canvas-lab-paper-summary nb-type-small leading-[17px] text-muted-foreground", tier === "compact" ? "line-clamp-2" : "line-clamp-3")}>{node.summary}</p>
        ) : null}

        {selected ? <span className="mt-auto block font-hand text-[13px] leading-none text-[var(--nb-green)]">in context</span> : null}
        {node.deliverable && onOpenTrail ? (
          <button type="button" data-testid="lab-what-fed-this" aria-label={`What fed ${node.title}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onOpenTrail(); }} className={cn("mt-auto self-start font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--nb-green)] underline-offset-2 hover:underline", "opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100", selected && "opacity-100")}>What fed this</button>
        ) : null}
      </div>
    </div>
  );
}
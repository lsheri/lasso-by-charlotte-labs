import { CARD_WIDTH, type LabNode } from "@/components/canvas-lab/canvas-lab-model";
import { Button } from "@/components/ui/button";
import { WorkNote } from "@/components/work/WorkNote";
import { cn } from "@/lib/utils";
import type { WorkItemRow } from "@/lib/work-types";

const OWNER_LABEL: Record<LabNode["ownership"], string> = {
  yours: "yours",
  teammate: "teammate",
  draft: "local draft",
};

const OWNER_TONE: Record<LabNode["ownership"], string> = {
  yours: "border-[var(--nb-pencil)] bg-card",
  teammate: "border-[var(--nb-rule)] bg-[var(--nb-grey-1)]",
  draft: "border-[var(--nb-yellow-edge)] bg-[var(--nb-yellow-wash)]",
};

/**
 * One object on the board. Cards mode is a sticky summary for orientation,
 * Live opens the same card up enough to work with. The card never offers an
 * action the owner rules would refuse.
 */
export function LabCard({
  node,
  item,
  selected,
  focused,
  onSelect,
  onOpen,
  onBranch,
  onPointerDown,
  onKeyDown,
}: {
  node: LabNode;
  item?: WorkItemRow | undefined;
  selected: boolean;
  focused: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onBranch: () => void;
  onPointerDown: (event: React.PointerEvent) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      data-testid={`lab-card-${node.id}`}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      style={{ left: node.x, top: node.y, width: CARD_WIDTH }}
      className={cn(
        "absolute cursor-grab text-left transition-shadow",
        item ? "" : `canvas-lab-folded-note flex flex-col gap-1.5 rounded-[var(--radius-control)] border px-3 py-2.5 ${OWNER_TONE[node.ownership]}`,
        selected && "ring-2 ring-[var(--nb-green)]",
        focused && "outline outline-1 outline-[var(--nb-graphite)]",
      )}
    >
      {item ? (
        <WorkNote item={item} dense />
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-soft">{node.typeLabel}</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-soft">{OWNER_LABEL[node.ownership]}</span>
          </div>
          <span className="text-[13px] font-medium leading-[17px] text-foreground">{node.title}</span>
          <p className="line-clamp-3 text-[11.5px] leading-[17px] text-muted-foreground">{node.summary}</p>
        </>
      )}

      <div className="mt-1 flex flex-wrap items-center gap-1 border-t border-[var(--nb-rule)] pt-1.5">
        <Button size="sm" variant="ghost" className="h-6 px-1.5 font-mono text-[9px] uppercase tracking-[0.08em]" onClick={(event) => { event.stopPropagation(); onSelect(); }}>
          {selected ? "Remove context" : "Use as context"}
        </Button>
        <Button size="sm" variant="ghost" className="h-6 px-1.5 font-mono text-[9px] uppercase tracking-[0.08em]" onClick={(event) => { event.stopPropagation(); onOpen(); }}>
          Preview
        </Button>
        {node.ownership === "teammate" || node.kind === "chat" ? (
          <Button size="sm" variant="ghost" className="h-6 px-1.5 font-mono text-[9px] uppercase tracking-[0.08em]" onClick={(event) => { event.stopPropagation(); onBranch(); }}>
            Branch
          </Button>
        ) : null}
      </div>

      {selected ? (
        <span className="font-hand text-[13px] leading-none text-[var(--nb-green)]">
          in context
        </span>
      ) : null}
    </div>
  );
}

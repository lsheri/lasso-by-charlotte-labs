import { CARD_WIDTH, type LabNode } from "@/components/canvas-lab/canvas-lab-model";
import { cn } from "@/lib/utils";

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
  mode,
  selected,
  focused,
  onSelect,
  onOpen,
  onBranch,
  onPointerDown,
  onKeyDown,
}: {
  node: LabNode;
  mode: "cards" | "live";
  selected: boolean;
  focused: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onBranch: () => void;
  onPointerDown: (event: React.PointerEvent) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
}) {
  const live = mode === "live";
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      data-testid={`lab-card-${node.id}`}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onClick={onSelect}
      style={{ left: node.x, top: node.y, width: CARD_WIDTH }}
      className={cn(
        "absolute flex cursor-grab flex-col gap-1.5 rounded-[var(--radius-control)] border px-3 py-2.5 text-left shadow-[0_1px_0_color-mix(in_oklab,var(--nb-ink)_6%,transparent)] transition-shadow",
        OWNER_TONE[node.ownership],
        selected && "ring-2 ring-[var(--nb-green)]",
        focused && "outline outline-1 outline-[var(--nb-graphite)]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-soft">
          {node.typeLabel}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-soft">
          {node.example ? "example" : OWNER_LABEL[node.ownership]}
        </span>
      </div>

      <span className="text-[13px] font-medium leading-[17px] text-foreground">{node.title}</span>

      <p
        className={cn(
          "text-[11.5px] leading-[17px] text-muted-foreground",
          live ? "line-clamp-6" : "line-clamp-2",
        )}
      >
        {node.summary}
      </p>

      {live ? (
        <div className="mt-1 flex flex-wrap items-center gap-2 border-t border-[var(--nb-rule)] pt-2">
          <button
            type="button"
            className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--nb-green)] hover:underline"
            onClick={(event) => {
              event.stopPropagation();
              onOpen();
            }}
          >
            {node.ownership === "teammate" ? "Read" : "Open"}
          </button>
          {node.ownership !== "yours" ? (
            <button
              type="button"
              className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground"
              onClick={(event) => {
                event.stopPropagation();
                onBranch();
              }}
            >
              Branch
            </button>
          ) : null}
        </div>
      ) : null}

      {selected ? (
        <span className="font-hand text-[13px] leading-none text-[var(--nb-green)]">
          in context
        </span>
      ) : null}
    </div>
  );
}

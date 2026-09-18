import { useEffect, useRef, useState } from "react";

import { LabCardMenu } from "@/components/canvas-lab/LabCardMenu";
import { CARD_WIDTH, type LabAnchor, type LabNode } from "@/components/canvas-lab/canvas-lab-model";
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
  draft: "border-[var(--nb-green)] bg-[var(--nb-green-wash)]",
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
  onHide,
  onDelete,
  onEdit,
  onEditCommitted,
  connecting,
  connectSourceAnchor,
  onAnchorPointerDown,
  onAnchorActivate,
  onMenuOpened,
  onMenuOpenChange,
  onMeasure,
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
  onHide: () => void;
  onDelete: () => void;
  onEdit: (text: string) => void;
  onEditCommitted: () => void;
  connecting: boolean;
  connectSourceAnchor: LabAnchor | null;
  onAnchorPointerDown: (side: LabAnchor, event: React.PointerEvent<HTMLButtonElement>) => void;
  onAnchorActivate: (side: LabAnchor) => void;
  onMenuOpened: () => void;
  onMenuOpenChange: (open: boolean) => void;
  onMeasure: (height: number) => void;
  onPointerDown: (event: React.PointerEvent) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const paperRef = useRef<HTMLDivElement | null>(null);
  const anchorDownRef = useRef<{ x: number; y: number } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const paper = paperRef.current;
    if (!paper) return;
    const measure = () => onMeasure(paper.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(paper);
    return () => observer.disconnect();
  }, [onMeasure]);

  function changeMenuOpen(open: boolean) {
    if (open && !menuOpen) onMenuOpened();
    setMenuOpen(open);
    onMenuOpenChange(open);
  }

  function openMenu(event: React.MouseEvent | React.KeyboardEvent) {
    event.preventDefault();
    event.stopPropagation();
    changeMenuOpen(true);
  }

  const anchors: LabAnchor[] = ["top", "right", "bottom", "left"];
  return (
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      data-testid={`lab-card-${node.id}`}
      data-node-id={node.id}
      data-connecting={connecting}
      onPointerDown={onPointerDown}
      onContextMenu={openMenu}
      onKeyDown={(event) => {
        if ((event.shiftKey && event.key === "F10") || event.key === "ContextMenu") openMenu(event);
        else onKeyDown(event);
      }}
      style={{ left: node.x, top: node.y, width: CARD_WIDTH }}
      className="canvas-lab-card group absolute cursor-grab text-left"
    >
      <div ref={paperRef} data-selected={selected} data-focused={focused} data-connect-source={connectSourceAnchor !== null} className={cn("canvas-lab-card-paper", item ? "" : `canvas-lab-folded-note flex flex-col gap-1.5 border px-3 py-2.5 ${OWNER_TONE[node.ownership]}`)}>
        {item ? (
          <WorkNote item={item} dense />
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 pr-6">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-soft">{node.typeLabel}</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-soft">{OWNER_LABEL[node.ownership]}</span>
            </div>
            <span className="text-[13px] font-medium leading-[17px] text-foreground">{node.title}</span>
            {node.local ? <textarea aria-label={`Edit ${node.title} note`} value={node.summary} onChange={(event) => onEdit(event.target.value)} onBlur={onEditCommitted} onPointerDown={(event) => event.stopPropagation()} className="min-h-14 w-full resize-none border border-[var(--nb-rule)] bg-card px-2 py-1 text-[11.5px] leading-[17px] text-foreground outline-none focus:border-[var(--nb-green)]" /> : <p className="line-clamp-3 text-[11.5px] leading-[17px] text-muted-foreground">{node.summary}</p>}
          </>
        )}
        {selected ? <span className="mt-1 block font-hand text-[13px] leading-none text-[var(--nb-green)]">in context</span> : null}
      </div>
      {anchors.map((side) => <Button key={side} type="button" size="icon" variant="ghost" className="canvas-lab-anchor" data-node-id={node.id} data-side={side} data-active={connectSourceAnchor === side} aria-label={`Connect from ${side}`} onPointerDown={(event) => { anchorDownRef.current = { x: event.clientX, y: event.clientY }; onAnchorPointerDown(side, event); }} onClick={(event) => { event.stopPropagation(); const down = anchorDownRef.current; anchorDownRef.current = null; if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) >= 6) return; onAnchorActivate(side); }} />)}
      <LabCardMenu selected={selected} canBranch={node.ownership === "teammate" || node.kind === "chat"} local={Boolean(node.local || node.kind === "chat")} removable={node.kind !== "judgment" || Boolean(node.local)} open={menuOpen} onOpenChange={changeMenuOpen} cardRef={cardRef} onSelect={onSelect} onOpen={onOpen} onBranch={onBranch} onHide={onHide} onDelete={onDelete} />
    </div>
  );
}

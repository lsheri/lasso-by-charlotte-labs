import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Paperclip } from "lucide-react";

import { LabCardMenu } from "@/components/canvas-lab/LabCardMenu";
import { LabPaper } from "@/components/canvas-lab/LabPaper";
import { cardSizeTier, type LabAnchor, type LabNode, type LabResizeCorner } from "@/components/canvas-lab/canvas-lab-model";
import type { WorkItemRow } from "@/lib/work-types";
import type { WorkboardCardPreview, WorkboardDisplayMode } from "@/lib/workboard-card-preview.shared";

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
  focusOnMount = false,
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
  onFocus,
  onKeyDown,
  canResize,
  onResizeStart,
  onFit,
  onResizeKeyDown,
  onResizeKeyUp,
  frameChoices,
  structured,
  onMoveToFrame,
  stackZ = 1,
  commentCount = 0,
  onOpenComments,
  displayMode = "sticky",
  preview,
  onPreviewScroll,
}: {
  node: LabNode;
  item?: WorkItemRow | undefined;
  selected: boolean;
  focused: boolean;
  focusOnMount?: boolean;
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
  onFocus: () => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  canResize: boolean;
  onResizeStart: (corner: LabResizeCorner, event: React.PointerEvent<HTMLButtonElement>) => void;
  onFit: () => void;
  onResizeKeyDown: (corner: LabResizeCorner, event: React.KeyboardEvent<HTMLButtonElement>) => void;
  onResizeKeyUp: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
  frameChoices: { id: string; name: string }[];
  structured: boolean;
  onMoveToFrame: (id: string) => void;
  stackZ?: number;
  /** Slice 2a unit 2: live top-level comments on this card's item. */
  commentCount?: number;
  onOpenComments?: (() => void) | undefined;
  displayMode?: WorkboardDisplayMode;
  preview?: WorkboardCardPreview | undefined;
  onPreviewScroll?: ((kind: "chat" | "document" | "deck") => void) | undefined;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const paperRef = useRef<HTMLDivElement | null>(null);
  const anchorDownRef = useRef<{ x: number; y: number } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useLayoutEffect(() => {
    if (focusOnMount) cardRef.current?.focus({ preventScroll: true });
  }, [focusOnMount]);

  useEffect(() => {
    const paper = paperRef.current;
    if (!paper) return;
    const measure = () => onMeasure(Math.max(paper.offsetHeight, paper.scrollHeight));
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
      role="group"
      aria-roledescription="card"
      aria-label={`${node.title}${selected ? ", in context" : ""}`}
      tabIndex={0}
      data-testid={`lab-card-${node.id}`}
      data-node-id={node.id}
      data-connecting={connecting}
      onPointerDown={onPointerDown}
      onFocus={onFocus}
      onContextMenu={openMenu}
      onKeyDown={(event) => {
        if ((event.shiftKey && event.key === "F10") || event.key === "ContextMenu") openMenu(event);
        else if (event.target === event.currentTarget) onKeyDown(event);
      }}
      style={{ left: node.x, top: node.y, width: node.width, height: node.height, zIndex: stackZ }}
      data-size={cardSizeTier(node)}
      className="canvas-lab-card group absolute text-left outline-none"
    >
      <div ref={paperRef} data-selected={selected} data-focused={focused} data-connect-source={connectSourceAnchor !== null} className="canvas-lab-card-paper h-full w-full overflow-hidden">
        <LabPaper node={node} item={item} selected={selected} focused={focused} displayMode={displayMode} preview={preview} onPreviewScroll={onPreviewScroll} onEdit={onEdit} onEditCommitted={onEditCommitted} commentCount={commentCount} onOpenComments={onOpenComments} />
        {selected ? <Paperclip aria-hidden="true" className="canvas-lab-context-mark" /> : null}
      </div>
      {canResize && focused ? (["nw", "ne", "se", "sw"] as LabResizeCorner[]).map((corner) => <button key={corner} type="button" className="canvas-lab-resize-handle" data-corner={corner} aria-label={`Resize ${node.title} from ${corner}`} onDoubleClick={(event) => { event.stopPropagation(); onFit(); }} onPointerDown={(event) => onResizeStart(corner, event)} onKeyDown={(event) => onResizeKeyDown(corner, event)} onKeyUp={onResizeKeyUp} />) : null}
      {anchors.map((side) => <button key={side} type="button" className="canvas-lab-anchor" data-node-id={node.id} data-side={side} data-active={connectSourceAnchor === side} aria-label={`Connect from ${side}`} onPointerDown={(event) => { anchorDownRef.current = { x: event.clientX, y: event.clientY }; onAnchorPointerDown(side, event); }} onClick={(event) => { event.stopPropagation(); const down = anchorDownRef.current; anchorDownRef.current = null; if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) >= 6) return; onAnchorActivate(side); }} />)}
      <LabCardMenu selected={selected} canBranch={node.ownership === "teammate" || node.kind === "chat"} local={Boolean(node.local || node.kind === "chat")} removable={node.kind !== "judgment" || Boolean(node.local)} open={menuOpen} onOpenChange={changeMenuOpen} cardRef={cardRef} onSelect={onSelect} onOpen={onOpen} onBranch={onBranch} onHide={onHide} onDelete={onDelete} onFit={canResize ? onFit : undefined} frameChoices={structured ? frameChoices : []} currentFrame={node.frame} onMoveToFrame={structured && canResize ? onMoveToFrame : undefined} />
    </div>
  );
}

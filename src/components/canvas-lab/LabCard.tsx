import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Paperclip } from "lucide-react";

import { LabCardMenu } from "@/components/canvas-lab/LabCardMenu";
import { LabPaper } from "@/components/canvas-lab/LabPaper";
import { ReferenceFileCard, referenceMatchLine } from "@/components/canvas-lab/ReferenceFileCard";
import { GraphiteIcon } from "@/components/notebook/icons";
import { WorkNote } from "@/components/work/WorkNote";
import { isReferenceItem } from "@/lib/reference-file-shared";
import { cardSizeTier, type LabAnchor, type LabNode, type LabResizeCorner } from "@/components/canvas-lab/canvas-lab-model";
import type { WorkItemRow } from "@/lib/work-types";
import type { WorkboardCardPreview, WorkboardFilePreview } from "@/lib/workboard-card-preview.shared";

/**
 * One object on the board. Imported work uses the shared Ledger face.
 * Focus opens the same card up enough to work with. The card never offers an
 * action the owner rules would refuse.
 */
export function LabCard({
  node,
  item,
  selected,
  previewSelected = false,
  contextFlareDelay,
  contextMotionClass = "",
  focused,
  focusOnMount = false,
  onSelect,
  onOpen,
  onBranch,
  onHide,
  onDelete,
  onTakeOutOfContext,
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
  preview,
  filePreview,
  onPreviewScroll: _onPreviewScroll,
  readOnly = false,
  madeInChat,
  bundleToggleLabel,
  onBundleToggle,
}: {
  node: LabNode;
  item?: WorkItemRow | undefined;
  selected: boolean;
  previewSelected?: boolean;
  contextFlareDelay?: number | undefined;
  contextMotionClass?: string | undefined;
  focused: boolean;
  focusOnMount?: boolean;
  onSelect: () => void;
  onOpen: (origin?: DOMRect) => void;
  onBranch: () => void;
  onHide: () => void;
  onDelete: () => void;
  onTakeOutOfContext?: (() => void) | undefined;
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
  preview?: WorkboardCardPreview | undefined;
  filePreview?: WorkboardFilePreview | undefined;
  onPreviewScroll?: ((kind: "chat" | "document" | "deck" | "html" | "mermaid") => void) | undefined;
  /** Sample board only: no drag, no menu, no anchors, no handles. */
  readOnly?: boolean;
  /** U3: set on a piece docked under its chat, for assistive tech. */
  madeInChat?: string | undefined;
  bundleToggleLabel?: string | undefined;
  onBundleToggle?: (() => void) | undefined;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const paperRef = useRef<HTMLDivElement | null>(null);
  const anchorDownRef = useRef<{ x: number; y: number } | null>(null);
  const cardDownRef = useRef<{ x: number; y: number } | null>(null);
  const lastClickMovedRef = useRef(false);
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
    if (readOnly) return;
    event.stopPropagation();
    changeMenuOpen(true);
  }

  function handleCardPointerDown(event: React.PointerEvent) {
    cardDownRef.current = { x: event.clientX, y: event.clientY };
    lastClickMovedRef.current = false;
    onPointerDown(event);
  }

  function handleCardPointerUp(event: React.PointerEvent) {
    const down = cardDownRef.current;
    cardDownRef.current = null;
    if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 4) lastClickMovedRef.current = true;
  }

  /** A deliverable opens its trail on a clean double-click; a drag never does. */
  function handleDoubleClick(event: React.MouseEvent) {
    if (readOnly || !node.deliverable) return;
    if (lastClickMovedRef.current) return;
    if ((event.target as Element).closest("button,textarea")) return;
    event.stopPropagation();
    onOpen(cardRef.current?.getBoundingClientRect());
  }

  const matchLine = item && !isReferenceItem(item) ? referenceMatchLine(item) : null;
  const anchors: LabAnchor[] = ["top", "right", "bottom", "left"];
  return (
    <div
      ref={cardRef}
      role="group"
      aria-roledescription="card"
      aria-label={`${node.title}${selected ? ", in context" : ""}`}
      tabIndex={readOnly ? -1 : 0}
      data-testid={`lab-card-${node.id}`}
      data-node-id={node.id}
      data-connecting={connecting}
      data-read-only={readOnly}
      onPointerDown={readOnly ? undefined : handleCardPointerDown}
      onPointerUp={readOnly ? undefined : handleCardPointerUp}
      onDoubleClick={readOnly ? undefined : handleDoubleClick}
      onFocus={readOnly ? undefined : onFocus}
      onContextMenu={openMenu}
      onKeyDown={readOnly ? undefined : (event) => {
        if ((event.shiftKey && event.key === "F10") || event.key === "ContextMenu") openMenu(event);
        else if (event.target === event.currentTarget) onKeyDown(event);
      }}
      style={{ left: node.x, top: node.y, width: node.width, height: node.height, zIndex: stackZ, "--context-flare-delay": `${contextFlareDelay ?? 0}ms` } as React.CSSProperties}
      data-size={cardSizeTier(node)}
      className={`canvas-lab-card group absolute text-left outline-none ${contextFlareDelay !== undefined ? contextMotionClass : ""}`}
    >
      <div ref={paperRef} data-selected={selected} data-marquee-preview={previewSelected} data-context-entering={contextFlareDelay !== undefined} data-focused={focused} data-connect-source={connectSourceAnchor !== null} className="canvas-lab-card-paper h-full w-full overflow-hidden">
        {item && isReferenceItem(item) ? <ReferenceFileCard item={item} onOpen={() => onOpen(cardRef.current?.getBoundingClientRect())} /> : item ? (
          <WorkNote
            item={item}
            chatPreview={preview}
            filePreview={filePreview}
            className="h-full"
            contextSelected={selected}
            onOpen={() => onOpen(cardRef.current?.getBoundingClientRect())}
            actions={commentCount > 0 && onOpenComments ? (
              <button type="button" data-testid="lab-comment-chip" aria-label={`${commentCount} ${commentCount === 1 ? "comment" : "comments"}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onOpenComments(); }} className="inline-flex items-center gap-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                <GraphiteIcon name="messages" size={11} animate={false} />{commentCount}
              </button>
            ) : undefined}
          />
        ) : <LabPaper node={node} selected={selected} showOwnership={!readOnly} onEdit={onEdit} onEditCommitted={onEditCommitted} onOpenTrail={readOnly || !node.deliverable ? undefined : () => onOpen(cardRef.current?.getBoundingClientRect())} />}
        {matchLine ? <span data-testid="reference-match-line" className="absolute bottom-1 left-2 text-xs text-muted-foreground">{matchLine}</span> : null}
        {selected ? <Paperclip aria-hidden="true" className="canvas-lab-context-mark" /> : null}
        {madeInChat ? <span className="sr-only" data-testid="lab-card-made-in-chat">Made in the chat {madeInChat}</span> : null}
      </div>
      {contextFlareDelay !== undefined && contextMotionClass ? <>
        <span className="canvas-lab-flare" aria-hidden="true"><span className="canvas-lab-flare-beam" /></span>
        <span className="canvas-lab-flare-bloom" aria-hidden="true" />
      </> : null}
      {canResize && focused && !readOnly ? (["nw", "ne", "se", "sw"] as LabResizeCorner[]).map((corner) => <button key={corner} type="button" className="canvas-lab-resize-handle" data-corner={corner} aria-label={`Resize ${node.title} from ${corner}`} onDoubleClick={(event) => { event.stopPropagation(); onFit(); }} onPointerDown={(event) => onResizeStart(corner, event)} onKeyDown={(event) => onResizeKeyDown(corner, event)} onKeyUp={onResizeKeyUp} />) : null}
      {readOnly ? null : anchors.map((side) => <button key={side} type="button" className="canvas-lab-anchor" data-node-id={node.id} data-side={side} data-active={connectSourceAnchor === side} aria-label={`Connect from ${side}`} onPointerDown={(event) => { anchorDownRef.current = { x: event.clientX, y: event.clientY }; onAnchorPointerDown(side, event); }} onClick={(event) => { event.stopPropagation(); const down = anchorDownRef.current; anchorDownRef.current = null; if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) >= 6) return; onAnchorActivate(side); }} />)}
      {readOnly ? null : <LabCardMenu selected={selected} canBranch={node.ownership === "teammate" || node.kind === "chat"} local={Boolean(node.local || node.kind === "chat")} removable={node.kind !== "judgment" || Boolean(node.local)} open={menuOpen} onOpenChange={changeMenuOpen} cardRef={cardRef} onSelect={onSelect} onOpen={() => onOpen(cardRef.current?.getBoundingClientRect())} onBranch={onBranch} onHide={onHide} onDelete={onDelete} onTakeOutOfContext={onTakeOutOfContext} onFit={canResize ? onFit : undefined} frameChoices={structured ? frameChoices : []} currentFrame={node.frame} onMoveToFrame={structured && canResize ? onMoveToFrame : undefined} bundleToggleLabel={bundleToggleLabel} onBundleToggle={onBundleToggle} />}
    </div>
  );
}

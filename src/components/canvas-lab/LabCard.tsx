import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Paperclip } from "lucide-react";

import { LabCardMenu } from "@/components/canvas-lab/LabCardMenu";
import { LabPaper } from "@/components/canvas-lab/LabPaper";
import { CHAT_LINK_COPY, ChatLinkDialog } from "@/components/canvas-lab/ChatLinkDialog";
import { pastedChatUrl } from "@/lib/chat-url";
import { ReferenceFileCard, referenceMatchLine } from "@/components/canvas-lab/ReferenceFileCard";
import { GraphiteIcon } from "@/components/notebook/icons";
import { Button } from "@/components/ui/button";
import { WorkNote } from "@/components/work/WorkNote";
import { isReferenceItem } from "@/lib/reference-file-shared";
import {
  beginClickGesture,
  cancelClickGesture,
  endClickGesture,
  movedBeyondClick,
  swallowClickIfDrag,
  type ClickSuppress,
} from "@/lib/canvas-drag";
import { cardSizeTier, type LabAnchor, type LabNode, type LabResizeCorner } from "@/components/canvas-lab/canvas-lab-model";
import type { WorkItemRow } from "@/lib/work-types";
import type { WorkboardCardPreview, WorkboardFilePreview } from "@/lib/workboard-card-preview.shared";
import type { TeammateMark } from "@/lib/teammate-mark";

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
  showStatusChrome = true,
  madeInChat,
  bundleToggleLabel,
  onBundleToggle,
  onSaveChatLink,
  teammateMark,
}: {
  node: LabNode;
  item?: WorkItemRow | undefined;
  selected: boolean;
  previewSelected?: boolean;
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
  /** Presentational previews may hide ownership and context labels without disabling input. */
  showStatusChrome?: boolean;
  /** U3: set on a piece docked under its chat, for assistive tech. */
  madeInChat?: string | undefined;
  bundleToggleLabel?: string | undefined;
  onBundleToggle?: (() => void) | undefined;
  /** CU1: only the live board passes this, and only for the item's owner. */
  onSaveChatLink?: ((url: string | null) => Promise<void>) | undefined;
  /** Live signed-in board only: provenance for a card added by another member. */
  teammateMark?: TeammateMark | null;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const paperRef = useRef<HTMLDivElement | null>(null);
  const anchorDownRef = useRef<{ x: number; y: number } | null>(null);
  const cardDownRef = useRef<{ x: number; y: number } | null>(null);
  const lastClickMovedRef = useRef(false);
  const suppressClickRef: ClickSuppress = useRef(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatLinkOpen, setChatLinkOpen] = useState(false);
  const pastedLink = pastedChatUrl(item?.meta?.chat_url);
  const canSetChatLink = Boolean(item && onSaveChatLink && !readOnly);

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
    beginClickGesture(suppressClickRef);
    cardDownRef.current = { x: event.clientX, y: event.clientY };
    lastClickMovedRef.current = false;
    onPointerDown(event);
  }

  function handleCardPointerUp(event: React.PointerEvent) {
    const down = cardDownRef.current;
    cardDownRef.current = null;
    if (!down) return;
    const up = { x: event.clientX, y: event.clientY };
    endClickGesture(suppressClickRef, down, up);
    if (movedBeyondClick(down, up)) lastClickMovedRef.current = true;
  }

  function handleCardPointerCancel() {
    cardDownRef.current = null;
    cancelClickGesture(suppressClickRef);
  }

  /** A drag that ends on the card must not open it; swallow that click once. */
  function handleClickCapture(event: React.MouseEvent) {
    if (!swallowClickIfDrag(suppressClickRef)) return;
    event.preventDefault();
    event.stopPropagation();
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
  const teammateTooltip = teammateMark?.name ? `Added by ${teammateMark.name}` : null;
  const anchors: LabAnchor[] = ["top", "right", "bottom", "left"];
  return (
    <div
      ref={cardRef}
      role="group"
      aria-roledescription="card"
      aria-label={`${node.title}${selected && showStatusChrome ? ", in context" : ""}`}
      tabIndex={readOnly ? -1 : 0}
      data-testid={`lab-card-${node.id}`}
      data-node-id={node.id}
      data-connecting={connecting}
      data-read-only={readOnly}
      onPointerDown={readOnly ? undefined : handleCardPointerDown}
      onPointerUp={readOnly ? undefined : handleCardPointerUp}
      onPointerCancel={readOnly ? undefined : handleCardPointerCancel}
      onClickCapture={readOnly ? undefined : handleClickCapture}
      onDoubleClick={readOnly ? undefined : handleDoubleClick}
      onFocus={readOnly ? undefined : onFocus}
      onContextMenu={openMenu}
      onKeyDown={readOnly ? undefined : (event) => {
        if ((event.shiftKey && event.key === "F10") || event.key === "ContextMenu") openMenu(event);
        else if (event.target === event.currentTarget) onKeyDown(event);
      }}
      style={{ left: node.x, top: node.y, width: node.width, height: node.height, zIndex: stackZ } as React.CSSProperties}
      data-size={cardSizeTier(node)}
      className={`canvas-lab-card group absolute text-left outline-none${teammateMark ? " canvas-lab-card-teammate" : ""}`}
    >
      <div ref={paperRef} data-selected={selected} data-marquee-preview={previewSelected} data-focused={focused} data-connect-source={connectSourceAnchor !== null} className="canvas-lab-card-paper h-full w-full overflow-hidden">
        {item && isReferenceItem(item) ? <ReferenceFileCard item={item} onOpen={() => onOpen(cardRef.current?.getBoundingClientRect())} /> : item ? (
          <WorkNote
            item={item}
            chatPreview={preview}
            filePreview={filePreview}
            className="h-full"
            contextSelected={selected}
             headerGutter
            onOpen={() => onOpen(cardRef.current?.getBoundingClientRect())}
            actions={commentCount > 0 && onOpenComments ? (
              <button type="button" data-testid="lab-comment-chip" aria-label={`${commentCount} ${commentCount === 1 ? "comment" : "comments"}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onOpenComments(); }} className="inline-flex items-center gap-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                <GraphiteIcon name="messages" size={11} animate={false} />{commentCount}
              </button>
            ) : undefined}
          />
        ) : <LabPaper node={node} selected={selected && showStatusChrome} showOwnership={!readOnly && showStatusChrome} onEdit={onEdit} onEditCommitted={onEditCommitted} onOpenTrail={readOnly || !node.deliverable ? undefined : () => onOpen(cardRef.current?.getBoundingClientRect())} />}
        {matchLine ? <span data-testid="reference-match-line" className="absolute bottom-1 left-2 text-xs text-muted-foreground">{matchLine}</span> : null}
        {selected ? <Paperclip aria-hidden="true" className="canvas-lab-context-mark" /> : null}
        {madeInChat ? <span className="sr-only" data-testid="lab-card-made-in-chat">Made in the chat {madeInChat}</span> : null}
      </div>
      {readOnly ? null : (
        <div className="canvas-lab-card-bar" onPointerDown={(event) => event.stopPropagation()}>
          <LabCardMenu selected={selected} canBranch={node.ownership === "teammate" || node.kind === "chat"} local={Boolean(node.local || node.kind === "chat")} removable={node.kind !== "judgment" || Boolean(node.local)} open={menuOpen} onOpenChange={changeMenuOpen} cardRef={cardRef} onSelect={onSelect} onOpen={() => onOpen(cardRef.current?.getBoundingClientRect())} onBranch={onBranch} onHide={onHide} onDelete={onDelete} onTakeOutOfContext={onTakeOutOfContext} onFit={canResize ? onFit : undefined} frameChoices={structured ? frameChoices : []} currentFrame={node.frame} onMoveToFrame={structured && canResize ? onMoveToFrame : undefined} bundleToggleLabel={bundleToggleLabel} onBundleToggle={onBundleToggle} chatLinkLabel={canSetChatLink ? (pastedLink ? CHAT_LINK_COPY.change : CHAT_LINK_COPY.add) : undefined} onEditChatLink={canSetChatLink ? () => setChatLinkOpen(true) : undefined} />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="canvas-lab-card-open"
            aria-label="Open"
            onPointerDown={(event) => {
              beginClickGesture(suppressClickRef);
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
              onOpen(cardRef.current?.getBoundingClientRect());
            }}
          >
            <GraphiteIcon name="expand" size={17} animate={false} />
          </Button>
        </div>
      )}
      {teammateMark?.initials && teammateTooltip ? (
        <span className="canvas-lab-teammate-tag" title={teammateTooltip} aria-label={teammateTooltip}>
          <svg viewBox="0 0 34 24" fill="none" aria-hidden="true">
            <path d="M5.2 12.7C4.4 6.3 10.1 2.8 17.4 3.4c7.4.6 11.8 4.7 10.7 10.2-1 5.2-7.4 7.8-14.3 6.5C7.4 18.9 3.6 15 5.2 12.7Zm22.5 1.7 4 4.2" />
          </svg>
          <span>{teammateMark.initials}</span>
        </span>
      ) : null}
      {canSetChatLink && onSaveChatLink ? <ChatLinkDialog open={chatLinkOpen} onOpenChange={setChatLinkOpen} current={pastedLink} onSave={onSaveChatLink} /> : null}
      {canResize && focused && !readOnly ? (["nw", "ne", "se", "sw"] as LabResizeCorner[]).map((corner) => <button key={corner} type="button" className="canvas-lab-resize-handle" data-corner={corner} aria-label={`Resize ${node.title} from ${corner}`} onDoubleClick={(event) => { event.stopPropagation(); onFit(); }} onPointerDown={(event) => onResizeStart(corner, event)} onKeyDown={(event) => onResizeKeyDown(corner, event)} onKeyUp={onResizeKeyUp} />) : null}
      {readOnly ? null : anchors.map((side) => <button key={side} type="button" className="canvas-lab-anchor" data-node-id={node.id} data-side={side} data-active={connectSourceAnchor === side} aria-label={`Connect from ${side}`} onPointerDown={(event) => { anchorDownRef.current = { x: event.clientX, y: event.clientY }; onAnchorPointerDown(side, event); }} onClick={(event) => { event.stopPropagation(); const down = anchorDownRef.current; anchorDownRef.current = null; if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) >= 6) return; onAnchorActivate(side); }} />)}
    </div>
  );
}

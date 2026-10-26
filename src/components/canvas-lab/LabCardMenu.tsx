import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CardFace } from "@/design/reference/FaceToggle";

export function LabCardMenu({
  selected,
  canBranch,
  local,
  removable = true,
  open,
  onOpenChange,
  cardRef,
  onSelect,
  onOpen,
  onOpenLedger,
  onBranch,
  onHide,
  onDelete,
  onTakeOutOfContext,
  onFit,
  frameChoices = [],
  currentFrame,
  onMoveToFrame,
  bundleToggleLabel,
  onBundleToggle,
  chatLinkLabel,
  onEditChatLink,
  onRename,
  cardFace,
  onCardFaceChange,
}: {
  selected: boolean;
  canBranch: boolean;
  local: boolean;
  /** False for a teammate's authored card: reading it is fine, removing it is not. */
  removable?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardRef: React.RefObject<HTMLDivElement | null>;
  onSelect: () => void;
  onOpen: () => void;
  onOpenLedger?: (() => void) | undefined;
  onBranch: () => void;
  onHide: () => void;
  onDelete: () => void;
  /** Present only on a card inside the context region. */
  onTakeOutOfContext?: (() => void) | undefined;
  onFit?: (() => void) | undefined;
  frameChoices?: { id: string; name: string }[];
  currentFrame?: string | null | undefined;
  onMoveToFrame?: ((id: string) => void) | undefined;
  /** B2: only on a chat with docked pieces. */
  bundleToggleLabel?: string | undefined;
  onBundleToggle?: (() => void) | undefined;
  /** CU1: only where the board can save a chat link. */
  chatLinkLabel?: string | undefined;
  onEditChatLink?: (() => void) | undefined;
  /** WI-1: only on the owner's own work card. */
  onRename?: (() => void) | undefined;
  /** FACE-3: both present on the board only. */
  cardFace?: CardFace | undefined;
  onCardFaceChange?: ((face: CardFace) => void) | undefined;
}) {

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="canvas-lab-card-menu-trigger"
          aria-label="Card options"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="canvas-lab-card-menu"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          cardRef.current?.focus({ preventScroll: true });
        }}
      >
        {onOpenLedger ? <DropdownMenuItem onSelect={onOpenLedger}>Open ledger</DropdownMenuItem> : null}
        <DropdownMenuItem onSelect={onSelect}>{selected ? "Remove context" : "Use as context"}</DropdownMenuItem>
        {onOpenLedger ? null : <DropdownMenuItem onSelect={onOpen}>Preview</DropdownMenuItem>}
        {onCardFaceChange && cardFace ? <DropdownMenuItem onSelect={() => onCardFaceChange(cardFace === 'art' ? 'preview' : 'art')}>{cardFace === 'art' ? 'Show as real' : 'Show as sketch'}</DropdownMenuItem> : null}
        {onFit ? <DropdownMenuItem onSelect={onFit}>Fit content</DropdownMenuItem> : null}
        {canBranch ? <DropdownMenuItem onSelect={onBranch}>Branch</DropdownMenuItem> : null}
        {onMoveToFrame && frameChoices.filter((frame) => frame.id !== currentFrame).map((frame) => <DropdownMenuItem key={frame.id} onSelect={() => onMoveToFrame(frame.id)}>Move to {frame.name}</DropdownMenuItem>)}
        {onBundleToggle && bundleToggleLabel ? <DropdownMenuItem onSelect={onBundleToggle}>{bundleToggleLabel}</DropdownMenuItem> : null}
        {onEditChatLink && chatLinkLabel ? <DropdownMenuItem onSelect={onEditChatLink}>{chatLinkLabel}</DropdownMenuItem> : null}
        {onRename ? <DropdownMenuItem onSelect={onRename}>Rename for others</DropdownMenuItem> : null}
        {onTakeOutOfContext ? <DropdownMenuItem onSelect={onTakeOutOfContext}>Take out of context</DropdownMenuItem> : null}
        <DropdownMenuSeparator />
        {local ? (
          <DropdownMenuItem onSelect={onDelete}>Delete this work</DropdownMenuItem>
        ) : removable ? (
          <DropdownMenuItem onSelect={onHide}>Remove from board</DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled>Only the author can remove this</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

}
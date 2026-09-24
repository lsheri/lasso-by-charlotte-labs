import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
        <DropdownMenuItem onSelect={onSelect}>{selected ? "Remove context" : "Use as context"}</DropdownMenuItem>
        <DropdownMenuItem onSelect={onOpen}>Preview</DropdownMenuItem>
        {onFit ? <DropdownMenuItem onSelect={onFit}>Fit content</DropdownMenuItem> : null}
        {canBranch ? <DropdownMenuItem onSelect={onBranch}>Branch</DropdownMenuItem> : null}
        {onMoveToFrame && frameChoices.filter((frame) => frame.id !== currentFrame).map((frame) => <DropdownMenuItem key={frame.id} onSelect={() => onMoveToFrame(frame.id)}>Move to {frame.name}</DropdownMenuItem>)}
        {onBundleToggle && bundleToggleLabel ? <DropdownMenuItem onSelect={onBundleToggle}>{bundleToggleLabel}</DropdownMenuItem> : null}
        {onTakeOutOfContext ? <DropdownMenuItem onSelect={onTakeOutOfContext}>Take out of context</DropdownMenuItem> : null}
        <DropdownMenuSeparator />
        {local ? (
          <DropdownMenuItem onSelect={onDelete}>Delete this work</DropdownMenuItem>
        ) : removable ? (
          <DropdownMenuItem onSelect={onHide}>Hide from this board</DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled>Only the author can remove this</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

}
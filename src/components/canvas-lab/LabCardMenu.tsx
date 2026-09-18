import { MoreHorizontal } from "lucide-react";
import { useRef, useState } from "react";

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
  cardRef,
  onOpened,
  onSelect,
  onOpen,
  onBranch,
  onHide,
  onDelete,
}: {
  selected: boolean;
  canBranch: boolean;
  local: boolean;
  cardRef: React.RefObject<HTMLDivElement | null>;
  onOpened: () => void;
  onSelect: () => void;
  onOpen: () => void;
  onBranch: () => void;
  onHide: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const openedFromCard = useRef(false);

  function changeOpen(next: boolean) {
    if (next && !open) onOpened();
    setOpen(next);
  }

  function openFromCard() {
    openedFromCard.current = true;
    changeOpen(true);
  }

  return (
    <DropdownMenu open={open} onOpenChange={changeOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="canvas-lab-card-menu-trigger"
          aria-label="Open card menu"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="canvas-lab-card-menu"
        onCloseAutoFocus={(event) => {
          if (!openedFromCard.current) return;
          event.preventDefault();
          openedFromCard.current = false;
          cardRef.current?.focus();
        }}
      >
        <DropdownMenuItem onSelect={onSelect}>{selected ? "Remove context" : "Use as context"}</DropdownMenuItem>
        <DropdownMenuItem onSelect={onOpen}>Preview</DropdownMenuItem>
        {canBranch ? <DropdownMenuItem onSelect={onBranch}>Branch</DropdownMenuItem> : null}
        <DropdownMenuSeparator />
        {local ? (
          <DropdownMenuItem onSelect={onDelete}>Delete local node</DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={onHide}>Remove from canvas</DropdownMenuItem>
        )}
      </DropdownMenuContent>
      <span
        aria-hidden="true"
        className="hidden"
        data-open-card-menu=""
        onClick={openFromCard}
      />
    </DropdownMenu>
  );
}

export type LabCardMenuHandle = { openFromCard: () => void };
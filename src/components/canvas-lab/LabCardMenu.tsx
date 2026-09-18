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
}) {

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
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
          event.preventDefault();
          cardRef.current?.focus();
        }}
      >
        <DropdownMenuItem onSelect={onSelect}>{selected ? "Remove context" : "Use as context"}</DropdownMenuItem>
        <DropdownMenuItem onSelect={onOpen}>Preview</DropdownMenuItem>
        {canBranch ? <DropdownMenuItem onSelect={onBranch}>Branch</DropdownMenuItem> : null}
        <DropdownMenuSeparator />
        {local ? (
          <DropdownMenuItem onSelect={onDelete}>Delete local node</DropdownMenuItem>
        ) : removable ? (
          <DropdownMenuItem onSelect={onHide}>Remove from canvas</DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled>Only the author can remove this</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

}
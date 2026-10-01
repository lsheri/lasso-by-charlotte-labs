import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BOARD_WORKSTREAM_COPY } from "@/lib/board-workstream-delete";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function LabFrameMenu({
  open,
  onOpenChange,
  restoreFocus,
  editable,
  custom,
  context,
  removable,
  onFit,
  onRename,
  onRemove,
  onUseAsContext,
  removal,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restoreFocus: () => void;
  editable: boolean;
  custom: boolean;
  context: boolean;
  removable: boolean;
  onFit: () => void;
  onRename: () => void;
  onRemove: () => void;
  onUseAsContext?: (() => void) | undefined;
  /** WK1: what Remove does. Absent means today's rule: custom boxes only. */
  removal?: "none" | "box" | "workstream" | undefined;
}) {
  if (!editable) return null;
  const offersRemove = removal ? removal !== "none" : custom;
  const removeLabel = removal === "workstream" ? BOARD_WORKSTREAM_COPY.removeAndDelete : BOARD_WORKSTREAM_COPY.removeBox;
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="canvas-lab-frame-menu-trigger"
          aria-label={context ? "Context area options" : "Workstream options"}
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
          restoreFocus();
        }}
      >
        {onUseAsContext ? <DropdownMenuItem onSelect={onUseAsContext}>Use as context</DropdownMenuItem> : null}
        <DropdownMenuItem onSelect={onFit}>Fit contents</DropdownMenuItem>
        {editable && custom ? <DropdownMenuItem onSelect={(event) => { event.preventDefault(); onRename(); }}>Rename</DropdownMenuItem> : null}
        {editable && offersRemove ? (
          <DropdownMenuItem disabled={!removable} title={removable ? undefined : "Move its cards first"} onSelect={onRemove}>
            {removeLabel}{removable ? "" : " · Move its cards first"}
          </DropdownMenuItem>
        ) : null}
        {editable && context ? <DropdownMenuItem onSelect={onRemove}>Remove the context area</DropdownMenuItem> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
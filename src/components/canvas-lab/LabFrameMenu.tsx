import { MoreHorizontal } from "lucide-react";

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
  removable,
  onFit,
  onRename,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restoreFocus: () => void;
  editable: boolean;
  custom: boolean;
  removable: boolean;
  onFit: () => void;
  onRename: () => void;
  onRemove: () => void;
}) {
  if (!editable) return null;
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="canvas-lab-frame-menu-trigger"
          aria-label="Open workstream menu"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="canvas-lab-card-menu"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          restoreFocus();
        }}
      >
        <DropdownMenuItem onSelect={onFit}>Fit contents</DropdownMenuItem>
        {editable && custom ? <DropdownMenuItem onSelect={onRename}>Rename</DropdownMenuItem> : null}
        {editable && custom ? (
          <DropdownMenuItem disabled={!removable} title={removable ? undefined : "Move its cards first"} onSelect={onRemove}>
            Remove workstream{removable ? "" : " · Move its cards first"}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
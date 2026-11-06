import { MoreHorizontal } from "lucide-react";
import { useEffect, useRef } from "react";

import { noteWorkboardBoardMenuOpened } from "@/components/canvas-lab/canvas-lab-telemetry";

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
  renamable,
  orgId,
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
  /** WK2: absent means today's rule. False hides Rename on somebody else's workstream. */
  renamable?: boolean | undefined;
  /** MENU-1: workspace for workboard.board_menu_opened. */
  orgId?: string | undefined;
}) {
  const viaRef = useRef<"mouse" | "keyboard">("mouse");
  const wasOpenRef = useRef(open);
  useEffect(() => {
    if (!editable) return;
    const onKey = () => { viaRef.current = "keyboard"; };
    const onPointer = () => { viaRef.current = "mouse"; };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointer, true);
    return () => { document.removeEventListener("keydown", onKey, true); document.removeEventListener("pointerdown", onPointer, true); };
  }, [editable]);
  useEffect(() => {
    if (open && !wasOpenRef.current && editable) noteWorkboardBoardMenuOpened(orgId, "frame", viaRef.current);
    wasOpenRef.current = open;
  }, [open, editable, orgId]);
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
        className="canvas-lab-menu canvas-lab-card-menu"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          restoreFocus();
        }}
      >
        {onUseAsContext ? <DropdownMenuItem className="canvas-lab-menu-item" onSelect={onUseAsContext}>Use as context</DropdownMenuItem> : null}
        <DropdownMenuItem className="canvas-lab-menu-item" onSelect={onFit}>Fit contents</DropdownMenuItem>
        {editable && custom && renamable !== false ? <DropdownMenuItem className="canvas-lab-menu-item" onSelect={(event) => { event.preventDefault(); onRename(); }}>Rename</DropdownMenuItem> : null}
        {editable && offersRemove ? (
          <DropdownMenuItem className="canvas-lab-menu-item" disabled={!removable} title={removable ? undefined : "Move its cards first"} onSelect={onRemove}>
            {removeLabel}{removable ? "" : " · Move its cards first"}
          </DropdownMenuItem>
        ) : null}
        {editable && context ? <DropdownMenuItem className="canvas-lab-menu-item" onSelect={onRemove}>Remove the context area</DropdownMenuItem> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
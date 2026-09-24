import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** The quieter answer actions, kept behind one small ghost control. */
export function AnswerMoreMenu({ onSave }: { onSave: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto h-7 gap-1 px-2 font-mono text-[11px] font-normal uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground"
        >
          More
          <ChevronDown aria-hidden className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onSave}>Save for 1:1</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

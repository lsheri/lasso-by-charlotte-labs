import { MoreHorizontal } from "@/design/brand/icons";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SPACE_COPY } from "@/lib/proposal-desk-shared";

export type MoreAction = { id: string; label: string; onSelect: () => void; disabled?: boolean | undefined };

/**
 * 20 Nov 2026 (Liam, D-86): the rare changes to an open proposal (Undo sent, Close as lost, Archive) under one quiet
 * button, so the row has one thing to press for its next step. Each keeps its own name; the dialogs behind them are
 * unchanged. With nothing to offer it renders nothing.
 */
export function ProposalMore({ label, actions }: { label: string; actions: MoreAction[] }) {
  if (actions.length === 0) return null;
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        data-proposal-more
        aria-label={label}
        title={SPACE_COPY.more}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <MoreHorizontal aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" data-proposal-close className="min-w-44">
        {actions.map((action) => (
          <DropdownMenuItem key={action.id} disabled={action.disabled ?? false} onSelect={action.onSelect}>
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

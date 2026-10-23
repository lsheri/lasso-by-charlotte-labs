import { ChatUrlLink } from '@/components/work/ChatUrlLink';
import { workIdentityLabel } from '@/lib/work-identity';
import type { WorkItemRow } from '@/lib/work-types';

export const TEXT_FACE_COPY = { turn: (n: number) => `TURN ${n}` };

/** Plain work content in the existing preview slot, never a document renderer. */
export function TextFace({ item, parent, summary }: { item: WorkItemRow; parent?: WorkItemRow | null | undefined; summary: string }) {
  const turn = item.source_meta?.produced_at_turn;
  const hasTurn = typeof turn === 'number' && Number.isFinite(turn);
  return (
    <div data-testid="text-face" className="absolute inset-0 flex min-h-0 flex-col gap-2 overflow-hidden p-4 font-sans text-[color:var(--text-primary)]">
      {hasTurn ? <header data-testid="text-face-turn" className="shrink-0 font-mono text-sm">{TEXT_FACE_COPY.turn(turn)}</header> : null}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <p className="m-0 whitespace-pre-line break-words text-base leading-relaxed">{summary}</p>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-[linear-gradient(to_bottom,transparent,var(--surface-raised))]" />
      </div>
      <footer className="flex shrink-0 items-center justify-between gap-2 text-sm">
        <span className="min-w-0 truncate">{workIdentityLabel(item)}</span>
        <span className="shrink-0" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}><ChatUrlLink item={item} parent={parent} /></span>
      </footer>
    </div>
  );
}
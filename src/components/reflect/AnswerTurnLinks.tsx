import { LassoLoopMark } from "@/components/layout/LassoLoopMark";
import { Button } from "@/components/ui/button";
import type { TurnRef } from "@/lib/turn-labels";

export function AnswerTurnLinks({
  refs,
  onOpen,
  testId,
}: {
  refs: readonly TurnRef[];
  onOpen: (ref: TurnRef) => void;
  testId?: string;
}) {
  if (refs.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2" aria-label="Answer sources">
      {refs.map((ref, index) => (
        <Button
          key={`${ref.work_item_id}:${ref.turn_no}`}
          type="button"
          variant="outline"
          size="sm"
          data-testid={index === 0 ? testId : undefined}
          onClick={() => onOpen(ref)}
          className="h-auto min-h-8 max-w-full justify-start gap-2 rounded-full border-pencil bg-nb-white px-3 py-1.5 text-left text-[12px] font-normal text-foreground shadow-none hover:border-green hover:bg-accent-soft"
        >
          <LassoLoopMark className="size-4 shrink-0 text-green" />
          <span className="min-w-0 break-words">{ref.label}</span>
          <span aria-hidden className="shrink-0">→</span>
        </Button>
      ))}
    </div>
  );
}
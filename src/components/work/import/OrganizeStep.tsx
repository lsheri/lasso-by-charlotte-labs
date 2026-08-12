import { SuggestionChip } from "@/components/work/SuggestionChip";
import { Button } from "@/components/ui/button";
import { useMappingSuggestions } from "@/hooks/use-mapping-suggestions";
import { useWorkItems } from "@/hooks/use-work-items";

export function OrganizeStep({ onDone }: { onDone: () => void }) {
  const { data } = useWorkItems();
  const { active, taskLabels, suggesting, acceptPending, error, suggest, accept, dismiss } =
    useMappingSuggestions();

  const items = data?.items ?? [];
  const highConfidence = active.filter((s) => s.confidence === "high");

  return (
    <div className="space-y-4">
      <p className="text-sm text-foreground">
        Optional: let Lasso suggest where this work belongs. Suggestions are drafts, nothing is
        shared until you accept.
      </p>

      {active.length === 0 ? (
        <Button type="button" onClick={() => void suggest()} disabled={suggesting}>
          {suggesting ? "Thinking…" : "✨ Suggest mapping"}
        </Button>
      ) : null}

      <div className="space-y-3">
        {active.map((suggestion) => {
          const item = items.find((i) => i.id === suggestion.work_item_id);
          return (
            <div key={suggestion.work_item_id}>
              <p className="truncate text-sm font-medium text-foreground">
                {item?.title ?? "Conversation"}
              </p>
              <SuggestionChip
                label={taskLabels?.[suggestion.task_id] ?? "task"}
                reason={suggestion.reason}
                pending={acceptPending}
                onAccept={() =>
                  void accept(suggestion, {
                    type: item?.type ?? "ai_thread",
                    source: item?.source ?? "import",
                  })
                }
                onDismiss={() => dismiss(suggestion.work_item_id)}
              />
            </div>
          );
        })}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        {highConfidence.length > 0 ? (
          <Button
            type="button"
            disabled={acceptPending}
            onClick={() => {
              void (async () => {
                for (const suggestion of highConfidence) await accept(suggestion);
              })();
            }}
          >
            Accept all high-confidence ({highConfidence.length})
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={onDone}>
          Leave for later
        </Button>
      </div>
    </div>
  );
}

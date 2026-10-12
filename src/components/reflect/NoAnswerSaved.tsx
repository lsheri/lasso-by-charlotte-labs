import { Button } from "@/components/ui/button";
import { NO_ANSWER_COPY } from "@/lib/ask-question-persist";

/** AQ-1: shown under a saved question that has no saved answer. */
export function NoAnswerSaved({ onResend, disabled }: { onResend: () => void; disabled?: boolean }) {
  return (
    <p
      data-testid="no-answer-saved"
      className="nb-binder-line flex items-center gap-2 text-xs text-muted-foreground"
    >
      <span>{NO_ANSWER_COPY.line}</span>
      <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onResend} disabled={disabled}>
        {NO_ANSWER_COPY.action}
      </Button>
    </p>
  );
}

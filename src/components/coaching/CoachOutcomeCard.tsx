import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  COACH_OUTCOME_HINT,
  COACH_OUTCOME_TITLE,
  RUBRIC_BANDS,
  RUBRIC_LABEL,
  VERDICTS,
  VERDICT_LABELS,
  guessCoachOutcome,
  type CoachOutcome,
} from "@/lib/declared-work";
import { declareCoachOutcome } from "@/lib/declared-work.functions";

const chipClass = (on: boolean) =>
  `rounded-full border px-2.5 py-1 text-xs transition-colors ${
    on
      ? "border-accent bg-accent-soft text-foreground"
      : "border-border bg-card text-muted-foreground hover:text-foreground"
  }`;

/** Coach only. A plain read on the work, kept with the record. */
export function CoachOutcomeCard({
  engagementId,
  role,
}: {
  engagementId: string;
  role: string | undefined;
}) {
  const send = useServerFn(declareCoachOutcome);
  const [value, setValue] = useState<CoachOutcome>(guessCoachOutcome());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (role !== "coach") return null;

  return (
    <section
      data-testid="coach-outcome"
      className="rounded-[var(--radius)] border border-border bg-card px-5 py-4 shadow-card"
    >
      <h2 className="micro-label micro-label-section">{COACH_OUTCOME_TITLE}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{COACH_OUTCOME_HINT}</p>

      <div className="mt-3 flex flex-wrap gap-1.5" data-testid="coach-verdict">
        {VERDICTS.map((verdict) => (
          <button
            key={verdict}
            type="button"
            aria-pressed={value.verdict === verdict}
            data-testid={`coach-verdict-${verdict}`}
            onClick={() =>
              setValue((prev) => ({
                ...prev,
                verdict,
                rework_needed: verdict === "rework" ? true : prev.rework_needed,
              }))
            }
            className={chipClass(value.verdict === verdict)}
          >
            {VERDICT_LABELS[verdict]}
          </button>
        ))}
      </div>

      <p className="mt-3 micro-label">{RUBRIC_LABEL}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5" data-testid="coach-rubric">
        {RUBRIC_BANDS.map((band) => (
          <button
            key={band}
            type="button"
            aria-pressed={value.rubric_band === band}
            data-testid={`coach-rubric-${band}`}
            onClick={() => setValue((prev) => ({ ...prev, rubric_band: band }))}
            className={chipClass(value.rubric_band === band)}
          >
            {band}
          </button>
        ))}
      </div>

      <label className="mt-3 flex items-center gap-2 text-xs text-foreground">
        <input
          type="checkbox"
          data-testid="coach-rework-needed"
          checked={value.rework_needed}
          onChange={(e) => setValue((prev) => ({ ...prev, rework_needed: e.target.checked }))}
        />
        Another pass is needed
      </label>

      <div className="mt-3 flex items-center gap-3">
        <Button
          type="button"
          size="sm"
          disabled={saving}
          onClick={() => {
            setSaving(true);
            void send({ data: { engagement_id: engagementId, ...value } })
              .then(() => setSaved(true))
              .catch((error: unknown) => toast.error((error as Error).message))
              .finally(() => setSaving(false));
          }}
        >
          {saving ? "Keeping…" : "Keep this"}
        </Button>
        {saved ? <span className="text-xs text-muted-foreground">Saved</span> : null}
      </div>
    </section>
  );
}

import {
  AI_INVOLVEMENTS,
  AI_INVOLVEMENT_LABELS,
  DECLARE_ARTIFACT_HINT,
  DECLARE_ARTIFACT_TITLE,
  DISPOSITIONS,
  DISPOSITION_LABELS,
  OUTPUT_KINDS,
  OUTPUT_KIND_LABELS,
  type ArtifactDeclaration,
} from "@/lib/declared-work";

function Row<T extends string>({
  label,
  options,
  labels,
  value,
  testId,
  onPick,
}: {
  label: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T;
  testId: string;
  onPick: (next: T) => void;
}) {
  return (
    <div>
      <p className="micro-label">{label}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5" data-testid={testId}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={option === value}
            data-testid={`${testId}-${option}`}
            onClick={() => onPick(option)}
            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
              option === value
                ? "border-accent bg-accent-soft text-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {labels[option]}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The compact step inside the ship flow. Pre-filled, so one click is enough. */
export function DeclareArtifactStep({
  value,
  onChange,
}: {
  value: ArtifactDeclaration;
  onChange: (next: ArtifactDeclaration) => void;
}) {
  return (
    <div data-testid="declare-artifact" className="space-y-3 rounded-[var(--radius)] border border-border bg-card px-3 py-3">
      <div>
        <p className="text-sm font-medium text-foreground">{DECLARE_ARTIFACT_TITLE}</p>
        <p className="text-xs text-muted-foreground">{DECLARE_ARTIFACT_HINT}</p>
      </div>
      <Row
        label="What is this?"
        options={OUTPUT_KINDS}
        labels={OUTPUT_KIND_LABELS}
        value={value.output_kind}
        testId="declare-output-kind"
        onPick={(output_kind) => onChange({ ...value, output_kind })}
      />
      <Row
        label="Where did it land?"
        options={DISPOSITIONS}
        labels={DISPOSITION_LABELS}
        value={value.disposition}
        testId="declare-disposition"
        onPick={(disposition) => onChange({ ...value, disposition })}
      />
      <Row
        label="How did AI figure in?"
        options={AI_INVOLVEMENTS}
        labels={AI_INVOLVEMENT_LABELS}
        value={value.ai_involvement}
        testId="declare-ai-involvement"
        onPick={(ai_involvement) => onChange({ ...value, ai_involvement })}
      />
    </div>
  );
}

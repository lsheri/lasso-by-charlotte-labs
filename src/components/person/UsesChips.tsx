import { GraphiteIcon } from "@/components/notebook/icons";
import { USES_COPY, type PersonUse } from "@/lib/person-uses";

export function UsesChips({
  value,
  onChange,
  disabled,
}: {
  value: readonly PersonUse[];
  onChange: (next: PersonUse[]) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="micro-label">{USES_COPY.question}</legend>
      <div className="flex flex-wrap gap-2">
        {USES_COPY.options.map((opt) => {
          const on = value.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={on}
              onClick={() =>
                onChange(on ? value.filter((v) => v !== opt.value) : [...value, opt.value])
              }
              className={
                on
                  ? "inline-flex min-h-[36px] items-center gap-1.5 rounded-[var(--radius)] bg-primary px-3 text-sm text-primary-foreground"
                  : "inline-flex min-h-[36px] items-center gap-1.5 rounded-[var(--radius)] border border-border px-3 text-sm text-foreground"
              }
            >
              {on ? <GraphiteIcon name="check" size={12} /> : null}
              {opt.label}
            </button>
          );
        })}
      </div>
      <p className="text-[13px] text-muted-foreground">{USES_COPY.age}</p>
    </fieldset>
  );
}

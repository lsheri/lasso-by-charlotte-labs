import { GraphiteIcon } from "@/components/notebook/icons";
import { USES_COPY, type PersonUse } from "@/lib/person-uses";
import { useBrandCopy } from "@/components/skin/use-skin";

export function UsesChips({
  value,
  onChange,
  disabled,
}: {
  value: readonly PersonUse[];
  onChange: (next: PersonUse[]) => void;
  disabled?: boolean;
}) {
  const copy = useBrandCopy();
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="micro-label">{copy(USES_COPY.question)}</legend>
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
      <p className="text-(length:--type-body) text-muted-foreground">{copy(USES_COPY.age)}</p>
    </fieldset>
  );
}

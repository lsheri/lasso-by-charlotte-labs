import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DELIVERABLE_KINDS, DELIVERABLE_KIND_LABELS, type DeliverableKind } from "@/lib/deliverable-kinds";

/**
 * The owner's own label for what kind of deliverable a piece of work is. Fixed
 * vocabulary, no free text, so the value stays readable across the record.
 */
export function DeliverableKindSelect({
  value,
  onChange,
  suggested = false,
  label = "What kind of deliverable is this?",
  id = "deliverable-kind",
}: {
  value: DeliverableKind | null;
  onChange: (kind: DeliverableKind) => void;
  suggested?: boolean;
  label?: string;
  id?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="micro-label mb-1 block">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <Select
          {...(value ? { value } : {})}
          onValueChange={(next) => onChange(next as DeliverableKind)}
        >
          <SelectTrigger id={id} className="h-9 w-[220px] text-sm" data-deliverable-kind={value ?? "unset"}>
            <SelectValue placeholder="Pick a kind" />
          </SelectTrigger>
          <SelectContent>
            {DELIVERABLE_KINDS.map((kind) => (
              <SelectItem key={kind} value={kind}>
                {DELIVERABLE_KIND_LABELS[kind]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {suggested && value ? (
          <span className="rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-accent-deep">
            Suggested
          </span>
        ) : null}
      </div>
    </div>
  );
}

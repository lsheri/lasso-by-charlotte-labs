import { Button } from "@/components/ui/button";
import { CONTAINER_ACTIONS_COPY as COPY } from "@/lib/container-actions";
import { CONTAINER_COLOURS, containerColourStyle, type ContainerColour } from "@/lib/container-colour";

export function ContainerColourSwatches({ value, onChange, disabled }: {
  value: ContainerColour | null;
  onChange: (value: ContainerColour | null) => void;
  disabled?: boolean;
}) {
  return (
    <div role="group" aria-label="Container colours" className="flex w-fit gap-1 p-1">
      {[null, ...CONTAINER_COLOURS].map((colour) => (
        <Button
          key={colour ?? COPY.noColour}
          type="button"
          variant="ghost"
          disabled={disabled}
          aria-label={colour ?? COPY.noColour}
          aria-pressed={value === colour}
          onClick={() => onChange(colour)}
          className={`h-6 min-h-6 w-6 min-w-6 shrink-0 rounded-full p-0 ${value === colour ? "ring-2 ring-ring ring-offset-2 ring-offset-background" : ""}`}
        >
          <span
            aria-hidden="true"
            className="h-3 w-3 rounded-full border border-border"
            style={colour ? { backgroundColor: containerColourStyle(colour).dot } : undefined}
          />
        </Button>
      ))}
    </div>
  );
}
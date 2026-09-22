import { Button } from "@/components/ui/button";
import { REGION_FILLS, regionFillStyle, type RegionFill } from "@/lib/board-region";

export function RegionColourSwatches({ value, onChange }: { value: RegionFill; onChange: (fill: RegionFill) => void }) {
  return (
    <div className="canvas-lab-region-swatches" aria-label="Grouping colour">
      {REGION_FILLS.map((fill) => {
        const colours = regionFillStyle(fill);
        return (
          <Button
            key={fill}
            type="button"
            size="icon"
            variant="ghost"
            aria-label={fill.replace("-", " ")}
            aria-pressed={value === fill}
            className="canvas-lab-region-swatch"
            style={{ background: colours.fill, borderColor: colours.edge }}
            onClick={() => onChange(fill)}
          />
        );
      })}
    </div>
  );
}
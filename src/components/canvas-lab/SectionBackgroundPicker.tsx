import { RegionColourSwatches } from "@/components/canvas-lab/RegionColourSwatches";
import { Button } from "@/components/ui/button";
import { isRegionFill, type RegionFill } from "@/lib/board-region";

export const SECTION_BACKGROUND_COPY = { background: "Background", none: "No background" } as const;

export function SectionBackgroundPicker({ value, onChange }: { value: string | null | undefined; onChange: (fill: RegionFill | null) => void }) {
  return <div role="group" aria-label={SECTION_BACKGROUND_COPY.background} className="canvas-lab-section-background" onPointerDown={(event) => event.stopPropagation()}>
    <RegionColourSwatches value={isRegionFill(value) ? value : undefined as never} onChange={onChange} />
    <Button size="sm" variant="ghost" aria-pressed={value == null} onClick={() => onChange(null)}>{SECTION_BACKGROUND_COPY.none}</Button>
  </div>;
}
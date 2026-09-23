import { Button } from "@/components/ui/button";
import { GraphiteIcon } from "@/components/notebook/icons";

export function BoardViewControls({
  zoom,
  showZoomControls = true,
  onFit,
  onZoomOut,
  onResetZoom,
  onZoomIn,
}: {
  zoom: number;
  showZoomControls?: boolean;
  onFit: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onZoomIn: () => void;
}) {
  return (
    <>
      <span className="mx-1 h-5 w-px shrink-0 bg-rule" aria-hidden="true" />
      <Button type="button" size="icon" variant="outline" aria-label="Fit" title="Fit" onClick={onFit}>
        <GraphiteIcon name="fit" animate={false} />
      </Button>
      {showZoomControls ? (
        <span role="group" aria-label="Board zoom" className="inline-flex shrink-0 items-center rounded-[var(--radius-control)] border border-border bg-card">
          <Button type="button" size="icon" variant="ghost" aria-label="Zoom out" title="Zoom out" onClick={onZoomOut}>
            <GraphiteIcon name="minus" size={14} animate={false} />
          </Button>
          <Button type="button" variant="ghost" aria-label="Zoom to 100 percent" className="h-9 w-11 px-0 font-mono text-[10px] text-soft" onClick={onResetZoom}>
            {Math.round(zoom * 100)}%
          </Button>
          <Button type="button" size="icon" variant="ghost" aria-label="Zoom in" title="Zoom in" onClick={onZoomIn}>
            <GraphiteIcon name="plus" size={14} animate={false} />
          </Button>
        </span>
      ) : null}
    </>
  );
}
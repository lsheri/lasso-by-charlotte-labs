import { X } from "lucide-react";
import { useEffect } from "react";

import { LabCard } from "@/components/canvas-lab/LabCard";
import { LabFrame as LabFrameElement } from "@/components/canvas-lab/LabFrame";
import { LabRelationships } from "@/components/canvas-lab/LabRelationships";
import { LabRelationshipOverlays } from "@/components/canvas-lab/LabRelationshipOverlays";
import { labInverseZoom } from "@/components/canvas-lab/canvas-lab-model";
import {
  EXAMPLE_BOARD_SIZE,
  EXAMPLE_CLIENT,
  EXAMPLE_ENGAGEMENT,
  EXAMPLE_FRAMES,
  EXAMPLE_LINKS,
  EXAMPLE_NODES,
} from "@/components/canvas-lab/example-board";
import { Button } from "@/components/ui/button";

const noop = () => undefined;
const EXAMPLE_ZOOM = 0.72;
const HEIGHTS: ReadonlyMap<string, number> = new Map(EXAMPLE_NODES.map((node) => [node.id, node.height]));

/**
 * A finished sample board, read only. Nothing here can be moved, edited, added
 * to or saved: every card is rendered without its anchors, menu or handles, and
 * every outline is rendered as not editable.
 */
export function ExampleBoardOverlay({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div data-testid="canvas-lab-example" role="dialog" aria-modal="true" aria-label="Example board" className="fixed inset-0 z-[60] flex flex-col bg-[var(--nb-paper)]">
      <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-border bg-card px-4">
        <div className="min-w-0">
          <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-green">Example</span>
          <span className="block truncate text-[13px] font-medium text-foreground">{EXAMPLE_CLIENT} / {EXAMPLE_ENGAGEMENT}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden font-hand text-[16px] text-[var(--nb-mid)] sm:inline">a sample board, nothing here is yours</span>
          <Button size="icon" variant="ghost" aria-label="Close example board" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
      </header>
      <div className="relative min-h-0 flex-1 overflow-auto">
        <div
          className="canvas-lab-stage relative origin-top-left"
          style={{ width: EXAMPLE_BOARD_SIZE.width, height: EXAMPLE_BOARD_SIZE.height, transform: `scale(${EXAMPLE_ZOOM})` }}
        >
          {EXAMPLE_FRAMES.map((frame) => (
            <LabFrameElement
              key={frame.id}
              frame={frame}
              count={EXAMPLE_NODES.filter((node) => node.frame === frame.id).length}
              selected={false}
              editable={false}
              custom={false}
              namedByWorkstream={false}
              removable={false}
              kind="custom"
              onSelect={noop}
              onResizeStart={noop}
              onFit={noop}
              onRename={noop}
              onRemove={noop}
              onMenuOpened={noop}
              onMenuOpenChange={noop}
            />
          ))}
          <svg className="canvas-lab-relationships absolute inset-0 overflow-visible" width={EXAMPLE_BOARD_SIZE.width} height={EXAMPLE_BOARD_SIZE.height} aria-label="Example board relationships">
            <LabRelationships links={EXAMPLE_LINKS} nodes={EXAMPLE_NODES} measuredHeights={HEIGHTS} selectedLinkId={null} inverseZoom={labInverseZoom(EXAMPLE_ZOOM)} onSelect={noop} />
          </svg>
          {EXAMPLE_NODES.map((node) => (
            <LabCard
              key={node.id}
              node={node}
              readOnly
              selected={false}
              focused={false}
              connecting={false}
              connectSourceAnchor={null}
              onSelect={noop}
              onOpen={noop}
              onBranch={noop}
              onHide={noop}
              onDelete={noop}
              onEdit={noop}
              onEditCommitted={noop}
              onAnchorPointerDown={noop}
              onAnchorActivate={noop}
              onMenuOpened={noop}
              onMenuOpenChange={noop}
              onMeasure={noop}
              onPointerDown={noop}
              onFocus={noop}
              onKeyDown={noop}
              canResize={false}
              onResizeStart={noop}
              onFit={noop}
              onResizeKeyDown={noop}
              onResizeKeyUp={noop}
              frameChoices={[]}
              structured
              onMoveToFrame={noop}
            />
          ))}
          <svg className="canvas-lab-relationship-overlays absolute inset-0 overflow-visible" width={EXAMPLE_BOARD_SIZE.width} height={EXAMPLE_BOARD_SIZE.height} aria-label="Example board relationship labels">
            <LabRelationshipOverlays links={EXAMPLE_LINKS} nodes={EXAMPLE_NODES} measuredHeights={HEIGHTS} selectedLinkId={null} hoveredLinkId={null} inverseZoom={labInverseZoom(EXAMPLE_ZOOM)} zoom={EXAMPLE_ZOOM} editable={false} onRemove={noop} onChangeRelation={noop} />
          </svg>
        </div>
      </div>
    </div>
  );
}

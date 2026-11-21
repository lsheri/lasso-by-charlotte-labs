import { useEffect } from "react";

import { PILL_DOCK_COPY, type PillDock } from "@/lib/chat-pill-shared";

export type DockSpot = { dock: PillDock; left: number; top: number; width: number; height: number };

/**
 * 21 Nov 2026, chat pill Phase 1c: the dashed spots the chat can sit in, drawn while it is being moved. The nearest
 * one lights up under a drag; when picking, each is a button. Escape or a press anywhere else keeps it where it is.
 */
export function PillDockSpots({
  spots,
  active,
  current,
  picking,
  onPick,
  onClose,
}: {
  spots: readonly DockSpot[];
  /** The spot a drop would land in now. */
  active: PillDock | null;
  current: PillDock;
  /** Clicked rather than dragged: the spots are buttons. */
  picking: boolean;
  onPick: (dock: PillDock) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!picking) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picking, onClose]);
  return (
    <div className="pill-spots" data-pill-spots={picking ? "picking" : "dragging"} onPointerDown={picking ? onClose : undefined}>
      {spots.map((spot) => {
        const label = PILL_DOCK_COPY.spots[spot.dock];
        const style = { left: spot.left, top: spot.top, width: spot.width, height: spot.height };
        return picking ? (
          <button
            key={spot.dock}
            type="button"
            className="pill-spots__spot"
            style={style}
            data-spot={spot.dock}
            data-current={spot.dock === current || undefined}
            aria-label={PILL_DOCK_COPY.pick(label)}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onPick(spot.dock)}
          >
            <span className="pill-spots__label">{label}</span>
          </button>
        ) : (
          <div key={spot.dock} className="pill-spots__spot" style={style} data-spot={spot.dock} data-active={spot.dock === active || undefined} aria-hidden>
            <span className="pill-spots__label">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

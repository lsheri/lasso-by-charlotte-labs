import { X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { LabFrame } from "@/components/canvas-lab/canvas-lab-model";
import { Button } from "@/components/ui/button";
import { REGION_NAMING_LINE } from "@/lib/board-region";
import type { Point } from "@/lib/canvas-drag";

const POPUP_WIDTH = 320;
const POPUP_HEIGHT_ESTIMATE = 92;
const VIEWPORT_GAP = 8;
const ANCHOR_GAP = 10;

export function groupingNamePopupPosition(
  frame: Pick<LabFrame, "x" | "y" | "width" | "height">,
  pan: Point,
  zoom: number,
  viewport: { width: number; height: number },
  popup: { width: number; height: number },
) {
  const anchorLeft = pan.x + (frame.x + frame.width / 2) * zoom;
  const frameTop = pan.y + frame.y * zoom;
  const frameBottom = pan.y + (frame.y + frame.height) * zoom;
  const side = frameTop - ANCHOR_GAP - popup.height >= VIEWPORT_GAP ? "above" : "below";
  const desiredTop = side === "above" ? frameTop - ANCHOR_GAP - popup.height : frameBottom + ANCHOR_GAP;
  return {
    left: Math.max(VIEWPORT_GAP, Math.min(anchorLeft - popup.width / 2, viewport.width - popup.width - VIEWPORT_GAP)),
    top: Math.max(VIEWPORT_GAP, Math.min(desiredTop, viewport.height - popup.height - VIEWPORT_GAP)),
    width: popup.width,
    side,
  } as const;
}

export function GroupingNamePopup({ frame, pan, zoom, viewport, portalRoot, onName, onDismiss }: {
  frame: LabFrame;
  pan: Point;
  zoom: number;
  viewport: { width: number; height: number };
  portalRoot: HTMLElement;
  onName: (name: string) => void;
  onDismiss: () => void;
}) {
  const popupRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState(false);
  const [size, setSize] = useState({ width: POPUP_WIDTH, height: POPUP_HEIGHT_ESTIMATE });
  const position = groupingNamePopupPosition(frame, pan, zoom, viewport, size);

  useLayoutEffect(() => {
    const popup = popupRef.current;
    if (!popup) return;
    const rect = popup.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0 && (rect.width !== size.width || rect.height !== size.height)) {
      setSize({ width: rect.width, height: rect.height });
    }
  }, [size.height, size.width]);

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    function dismissFromOutside(event: PointerEvent) {
      if (popupRef.current?.contains(event.target as Node)) return;
      onDismiss();
    }
    function dismissFromEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onDismiss();
    }
    window.addEventListener("pointerdown", dismissFromOutside);
    window.addEventListener("keydown", dismissFromEscape);
    return () => {
      window.removeEventListener("pointerdown", dismissFromOutside);
      window.removeEventListener("keydown", dismissFromEscape);
    };
  }, [onDismiss]);

  function submit() {
    const name = draft.trim();
    if (!name) { setError(true); return; }
    onName(name);
  }

  return createPortal(
    <div
      ref={popupRef}
      data-grouping-name-popup="true"
      data-side={position.side}
      className="canvas-lab-grouping-name-popup"
      style={{ left: position.left, top: position.top, width: POPUP_WIDTH }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <Button type="button" size="icon" variant="ghost" className="canvas-lab-grouping-name-dismiss" aria-label="Dismiss naming" onClick={onDismiss}><X className="h-3.5 w-3.5" /></Button>
      <input
        ref={inputRef}
        aria-label="Name this grouping"
        className="canvas-lab-frame-name-input font-hand text-[18px] leading-none text-[var(--nb-mid)]"
        value={draft}
        maxLength={60}
        onChange={(event) => { setDraft(event.target.value); if (event.target.value.trim()) setError(false); }}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Enter") { event.preventDefault(); submit(); }
          if (event.key === "Escape") { event.preventDefault(); onDismiss(); }
        }}
      />
      {error ? <span className="canvas-lab-frame-name-error font-hand">a workstream needs a name</span> : null}
      <span className="canvas-lab-region-hint font-hand block text-[13px] text-[var(--nb-mid)]">{REGION_NAMING_LINE}</span>
    </div>,
    portalRoot,
  );
}
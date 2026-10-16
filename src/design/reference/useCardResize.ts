import * as React from 'react';
import { useEffect, useRef, useState } from 'react';

/** Corner-drag and arrow-key resizing, shared by SketchCard and BoardCard. */

export type CardSize = { width: number; height: number };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function useCardResize(
  initial: CardSize,
  min: CardSize,
  max: CardSize,
  onResize?: (size: CardSize) => void,
) {
  const [size, setSize] = useState<CardSize>(initial);
  const [resizing, setResizing] = useState(false);
  const drag = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  useEffect(() => {
    setSize(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.width, initial.height]);

  const apply = (w: number, h: number) => {
    const next = {
      width: Math.round(clamp(w, min.width, max.width)),
      height: Math.round(clamp(h, min.height, max.height)),
    };
    setSize(next);
    onResize?.(next);
  };

  const handleProps = {
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { x: e.clientX, y: e.clientY, w: size.width, h: size.height };
      setResizing(true);
    },
    onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => {
      const d = drag.current;
      if (!d) return;
      apply(d.w + (e.clientX - d.x), d.h + (e.clientY - d.y));
    },
    onPointerUp: () => {
      drag.current = null;
      setResizing(false);
    },
    onPointerCancel: () => {
      drag.current = null;
      setResizing(false);
    },
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
    onDoubleClick: (e: React.MouseEvent) => e.stopPropagation(),
    onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      const step = e.shiftKey ? 48 : 16;
      if (e.key === 'ArrowRight') apply(size.width + step, size.height);
      else if (e.key === 'ArrowLeft') apply(size.width - step, size.height);
      else if (e.key === 'ArrowDown') apply(size.width, size.height + step);
      else if (e.key === 'ArrowUp') apply(size.width, size.height - step);
      else return;
      e.preventDefault();
    },
  };

  return { size, resizing, handleProps };
}

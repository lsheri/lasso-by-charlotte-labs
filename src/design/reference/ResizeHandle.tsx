import * as React from 'react';
import { useState } from 'react';
import type { CardSize } from './useCardResize';

type HandleProps = {
  size: CardSize;
  visible: boolean;
  handlers: {
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
    onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
    onClick: (e: React.MouseEvent) => void;
    onDoubleClick: (e: React.MouseEvent) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
  };
};

/** The corner grip. Drawn structure: pencil, no fill, appears on hover or focus. */
export function ResizeHandle({ size, visible, handlers }: HandleProps) {
  const [focus, setFocus] = useState(false);
  return (
    <button
      type="button"
      aria-label={`Resize card, now ${size.width} by ${size.height}. Use arrow keys.`}
      {...handlers}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={{
        position: 'absolute',
        right: 0,
        bottom: 0,
        width: 24,
        height: 24,
        display: 'grid',
        placeItems: 'center',
        padding: 0,
        border: 0,
        background: 'transparent',
        cursor: 'nwse-resize',
        touchAction: 'none',
        zIndex: 3,
        opacity: visible || focus ? 1 : 0,
        outline: focus ? '2px solid var(--focus-ring)' : undefined,
        outlineOffset: -2,
        transition: 'opacity var(--dur-quick) var(--ease-standard)',
      }}
    >
      <svg width={12} height={12} viewBox="0 0 12 12" aria-hidden>
        <path d="M11 3 3 11M11 7 7 11" style={{ stroke: 'var(--text-primary)', strokeWidth: 1.4, strokeLinecap: 'round', fill: 'none' }} />
      </svg>
    </button>
  );
}

import * as React from "react";
import { useState } from "react";

/**
 * Toolbar and ToolButton. Decided 14 Oct 2026 (L), frame "Tools + Ask Lasso".
 * Built in the app as TOOLS-1 on 15 Oct (.canvas-lab-tool-group). A TOOL
 * holds; a BUTTON fires. The acid held state belongs to tools only and the
 * catch belongs to actions only. A tool never animates: you click these forty
 * times a session. Hover is the only transition.
 *
 * This is the exact code. Every value is a CSS variable from
 * src/design/tokens.css. The Magic Patterns design system "Lasso" carries a
 * byte-identical copy at components/Toolbar/index.tsx.
 */

export type ToolButtonProps = {
  /** A 24-viewBox path. */
  d: string;
  label: string;
  held?: boolean;
  disabled?: boolean;
  /** 44px targets from @media (hover: none) or max-width 767px. */
  touch?: boolean;
  onClick?: () => void;
};

export const ToolButton = ({ d, label, held, disabled, touch, onClick }: ToolButtonProps) => {
  const [hover, setHover] = useState(false);
  const size = touch ? 44 : 29;
  const glyph = touch ? 19 : 15;
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={held}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "grid", placeItems: "center", width: size, height: size, minWidth: size, minHeight: size, padding: 0,
        border: 0, borderRadius: "var(--radius-md-new)",
        background: held ? "var(--hand-live)" : hover && !disabled ? "color-mix(in srgb, var(--text-primary) 8%, transparent)" : "transparent",
        color: disabled ? "color-mix(in srgb, var(--text-primary) 30%, transparent)" : "var(--text-primary)",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background var(--dur-quick) var(--ease-standard)",
      }}
    >
      <svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
    </button>
  );
};

export type ToolbarProps = {
  children: React.ReactNode;
  touch?: boolean;
};

/** The group: light graphite, one held at a time. */
export const Toolbar = ({ children, touch }: ToolbarProps) => (
  <div
    role="toolbar"
    style={{
      display: "inline-flex", alignItems: "center", gap: touch ? 4 : 2, padding: touch ? 6 : 4,
      borderRadius: "var(--radius-md-new)",
      background: "linear-gradient(176deg, var(--neutral-20), var(--neutral-30))",
      boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--surface-raised) 70%, transparent)",
    }}
  >
    {children}
  </div>
);

/** The six board tools, as paths. */
export const TOOL_PATHS = {
  cursor: "m4 3 7 17 2.5-7L21 10.5Z",
  hand: "M9 11V5.5a1.5 1.5 0 0 1 3 0V11m0-1V4.5a1.5 1.5 0 0 1 3 0V11m0-1.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6v-2a1.5 1.5 0 0 1 3 0",
  region: "M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16",
  sticky: "M5 4h14v10l-5 6H5zM19 14h-5v6",
  link: "M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1-1",
  text: "M5 6V4.5h14V6M12 4.5V20M9 20h6",
} as const;

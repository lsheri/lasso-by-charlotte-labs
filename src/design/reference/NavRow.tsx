import * as React from "react";

/**
 * NavRow. The sidebar row at every depth. Decided 14 Oct 2026 (L), frame
 * "Nav chrome"; measured live 15 Oct (the --nav-* tokens).
 *
 * "You are here" is the acid catch loop, drawn over the active row in 900ms
 * with --ease-catch, plus a sunk fill and weight 600 as support. One marked
 * carrier per surface. The board glyph is tinted by the board hue; the label,
 * the fill and the pencil indent are never tinted.
 *
 * This is the exact code. Every value is a CSS variable from
 * src/design/tokens.css. The app's SidebarNav rows, NavActiveCatch and the
 * .lasso-sidebar-nav rules copy these values and do not re-interpret them.
 * The Magic Patterns design system "Lasso" carries a byte-identical copy at
 * components/NavRow/index.tsx.
 */

export const CATCH_PATH = "M206 9C180 2 96 1 46 7 11 11 4 24 20 31c20 9 112 10 164 2 34-5 52-14 40-22-9-6-33-9-62-9-9 0-14 1-18 3";

/** The hand-drawn indent on a nested row. Copied, never redrawn. */
const INDENT_PATH = "M5 0 C 5.5 4.2, 4.4 8.1, 5.3 11.6 C 5.9 14.1, 8.6 13.5, 11.2 13.8 C 15.4 14.2, 19.8 13.6, 24 14.1";

export type NavRowProps = {
  label: string;
  /** A 24-viewBox path for the row glyph. */
  icon?: string;
  active?: boolean;
  /** Nesting depth; each level adds the pencil indent. */
  depth?: 0 | 1 | 2;
  /** Board hue index 0 to 7. Tints the glyph only. */
  hue?: number;
  /** Trailing count, mono. Never a badge that counts toward zero. */
  count?: number;
  onClick?: () => void;
};

const Indent = () => (
  <svg width="26" height="18" viewBox="0 0 28 20" aria-hidden style={{ flexShrink: 0, color: "var(--line-pencil)" }}>
    <path d={INDENT_PATH} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const Catch = () => (
  <svg viewBox="0 0 240 40" preserveAspectRatio="none" aria-hidden
    style={{ position: "absolute", left: -7, right: -7, top: -5, bottom: -5, width: "calc(100% + 14px)", height: "calc(100% + 10px)", overflow: "visible", pointerEvents: "none", zIndex: 1 }}>
    <path d={CATCH_PATH} pathLength={1} fill="none" stroke="var(--hand-live)" strokeWidth={2.6} strokeLinecap="round" vectorEffect="non-scaling-stroke"
      style={{ strokeDasharray: 1, strokeDashoffset: 1, animation: "lasso-catch var(--dur-catch) var(--ease-catch) both" }} />
  </svg>
);

export const NavRow = ({ label, icon, active, depth = 0, hue, count, onClick }: NavRowProps) => {
  const [hover, setHover] = React.useState(false);
  const hueInk = hue === undefined ? undefined : `var(--board-hue-${Math.max(0, Math.min(7, hue))}-ink)`;
  return (
    <a
      href="#"
      aria-current={active ? "page" : undefined}
      onClick={(e) => { e.preventDefault(); onClick?.(); }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative", display: "flex", alignItems: "center", gap: 8,
        padding: "var(--nav-row-padding-block) var(--nav-row-padding-inline)",
        paddingLeft: depth ? 0 : "var(--nav-row-padding-inline)",
        borderRadius: "var(--radius-md-new)",
        border: "var(--border-weight) solid transparent",
        background: active ? "var(--surface-sunk)" : hover ? "var(--surface-sunk-2)" : "transparent",
        fontFamily: "var(--font-sans)", fontSize: "var(--nav-row-size)",
        fontWeight: active ? "var(--nav-active-weight)" : "var(--nav-row-weight)",
        color: active ? "var(--text-primary)" : "var(--text-secondary)",
        textDecoration: "none", minHeight: 32,
      } as React.CSSProperties}
    >
      {active ? <Catch /> : null}
      {Array.from({ length: depth }).map((_, i) => <Indent key={i} />)}
      {icon ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0, color: hueInk ?? "currentColor" }}><path d={icon} /></svg>
      ) : null}
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      {count !== undefined ? <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)" }}>{count}</span> : null}
    </a>
  );
};

export const NAV_ICONS = {
  home: "M4 10.5 12 4l8 6.5V20H4z",
  work: "M4 7h16v13H4zM9 7V4.5h6V7",
  conversations: "M4 5h16v11H9l-5 4z",
  client: "M4 5h16v14H4zM4 9.5h16",
  workboard: "M4 5h16v14H4zM4 9.5h16M9.5 9.5V19",
  history: "M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4M12 8v4.5l3 1.8",
  coach: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0",
} as const;

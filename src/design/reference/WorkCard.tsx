import * as React from "react";
import { useState } from "react";

/**
 * WorkCard. THE decided card, face G. Decided 13 to 14 Oct 2026 (L), built on
 * the board as WC-3 and in the All work lane as WC-5. This is the exact code:
 * every value is a CSS variable from src/design/tokens.css. The Magic Patterns
 * design system "Lasso" carries a byte-identical copy at
 * components/WorkCard/index.tsx.
 *
 * Port rule for the app: copy these values into the lane and board card CSS.
 * Do not re-interpret. If a value here and a value in the app disagree, this
 * file is the spec until a DESIGN-DECISIONS.md row says otherwise.
 *
 * Anatomy, top to bottom:
 *   stripe     3px left, the SOURCE brand colour. Never a board hue.
 *   mirror     104px, a miniature of the source, authored at 420x240 and
 *              scaled 0.5 so type keeps its proportions. Empty is correct.
 *   header     11px source dot, mono 8.5px label, 8px date
 *   title      sans 12.5px weight 600, two lines then clipped
 *   footer     mono 8px provenance, board chip; dashed on No board
 *   No board   hatched 9px spine where the stripe would be, pencil border,
 *              page background, no shadow, lock plus "No board"
 */

export type WorkCardItem = {
  id: string;
  /** Source brand colour: the stripe and the dot. Never a board hue. */
  brand: string;
  /** Source label: Claude, Google Slides, Granola, Uploaded by you. */
  label: string;
  title: string;
  summary?: string;
  file?: { name: string; detail: string };
  /** Provenance line: "34 turns, 6 tool steps", "docs.google.com". Empty is allowed. */
  prov: string;
  board?: string;
  date?: string;
  /** false renders the No board treatment. */
  onBoard: boolean;
};

export type WorkCardProps = {
  item: WorkCardItem;
  /** Context on a board: acid outline. Pair with dimmed on every other card. */
  inHand?: boolean;
  /** The spotlight: 30 percent when another card is in hand. */
  dimmed?: boolean;
  /** false gives the neutral face (summary text instead of the mirror). */
  mirror?: boolean;
  width?: number | string;
  onClick?: () => void;
};

const Lock = ({ s = 9 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <rect x="4" y="10.5" width="16" height="10" rx="2" />
    <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
  </svg>
);

/** The source mirror. A miniature of the source, never an invented one. */
const Mirror = ({ item }: { item: WorkCardItem }) => (
  <div style={{ position: "absolute", inset: 0, width: 420, height: 240, transform: "scale(.5)", transformOrigin: "0 0", overflow: "hidden", background: "var(--surface-raised)", fontFamily: "var(--font-sans)" }}>
    {item.file ? (
      <div style={{ height: "100%", background: "var(--neutral-60)", display: "grid", placeItems: "start center", padding: 14 }}>
        <div style={{ width: 186, height: "100%", background: "var(--surface-raised)", boxShadow: "var(--shadow-float)", padding: "20px 22px" }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "var(--text-primary)" }}>{item.title.replace(/\.[a-z]+$/i, "")}</p>
          {[100, 94, 97, 62, 100, 88].map((w, n) => (
            <span key={n} style={{ display: "block", height: 4, width: `${w}%`, background: "var(--line-hairline)", marginTop: n === 3 ? 12 : 7, borderRadius: 2 }} />
          ))}
        </div>
      </div>
    ) : (
      <div style={{ height: "100%", background: "var(--surface-page)", padding: "16px 18px" }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.25 }}>{item.title}</p>
        <div style={{ height: 1, background: "var(--line-hairline)", margin: "12px 0" }} />
        <p style={{ margin: 0, fontSize: 10, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--text-muted)" }}>You</p>
        <div style={{ marginTop: 5, background: "var(--surface-sunk-2)", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, lineHeight: 1.45, color: "var(--text-primary)" }}>
          {(item.summary ?? "").slice(0, 86)}
        </div>
        <p style={{ margin: "12px 0 0", fontSize: 10, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--text-muted)" }}>{item.label}</p>
        <p style={{ margin: "5px 0 0", fontSize: 12.5, lineHeight: 1.5, color: "var(--text-primary)" }}>{(item.summary ?? "").slice(86, 210)}</p>
      </div>
    )}
  </div>
);

export const WorkCard = ({ item, inHand, dimmed, mirror = true, width, onClick }: WorkCardProps) => {
  const [hover, setHover] = useState(false);
  const um = !item.onBoard;
  const MONO = "var(--font-mono)";
  const SANS = "var(--font-sans)";

  return (
    <article
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative", display: "flex", flexDirection: "column",
        width: width ?? "100%", overflow: "hidden", cursor: "pointer",
        border: `var(--border-weight) solid ${um ? "var(--line-pencil)" : "var(--line-strong)"}`,
        borderRadius: "var(--radius-sm-new)",
        background: um ? "var(--surface-page)" : "var(--surface-raised)",
        boxShadow: um ? "var(--shadow-flat)" : hover ? "var(--shadow-float)" : "var(--shadow-card-new)",
        outline: inHand ? "2px solid var(--hand-live)" : "none",
        outlineOffset: 2,
        opacity: dimmed ? .3 : 1,
        transform: hover && !dimmed ? "translateY(-1px)" : undefined,
        transition: "transform var(--dur-quick) var(--ease-standard), opacity var(--dur-quick) var(--ease-standard), box-shadow var(--dur-quick) var(--ease-standard)",
      }}
    >
      {um ? (
        <span aria-hidden style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 9, background: "repeating-linear-gradient(135deg, transparent 0 4px, var(--line-pencil) 4px 5px)", borderRight: "var(--border-weight) solid var(--line-hairline)", zIndex: 2 }} />
      ) : (
        <span aria-hidden style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: item.brand, zIndex: 2 }} />
      )}

      {mirror ? (
        <div style={{ position: "relative", height: 104, flexShrink: 0, overflow: "hidden", marginLeft: um ? 9 : 3, borderBottom: "var(--border-weight) solid var(--line-hairline)", filter: um ? "saturate(.2) opacity(.72)" : "none" }}>
          <Mirror item={item} />
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, padding: "8px 10px 8px", paddingLeft: um ? 17 : 11 }}>
        <header style={{ display: "flex", alignItems: "center", gap: 7, minHeight: 16, flexShrink: 0 }}>
          <span style={{ width: 11, height: 11, borderRadius: "var(--radius-pill)", background: um ? "transparent" : item.brand, border: um ? "var(--border-weight) solid var(--line-pencil)" : "none", flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: MONO, fontSize: 8.5, fontWeight: 500, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--text-muted)" }}>{item.label}</span>
          {item.date ? <span style={{ flexShrink: 0, fontFamily: MONO, fontSize: 8, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--line-pencil)" }}>{item.date}</span> : null}
        </header>

        <p style={{ margin: "6px 0 0", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", fontFamily: SANS, fontSize: 12.5, fontWeight: 600, lineHeight: 1.22, letterSpacing: "-.006em", color: "var(--text-primary)" }}>
          {item.title}
        </p>

        {!mirror ? (
          <p style={{ margin: "6px 0 0", flex: 1, minHeight: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", fontFamily: SANS, fontSize: 10.5, lineHeight: 1.5, color: "var(--text-secondary)" }}>
            {item.summary ?? (item.file ? `${item.file.name} · ${item.file.detail}` : "")}
          </p>
        ) : null}

        <footer style={{ marginTop: 6, display: "flex", minHeight: 16, flexShrink: 0, alignItems: "center", gap: 6, borderTop: `var(--border-weight) ${um ? "dashed" : "solid"} ${um ? "var(--state-no-board)" : "var(--line-hairline)"}`, paddingTop: 5 }}>
          {um ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: MONO, fontSize: 8, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--text-secondary)" }}>
              <Lock />No board
            </span>
          ) : (
            <>
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: MONO, fontSize: 8, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--line-pencil)" }}>{item.prov}</span>
              {item.board ? (
                <span style={{ flexShrink: 0, maxWidth: "50%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: MONO, fontSize: 8, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--text-secondary)" }}>{item.board}</span>
              ) : null}
            </>
          )}
        </footer>
      </div>
    </article>
  );
};

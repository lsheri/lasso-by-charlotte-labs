import * as React from "react";

/**
 * AskDock. The Ask Lasso panel: a right dock beside the board. Decided 14 Oct
 * 2026 (L), frame "Tools + Ask Lasso". Tabs carry the 2.5px acid bottom rule
 * (never the catch, never a filled pill). The reading state is beads on the
 * rope, never a spinner. The dock says what it reads: only what is in hand.
 *
 * This is the exact code. Every value is a CSS variable from
 * src/design/tokens.css. AskDock.tsx in the app is pinned by a source test, so
 * the port lands as className and token changes, never structure. The Magic
 * Patterns design system "Lasso" carries a byte-identical copy at
 * components/AskDock/index.tsx.
 */

export type AskTab = "Messages" | "History" | "New chat";

export type AskDockProps = {
  inHand: number;
  boardName: string;
  tab: AskTab;
  onTab: (t: AskTab) => void;
  reading?: boolean;
  question?: string;
  answer?: React.ReactNode;
  onClose?: () => void;
  width?: number;
};

const LOOP = "M38 7C33 2 14 1 7 5 1 8 1 15 6 18c6 4 24 4 32 1 7-2 10-6 7-9-2-3-8-4-15-4-2 0-3 0-4 1";

export const ReadingBeads = () => (
  <span aria-hidden style={{ position: "relative", display: "inline-block", width: 44, height: 24, flexShrink: 0 }}>
    <svg viewBox="0 0 44 24" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}><path d={LOOP} fill="none" stroke="var(--hand-live)" strokeWidth="1.1" opacity=".55" /></svg>
    {[0, 1, 2].map((i) => (
      <span key={i} style={{ position: "absolute", left: 0, top: 0, width: 3.5, height: 3.5, borderRadius: "var(--radius-pill)", background: "var(--hand-live)", offsetPath: `path("${LOOP}")`, offsetRotate: "0deg", offsetDistance: `${i * 33.333}%`, animation: "lasso-beads 2600ms linear infinite", animationDelay: `${-i * 867}ms` } as React.CSSProperties} />
    ))}
  </span>
);

const MONO: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--text-secondary)" };

export const AskDock = ({ inHand, boardName, tab, onTab, reading, question, answer, onClose, width = 360 }: AskDockProps) => (
  <aside aria-label="Ask Lasso" style={{ width, height: "100%", display: "flex", flexDirection: "column", background: "var(--surface-raised)", borderLeft: "var(--border-weight) solid var(--line-hairline)", fontFamily: "var(--font-sans)" }}>
    <header style={{ padding: "16px 16px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 400, color: "var(--text-primary)" }}>Ask Lasso</h2>
        {onClose ? <button type="button" onClick={onClose} style={{ ...MONO, border: 0, background: "transparent", cursor: "pointer", color: "var(--text-muted)" }}>Close</button> : null}
      </div>
      <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6, border: "var(--border-weight) solid var(--line-hairline)", borderRadius: "var(--radius-pill)", padding: "3px 9px", ...MONO }}>
        <span aria-hidden style={{ width: 6, height: 6, borderRadius: "var(--radius-pill)", background: "var(--hand-live)" }} />
        {inHand} in hand · {boardName}
      </div>
      <div role="tablist" aria-label="Ask Lasso" style={{ marginTop: 14, display: "flex", gap: 18, borderBottom: "var(--border-weight) solid var(--line-hairline)" }}>
        {(["Messages", "History", "New chat"] as AskTab[]).map((t) => {
          const on = t === tab;
          return (
            <button key={t} role="tab" aria-selected={on} onClick={() => onTab(t)} type="button"
              style={{ border: 0, background: "transparent", padding: "6px 2px 8px", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: on ? 600 : 400, color: on ? "var(--text-primary)" : "var(--text-secondary)", boxShadow: on ? "inset 0 calc(-1 * var(--here-weight)) 0 0 var(--here-rule)" : "none" }}>
              {t}
            </button>
          );
        })}
      </div>
    </header>
    <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      {question ? <div style={{ alignSelf: "flex-end", maxWidth: "88%", background: "var(--surface-sunk)", borderRadius: "var(--radius-md-new)", padding: "10px 12px", fontSize: 13.5, lineHeight: 1.5, color: "var(--text-primary)" }}>{question}</div> : null}
      {reading ? <div style={{ display: "flex", alignItems: "center", gap: 8 }}><ReadingBeads /><span style={MONO}>Lasso is reading</span></div> : null}
      {answer ? <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--text-primary)" }}>{answer}</div> : null}
    </div>
    <footer style={{ padding: "0 16px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, border: "var(--border-weight) solid var(--line-hairline)", borderRadius: "var(--radius-md-new)", padding: "8px 8px 8px 12px", background: "var(--surface-raised)" }}>
        <span style={{ flex: 1, fontSize: 13.5, color: "var(--text-muted)" }}>Ask about the {inHand} in hand</span>
        <span aria-hidden style={{ width: 28, height: 28, borderRadius: "var(--radius-pill)", background: "var(--hand-live)", display: "grid", placeItems: "center", color: "var(--text-on-acid)" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l16-8-6 8 6 8z" /></svg>
        </span>
      </div>
      <p style={{ ...MONO, margin: "8px 0 0", fontSize: 8.5, color: "var(--text-muted)" }}>Lasso reads only what is in hand</p>
    </footer>
  </aside>
);

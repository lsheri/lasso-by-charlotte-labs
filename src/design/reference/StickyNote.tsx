import * as React from "react";

/**
 * StickyNote. A note on the board, in Lasso's hand face. Decided 14 Oct 2026
 * (L), frame "Board canvas". A sticky is an OBJECT: it can be dragged, it lifts
 * and tilts on hover with the spring. It is never styled as a button.
 *
 * This is the exact code. Every value is a CSS variable from
 * src/design/tokens.css (--sticky-paper and --shadow-sticky were added for it
 * on 15 Oct). The Magic Patterns design system "Lasso" carries a
 * byte-identical copy at components/StickyNote/index.tsx.
 */

export type StickyNoteProps = {
  children: React.ReactNode;
  width?: number;
  rotate?: number;
  dimmed?: boolean;
  onClick?: () => void;
};

export const StickyNote = ({ children, width = 150, rotate = -1, dimmed, onClick }: StickyNoteProps) => {
  const [hover, setHover] = React.useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        width, minHeight: 104, padding: "11px 12px", cursor: "grab",
        background: "var(--sticky-paper)",
        boxShadow: "var(--shadow-sticky)",
        transform: `rotate(${rotate}deg)${hover && !dimmed ? " translateY(-2px)" : ""}`,
        transition: "transform var(--dur-quick) var(--ease-spring)",
        opacity: dimmed ? .35 : 1,
      }}>
      <p style={{ margin: 0, fontFamily: "var(--font-hand)", fontSize: 15, lineHeight: 1.2, color: "var(--text-primary)" }}>{children}</p>
    </div>
  );
};

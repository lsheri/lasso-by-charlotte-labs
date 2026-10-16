import * as React from "react";

/**
 * Button. Decided 14 Oct 2026 (L): 5px radius, one primary per screen.
 * Primary is flat ink with no shadow (confirmed by L 15 Oct; the graphite
 * grain and acid offset shadow do not return). Secondary is outlined and never
 * filled. Destructive is the only control that fills on hover. Links take the
 * acid underline draw. Every button presses 1px on activation.
 *
 * This is the exact code. Every value is a CSS variable from
 * src/design/tokens.css. The app's ui/button.tsx and the .lasso-action class
 * copy these values and do not re-interpret them. The Magic Patterns design
 * system "Lasso" carries a byte-identical copy at components/Button/index.tsx.
 */

export type ButtonKind = "primary" | "secondary" | "destructive" | "link";
export type ButtonSize = "sm" | "md";

export type ButtonProps = {
  kind?: ButtonKind;
  size?: ButtonSize;
  disabled?: boolean;
  /** Reading state: three beads replace the label's leading space. Never a spinner. */
  working?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
};

const Beads = () => (
  <span aria-hidden style={{ position: "relative", display: "inline-block", width: 22, height: 12, flexShrink: 0 }}>
    {[0, 1, 2].map((i) => (
      <span key={i} style={{ position: "absolute", left: 0, top: 4, width: 3.5, height: 3.5, borderRadius: "var(--radius-pill)", background: "currentColor", offsetPath: 'path("M19 3.5C16.5 1 7 .5 3.5 2.5.5 4 .5 7.5 3 9c3 2 12 2 16 .5 3.5-1 5-3 3.5-4.5-1-1.5-4-2-7.5-2-1 0-1.5 0-2 .5")', offsetRotate: "0deg", offsetDistance: `${i * 33.333}%`, animation: "lasso-beads 2600ms linear infinite", animationDelay: `${-i * 867}ms` } as React.CSSProperties} />
    ))}
  </span>
);

export const Button = ({ kind = "secondary", size = "md", disabled, working, children, onClick }: ButtonProps) => {
  const [pressed, setPressed] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  const pad = size === "sm" ? "6px 12px" : "9px 17px";
  const fs = size === "sm" ? 12.5 : 13;

  const base: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 7,
    borderRadius: "var(--radius-md-new)", padding: pad,
    fontFamily: "var(--font-sans)", fontSize: fs, fontWeight: 600, lineHeight: 1.2,
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? .4 : 1,
    transform: pressed && !disabled ? "translateY(1px)" : undefined,
    transition: "transform 90ms var(--ease-standard), background var(--dur-quick) var(--ease-standard), color var(--dur-quick) var(--ease-standard), border-color var(--dur-quick) var(--ease-standard)",
    boxShadow: "var(--btn-shadow)",
  };

  const kinds: Record<ButtonKind, React.CSSProperties> = {
    primary: { background: "var(--action-primary)", color: "var(--action-primary-fg)", border: "var(--border-weight) solid transparent" },
    secondary: { background: "transparent", color: "var(--text-primary)", border: "1.5px solid var(--line-strong)" },
    destructive: { background: hover && !disabled ? "var(--state-destructive-new)" : "transparent", color: hover && !disabled ? "var(--text-on-inverse)" : "var(--state-destructive-new)", border: "1.5px solid var(--state-destructive-new)" },
    link: { background: `linear-gradient(var(--hand-live), var(--hand-live)) no-repeat left bottom / ${hover ? "100%" : "0%"} 2px`, color: "var(--text-primary)", border: 0, padding: "0 1px", borderRadius: 0, transition: "background-size 180ms var(--ease-standard)" },
  };

  return (
    <button
      type="button"
      disabled={disabled}
      aria-busy={working || undefined}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{ ...base, ...kinds[kind] }}
    >
      {working ? <Beads /> : null}
      {children}
    </button>
  );
};

import * as React from "react";

/**
 * SettingsDialog. The shell only: backdrop, panel, rail, content. Decided
 * 14 Oct 2026 (L), frame "Settings + entry"; built as PRIM-2 on 15 Oct and
 * this file matches that build. Sections are the app's; this file never
 * invents one.
 *
 * "You are here" on the rail is the 2.5px acid inset rule, never the catch.
 * On phones (hover: none or max-width 767px) the rail becomes a horizontal
 * strip with a bottom rule under the current item.
 *
 * This is the exact code. Every value is a CSS variable from
 * src/design/tokens.css. The Magic Patterns design system "Lasso" carries a
 * byte-identical copy at components/SettingsDialog/index.tsx.
 */

export type SettingsSection = { id: string; label: string; hint?: string; group: string };

export type SettingsDialogProps = {
  open: boolean;
  title?: string;
  sections: SettingsSection[];
  current: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  children: React.ReactNode;
  /** Render as the phone layout. */
  phone?: boolean;
};

export const SettingsDialog = ({ open, title = "Settings", sections, current, onSelect, onClose, children, phone }: SettingsDialogProps) => {
  if (!open) return null;
  const groups = Array.from(new Set(sections.map((s) => s.group)));
  return (
    <div role="dialog" aria-modal="true" aria-label={title} style={{ position: "fixed", inset: 0, zIndex: 50 }}>
      <div onClick={onClose} aria-hidden style={{ position: "absolute", inset: 0, background: "color-mix(in srgb, var(--surface-inverse) 26%, transparent)" }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: phone ? 12 : 28, pointerEvents: "none" }}>
        <div style={{ pointerEvents: "auto", width: "100%", maxWidth: 940, height: phone ? "min(620px, calc(100dvh - 24px))" : "min(620px, calc(100dvh - 56px))", display: "flex", flexDirection: phone ? "column" : "row", overflow: "hidden", borderRadius: 10, background: "var(--surface-raised)", boxShadow: "var(--shadow-dialog)" }}>
          <nav aria-label="Settings sections" style={{ width: phone ? "100%" : 232, flexShrink: 0, borderRight: phone ? 0 : "1px solid var(--line-hairline)", borderBottom: phone ? "1px solid var(--line-hairline)" : 0, background: "var(--surface-page)", padding: "18px 10px", display: phone ? "flex" : "grid", gap: phone ? 8 : 14, alignContent: "start", alignItems: "center", overflow: "auto", whiteSpace: phone ? "nowrap" : "normal" }}>
            <h2 style={{ margin: "0 0 0 9px", fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 400, color: "var(--text-primary)", flexShrink: 0 }}>{title}</h2>
            {groups.map((g) => (
              <div key={g} style={{ display: phone ? "contents" : "block" }}>
                <p style={{ margin: "0 0 4px 9px", fontFamily: "var(--font-hand)", fontSize: 14, color: "var(--text-secondary)", flexShrink: 0 }}>{g}</p>
                <div style={{ display: phone ? "contents" : "grid", gap: 1 }}>
                  {sections.filter((s) => s.group === g).map((s) => {
                    const on = s.id === current;
                    return (
                      <button key={s.id} type="button" aria-current={on || undefined} onClick={() => onSelect(s.id)}
                        style={{ display: "flex", alignItems: "center", gap: 9, border: 0, borderRadius: "var(--radius-md-new)", padding: "7px 9px", cursor: "pointer", textAlign: "left", fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: on ? 600 : 400, color: on ? "var(--text-primary)" : "var(--text-secondary)", background: on ? "var(--surface-sunk)" : "transparent", boxShadow: on ? (phone ? "inset 0 calc(-1 * var(--here-weight)) 0 0 var(--here-rule)" : "inset var(--here-weight) 0 0 0 var(--here-rule)") : "none", flexShrink: 0 }}>
                        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, padding: "22px 26px 26px", overflow: "auto" }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 400, color: "var(--text-primary)" }}>{sections.find((s) => s.id === current)?.label}</h2>
            <div style={{ marginTop: 7 }}>{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

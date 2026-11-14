import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useRef, useState } from "react";

import { NAV_ICONS, NavRow } from "@/design/reference/NavRow";
import { TOOL_PATHS, ToolButton, Toolbar } from "@/design/reference/Toolbar";

/** The roles a skin sets, in reading order. Values are read live, so this page never drifts from the CSS. */
const ROLES = [
  "--surface-page",
  "--surface-raised",
  "--surface-sunk",
  "--text-primary",
  "--text-secondary",
  "--text-muted",
  "--line-hairline",
  "--line-pencil",
  "--action-primary",
  "--focus-ring",
  "--state-on-record",
  "--wrap-mark",
  "--selection",
  "--state-highlight",
  "--here-rule",
  "--live",
  "--ask-live",
] as const;

function hex(value: string): string | null {
  const rgb = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(value);
  if (rgb)
    return `#${rgb
      .slice(1, 4)
      .map((n) => Number(n).toString(16).padStart(2, "0"))
      .join("")}`;
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : null;
}

function luminance(h: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** One skin, framed: its swatches with contrast against the raised surface, and the reference pieces in it. */
function SkinColumn({ skin }: { skin: string }) {
  const probe = useRef<HTMLDivElement>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!probe.current) return;
    const resolved: Record<string, string> = {};
    for (const role of ROLES) {
      // Resolve through a real property so var() chains and color-mix() come back as rgb().
      probe.current.style.color = `var(${role})`;
      resolved[role] = getComputedStyle(probe.current).color;
    }
    probe.current.style.color = "";
    setValues(resolved);
  }, [skin]);
  const raised = hex(values["--surface-raised"] ?? "") ?? "#ffffff";
  return (
    <div data-skin={skin}>
      <div
        data-lasso="on"
        style={{
          background: "var(--surface-page)",
          color: "var(--text-primary)",
          padding: 20,
          borderRadius: 4,
          border: "1px solid var(--line-hairline)",
          fontFamily: "var(--font-sans)",
        }}
      >
        <div ref={probe} />
        <h3 style={{ margin: "0 0 12px", fontSize: 16, textTransform: "capitalize" }}>{skin}</h3>
        <div style={{ display: "grid", gap: 6, marginBottom: 20 }}>
          {ROLES.map((role) => {
            const h = hex(values[role] ?? "");
            const ratio = h ? contrast(h, raised) : null;
            return (
              <div
                key={role}
                style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 22,
                    height: 22,
                    flex: "none",
                    borderRadius: 3,
                    border: "1px solid var(--line-hairline)",
                    background: `var(${role})`,
                  }}
                />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, flex: 1 }}>
                  {role}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--text-secondary)",
                  }}
                >
                  {h ?? "?"}
                  {ratio !== null ? `  ${ratio.toFixed(2)}:1` : ""}
                </span>
              </div>
            );
          })}
        </div>
        <div style={{ width: 260, display: "grid", gap: 2, marginBottom: 16 }}>
          <NavRow label="Home" icon={NAV_ICONS.home} />
          <NavRow label="Q4 planning" icon={NAV_ICONS.workboard} depth={1} hue={3} active />
          <NavRow label="Conversations" icon={NAV_ICONS.conversations} count={12} />
        </div>
        <Toolbar>
          {(Object.keys(TOOL_PATHS) as (keyof typeof TOOL_PATHS)[]).map((name, i) => (
            <ToolButton key={name} d={TOOL_PATHS[name]} label={name} held={i === 0} />
          ))}
        </Toolbar>
      </div>
    </div>
  );
}

function SkinsSideBySide() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
        gap: 24,
      }}
    >
      <SkinColumn skin="lasso" />
      <SkinColumn skin="charlotte" />
    </div>
  );
}

/**
 * Both skins at once. Contrast is against each skin's raised surface. Lime reads about 1.4:1 by design:
 * it marks live things and underlines, never focus, text or state.
 */
const meta = {
  title: "Foundations/Skins",
  component: SkinsSideBySide,
  // The page frame stays Lasso so the Lasso column is not inside a Charlotte ancestor.
  globals: { skin: "lasso" },
} satisfies Meta<typeof SkinsSideBySide>;

export default meta;
export const SideBySide: StoryObj<typeof meta> = {};

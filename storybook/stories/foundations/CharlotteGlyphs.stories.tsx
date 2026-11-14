import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";

import { GraphiteIcon, ICON_NAMES } from "@/components/notebook/icons";
import { CHARLOTTE_GLYPHS } from "@/design/icons/charlotte";
import { CHARLOTTE_EXTRA_GLYPHS, CHARLOTTE_EXTRA_NAMES } from "@/design/icons/charlotte-extra";
import { CHARLOTTE_KINDS, KIND_FAMILIES, type KindFamily } from "@/design/icons/charlotte-kinds";
import { ExhibitIcon } from "@/design/icons/ExhibitIcon";

const SIZES = [12, 16, 18, 20] as const;

/** A Charlotte frame inside the page, so a Lasso row and a Charlotte row can sit in one tile. */
function Charlotte({ children }: { children: ReactNode }) {
  return (
    <div data-skin="charlotte">
      <div
        data-lasso="on"
        style={{ background: "var(--surface-raised)", color: "var(--text-primary)" }}
      >
        {children}
      </div>
    </div>
  );
}

const tile = {
  margin: 0,
  padding: 12,
  background: "var(--surface-raised)",
  border: "1px solid var(--line-hairline)",
  borderRadius: "var(--radius-md-new)",
} as const;
const row = { display: "flex", alignItems: "end", gap: 12, minHeight: 24 } as const;
const tag = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--text-muted)",
  width: 56,
} as const;
const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
  gap: 8,
} as const;
const page = { fontFamily: "var(--font-sans)", color: "var(--text-primary)" } as const;
const note = { margin: "0 0 16px", fontSize: 13, color: "var(--text-secondary)" } as const;

/** Every glyph, Lasso above Charlotte, read from ICON_NAMES so the two sets cannot drift apart. */
function SideBySide() {
  return (
    <div style={page}>
      <p style={note} data-testid="glyph-count">
        {ICON_NAMES.length} glyphs. Lasso: stroke 1.75. Charlotte (Exhibit): stroke 1.5. Both on a
        20px grid, at {SIZES.join(", ")}px.
      </p>
      <div style={grid}>
        {ICON_NAMES.map((name) => (
          <figure key={name} data-glyph={name} style={tile}>
            <div style={row}>
              <span style={tag}>lasso</span>
              {SIZES.map((size) => (
                <GraphiteIcon key={size} name={name} size={size} animate={false} />
              ))}
            </div>
            <Charlotte>
              <div style={{ ...row, marginTop: 8 }} data-exhibit={name}>
                <span style={tag}>charlotte</span>
                {SIZES.map((size) => (
                  <ExhibitIcon key={size} d={CHARLOTTE_GLYPHS[name]} size={size} />
                ))}
              </div>
            </Charlotte>
            <figcaption style={{ marginTop: 10, fontSize: 12 }}>{name}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

/** The 10 names Charlotte drew first. Since PR4b they are shared names with a Lasso path too, so they also appear in the full set above. */
function Extras() {
  return (
    <Charlotte>
      <div style={{ ...page, padding: 16 }}>
        <p style={note}>
          {CHARLOTTE_EXTRA_NAMES.length} glyphs Charlotte drew first. Shared names since PR4b.
        </p>
        <div style={grid}>
          {CHARLOTTE_EXTRA_NAMES.map((name) => (
            <figure key={name} data-exhibit={name} style={tile}>
              <div style={row}>
                {SIZES.map((size) => (
                  <ExhibitIcon key={size} d={CHARLOTTE_EXTRA_GLYPHS[name]} size={size} />
                ))}
              </div>
              <figcaption style={{ marginTop: 10, fontSize: 12 }}>{name}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </Charlotte>
  );
}

/** The 12 work kinds, grouped into their 6 families. Family colours wait for the --t-* tokens. */
function Kinds() {
  const families = Object.keys(KIND_FAMILIES) as KindFamily[];
  return (
    <Charlotte>
      <div style={{ ...page, padding: 16 }}>
        <p style={note}>
          {CHARLOTTE_KINDS.length} kinds in {families.length} families. Colours are pending: each
          family will read a --t-* token.
        </p>
        <div style={{ display: "grid", gap: 16 }}>
          {families.map((family) => (
            <section key={family} data-family={family}>
              <h4 style={{ margin: "0 0 6px", fontSize: 12 }}>
                {KIND_FAMILIES[family].label}{" "}
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "var(--text-muted)",
                  }}
                >
                  {KIND_FAMILIES[family].token}
                </span>
              </h4>
              <div style={grid}>
                {CHARLOTTE_KINDS.filter((k) => k.family === family).map((kind) => (
                  <figure key={kind.label} data-kind={kind.label} style={tile}>
                    <div style={row}>
                      {SIZES.map((size) => (
                        <ExhibitIcon key={size} d={kind.d} size={size} />
                      ))}
                    </div>
                    <figcaption style={{ marginTop: 10, fontSize: 12 }}>{kind.label}</figcaption>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{kind.source}</div>
                  </figure>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </Charlotte>
  );
}

const meta = {
  title: "Foundations/Charlotte glyphs",
  component: SideBySide,
  // The page frame stays Lasso; Charlotte rows carry their own skin frame.
  globals: { skin: "lasso" },
} satisfies Meta<typeof SideBySide>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Glyphs: Story = {};
export const CharlotteOnly: Story = { render: () => <Extras /> };
export const WorkKinds: Story = { render: () => <Kinds /> };

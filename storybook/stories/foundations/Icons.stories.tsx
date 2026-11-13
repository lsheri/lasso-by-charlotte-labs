import type { Meta, StoryObj } from "@storybook/react-vite";

import { GraphiteIcon, ICON_NAMES, getIconSignature } from "@/components/notebook/icons";

/** Every GraphiteIcon glyph, read from ICON_NAMES so a new glyph appears here with no story change. */
function GlyphGrid({ sizes, animate }: { sizes: readonly number[]; animate: boolean }) {
  return (
    <div style={{ fontFamily: "var(--font-sans)", color: "var(--text-primary)" }}>
      <p
        style={{ margin: "0 0 16px", fontSize: 13, color: "var(--text-secondary)" }}
        data-testid="glyph-count"
      >
        {ICON_NAMES.length} glyphs, 20px grid, stroke 1.75
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          gap: 8,
        }}
      >
        {ICON_NAMES.map((name) => (
          <figure
            key={name}
            data-glyph={name}
            style={{
              margin: 0,
              padding: 12,
              background: "var(--surface-raised)",
              border: "1px solid var(--line-hairline)",
              borderRadius: "var(--radius-md-new)",
            }}
          >
            <div style={{ display: "flex", alignItems: "end", gap: 12, minHeight: 28 }}>
              {sizes.map((size) => (
                <GraphiteIcon
                  key={size}
                  name={name}
                  size={size}
                  animate={animate}
                  playOnMount={animate}
                />
              ))}
            </div>
            <figcaption style={{ marginTop: 10, fontSize: 12 }}>{name}</figcaption>
            <div
              style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)" }}
            >
              {getIconSignature(name)}
            </div>
          </figure>
        ))}
      </div>
    </div>
  );
}

const meta = {
  title: "Foundations/Icons",
  component: GlyphGrid,
  args: { sizes: [16, 20, 24], animate: false },
} satisfies Meta<typeof GlyphGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

/** At rest, as most rows show them. */
export const Still: Story = {};

/** Each glyph plays its signature stroke once on mount. Reduced motion stills it, as in the app. */
export const Signature: Story = { args: { animate: true } };

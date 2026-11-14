import type { Meta, StoryObj } from "@storybook/react-vite";

import { screensGrid, type Band } from "./screens-grid";

/** Every baseline picture, found by folder: tests/e2e/__baseline__/<skin>/<viewport>/<surface>.png */
const PICTURES = import.meta.glob<string>("../../../tests/e2e/__baseline__/*/*/*.png", {
  eager: true,
  query: "?url",
  import: "default",
});

const SKIN_LABEL: Record<string, string> = { lasso: "Lasso", charlotte: "Charlotte" };

const VIEWPORT_LABEL: Record<string, string> = {
  "desktop-1280": "Desktop, 1280px",
  "phone-375": "Phone, 375px",
};

/** Desktop pictures show at half size, phone pictures at full size, so a row fits one screen. */
const SCALE: Record<string, number> = { "desktop-1280": 0.5, "phone-375": 1 };

function Pending({
  width,
  height,
  auth,
  lassoOnly,
}: {
  width: number;
  height: number;
  auth: boolean;
  lassoOnly: boolean;
}) {
  return (
    <div
      style={{
        width,
        height,
        display: "grid",
        placeItems: "center",
        textAlign: "center",
        padding: 16,
        boxSizing: "border-box",
        border: "1px dashed var(--line-pencil)",
        borderRadius: 4,
        background:
          "repeating-linear-gradient(45deg, var(--surface-sunk) 0 6px, transparent 6px 12px)",
        color: "var(--text-secondary)",
        fontSize: 12,
      }}
    >
      {lassoOnly ? "Lasso only" : "Pending"}
      <br />
      {lassoOnly
        ? "signed out, so this page always shows Lasso"
        : auth
          ? "needs the signed-in QA run"
          : "not captured yet"}
    </div>
  );
}

function BandView({ band }: { band: Band }) {
  const scale = SCALE[band.viewport] ?? 1;
  const width = Math.round(band.width * scale);
  const height = Math.round(band.height * scale);
  const skins = band.rows[0]?.cells.map((c) => c.skin) ?? [];
  return (
    <section style={{ marginBottom: 48 }}>
      <h2 style={{ fontSize: 18, margin: "0 0 4px" }}>
        {VIEWPORT_LABEL[band.viewport] ?? band.viewport}
      </h2>
      <p style={{ margin: "0 0 16px", fontSize: 12, color: "var(--text-secondary)" }}>
        {band.rows.length} surfaces{scale !== 1 ? `, shown at ${scale * 100}%` : ""}
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `160px repeat(${skins.length}, ${width}px)`,
          gap: 16,
        }}
      >
        <div />
        {skins.map((skin) => (
          <div key={skin} style={{ fontWeight: 600, fontSize: 13 }}>
            {SKIN_LABEL[skin] ?? skin}
          </div>
        ))}
        {band.rows.map((row) => (
          <div key={row.surface.id} style={{ display: "contents" }}>
            <div style={{ fontSize: 13 }}>
              {row.surface.label}
              <div
                style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)" }}
              >
                {row.surface.id}
              </div>
            </div>
            {row.cells.map((cell) =>
              cell.src ? (
                <img
                  key={cell.skin}
                  src={cell.src}
                  alt={`${row.surface.label}, ${SKIN_LABEL[cell.skin] ?? cell.skin}, ${band.viewport}`}
                  width={width}
                  height={height}
                  style={{
                    display: "block",
                    objectFit: "cover",
                    objectPosition: "top",
                    border: "1px solid var(--line-hairline)",
                    borderRadius: 4,
                  }}
                />
              ) : (
                <Pending
                  key={cell.skin}
                  width={width}
                  height={height}
                  auth={row.surface.auth}
                  // Only allowed signed-in accounts can turn a skin on, so signed-out pages are Lasso in every skin.
                  lassoOnly={!row.surface.auth && cell.skin !== "lasso"}
                />
              ),
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function Screens() {
  const bands = screensGrid(PICTURES);
  return (
    <div style={{ fontFamily: "var(--font-sans)", color: "var(--text-primary)", padding: 8 }}>
      {bands.map((band) => (
        <BandView key={band.viewport} band={band} />
      ))}
    </div>
  );
}

/** The design baseline, Lasso beside Charlotte. New pictures appear here with no code change. */
const meta = {
  title: "Screens/Baseline",
  component: Screens,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Screens>;

export default meta;
export const AllSurfaces: StoryObj<typeof meta> = {};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { type CSSProperties, useState } from "react";

import { CharlotteMark, type MarkState } from "@/design/brand/CharlotteMark";
import { CharlotteTile } from "@/design/brand/CharlotteTile";
import { CYCLE_S, MONO_ARC, cycleAt, suggestDots, wmVars } from "@/design/brand/charlotte-mark";

const SIZES = [16, 24, 32, 64, 128] as const;
const STATES: MarkState[] = ["idle", "reading", "live"];

const page = { fontFamily: "var(--font-sans)", color: "var(--text-primary)" } as const;
const note = {
  margin: "0 0 16px",
  fontSize: 13,
  color: "var(--text-secondary)",
  maxWidth: 640,
} as const;
const label = { fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" } as const;
const cell = { display: "grid", placeItems: "center", minHeight: 150 } as const;

/** Every size in every state. Reading runs the live loop; reduced motion shows the finished web instead. */
function States({ reducedMotion }: { reducedMotion?: boolean }) {
  return (
    <div style={page}>
      <p style={note}>
        Idle is the still Monoline C. Reading grows the web on a 6.4s cycle and pulses the hub. Live
        is the C with the lime hub. At 24px and below the still C gets heavier; the reading web
        stays a thinner, smaller version of the 32px web.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `72px repeat(${SIZES.length}, 150px)`,
          alignItems: "center",
        }}
      >
        <span />
        {SIZES.map((size) => (
          <span key={size} style={{ ...label, textAlign: "center" }}>
            {size}px
          </span>
        ))}
        {STATES.map((state) => [
          <span key={state} style={label}>
            {state}
          </span>,
          ...SIZES.map((size) => (
            <div key={`${state}-${size}`} style={cell}>
              <CharlotteMark state={state} size={size} reducedMotion={reducedMotion} />
            </div>
          )),
        ])}
      </div>
    </div>
  );
}

/** Drag through one cycle and stop on any frame. */
function Scrub() {
  const [t, setT] = useState(2.2);
  const { p, opacity } = cycleAt(t);
  return (
    <div style={page}>
      <label style={{ display: "grid", gap: 6, maxWidth: 520, fontSize: 13 }}>
        <span>
          t = {t.toFixed(2)}s of {CYCLE_S}s. Growth p = {p.toFixed(2)}, opacity {opacity.toFixed(2)}
          .
        </span>
        <input
          type="range"
          min={0}
          max={CYCLE_S - 0.01}
          step={0.01}
          value={t}
          onChange={(e) => setT(Number(e.target.value))}
          aria-label="Time in the cycle"
        />
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: 32, marginTop: 24 }}>
        {[24, 64, 128].map((size) => (
          <div key={size} style={{ opacity }}>
            <CharlotteMark state="reading" size={size} progress={p} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Suggest workstreams: the open C with three dots in a row (G6, option B). */
function SuggestMark({ size }: { size: number }) {
  const v = wmVars(size);
  return (
    <svg
      className="wm idle"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      style={{ "--k": v.k, "--sw": v.sw, "--ws": v.ws } as CSSProperties}
    >
      <path className="ln" d={MONO_ARC} />
      {suggestDots(size).map((d) => (
        <circle key={`${d.cx}-${d.cy}`} className="dot" cx={d.cx} cy={d.cy} r={d.r} />
      ))}
    </svg>
  );
}

function Suggest() {
  return (
    <div style={page}>
      <p style={note}>
        <strong>G6 approved (option B).</strong> The suggest-workstreams mark: the open C with three
        dots in a row, for the board tool that asks Lasso to find groupings.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
        {SIZES.map((size) => (
          <SuggestMark key={size} size={size} />
        ))}
      </div>
    </div>
  );
}

function Tiles() {
  return (
    <div style={page}>
      <p style={note}>
        The lapel tile, for the future app icon and avatar. Fixed brand colours, not skin tokens.
        Ships at P5.
      </p>
      <div style={{ display: "flex", alignItems: "end", gap: 24 }}>
        {[16, 24, 32, 64, 128, 180].map((size) => (
          <figure key={size} style={{ margin: 0, display: "grid", gap: 6, justifyItems: "center" }}>
            <CharlotteTile size={size} />
            <figcaption style={label}>{size}px</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

const meta = {
  title: "Brand/Charlotte mark",
  component: States,
  globals: { skin: "charlotte" },
} satisfies Meta<typeof States>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllStates: Story = {};
export const ReducedMotion: Story = { args: { reducedMotion: true } };
export const ScrubTheCycle: Story = { render: () => <Scrub /> };
export const SuggestWorkstreams: Story = {
  name: "Suggest workstreams (G6)",
  render: () => <Suggest />,
};
export const LapelTile: Story = { render: () => <Tiles /> };

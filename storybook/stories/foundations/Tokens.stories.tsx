import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useRef, useState } from "react";

import tokensCss from "../../../src/design/tokens.css?raw";

type Group = { title: string; names: string[] };

/** tokens.css read as text, one group per block, so a new token shows here with no story change. */
function groups(): Group[] {
  const blocks = tokensCss.split(/\n(?=\/\*|:root)/);
  const out: Group[] = [];
  for (const block of blocks) {
    const names = [...block.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1] ?? "");
    if (names.length === 0) continue;
    const comment = /\/\*\s*([^*]+?)(?:\.|\*\/)/.exec(block)?.[1]?.trim();
    out.push({ title: comment ?? `Block ${out.length + 1}`, names });
  }
  return out;
}

function Swatch({ name }: { name: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState("");
  useEffect(() => {
    if (ref.current) setValue(getComputedStyle(ref.current).getPropertyValue(name).trim());
  }, [name]);
  const isColour = /^(#|rgb|hsl|oklch|color|currentcolor)/i.test(value);
  return (
    <div ref={ref} style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
      <span
        aria-hidden
        style={{
          width: 24,
          height: 24,
          flex: "none",
          borderRadius: 4,
          border: "1px solid var(--line-hairline)",
          background: isColour
            ? `var(${name})`
            : "repeating-linear-gradient(45deg, var(--surface-sunk) 0 3px, transparent 3px 6px)",
        }}
      />
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {name}
        <br />
        <span style={{ color: "var(--text-muted)" }}>{value || "unset"}</span>
      </span>
    </div>
  );
}

function TokenSheet() {
  return (
    <div
      style={{
        fontFamily: "var(--font-sans)",
        color: "var(--text-primary)",
        display: "grid",
        gap: 24,
      }}
    >
      {groups().map((group) => (
        <section key={group.title}>
          <h3 style={{ margin: "0 0 10px", fontSize: 13 }}>{group.title}</h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 10,
            }}
          >
            {group.names.map((name) => (
              <Swatch key={name} name={name} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Values resolve inside the app shell, as the app sees them. Job names come last. */
const meta = { title: "Foundations/Tokens", component: TokenSheet } satisfies Meta<
  typeof TokenSheet
>;

export default meta;
export const All: StoryObj<typeof meta> = {};

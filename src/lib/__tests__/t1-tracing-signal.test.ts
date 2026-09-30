import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EVENT_DIM_KEYS } from "../event-dim-allowlist";

const read = (p: string) => readFileSync(p, "utf8");
const SENTENCE =
  "For each attachment, set produced_at_turn to the 1-indexed position of the turn that produced or first shared this file. Omit it if you are not sure. Never guess.";

describe("T1 tracing signal", () => {
  const mcp = read("src/lib/mcp-handler.server.ts");
  const start = mcp.indexOf('name: "push_conversation"');
  const end = mcp.indexOf('name: "', start + 30);
  const def = mcp.slice(start, end);

  it("push_conversation description asks for produced_at_turn", () => {
    expect(def).toContain(SENTENCE);
  });

  it("attachments expose an optional positive-integer produced_at_turn", () => {
    const att = def.slice(def.indexOf("attachments: {"), def.indexOf("decisions: {"));
    expect(att).toMatch(/produced_at_turn: \{\s*type: "integer",\s*minimum: 1,/);
    expect(att).toContain("Omit it if you are not sure. Never guess.");
    const required = att.match(/required: \[([^\]]*)\],\s*\},\s*\},\s*$/)?.[1] ?? att;
    expect(required).not.toContain("produced_at_turn");
  });

  it("the one span_links insert site records span_link.created with only via", () => {
    const src = read("src/lib/span-provenance.server.ts");
    const insertAt = src.indexOf('.from("span_links")\n    .insert(');
    expect(insertAt).toBeGreaterThan(-1);
    const after = src.slice(insertAt);
    const call = after.slice(after.indexOf("recordEvent(supabase, {"));
    const body = call.slice(0, call.indexOf("});"));
    expect(body).toContain('eventType: "span_link.created"');
    expect(body).toContain('dims: { via: "span_provenance" }');
  });

  it("allowlist carries span_link.created with via only", () => {
    expect(EVENT_DIM_KEYS["span_link.created"]).toEqual(["via"]);
  });
});

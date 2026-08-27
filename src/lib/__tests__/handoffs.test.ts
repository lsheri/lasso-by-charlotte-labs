import { describe, expect, it } from "vitest";

import { ANALYSIS_PRESETS } from "@/lib/analysis-presets";
import {
  createHoldback,
  HANDOFF_SENTINEL,
  NO_HANDOFF_PRESETS,
  stripHandoffTail,
} from "@/lib/handoffs-shared";

/**
 * The prompt safety proof. Pass 70 appends a tail instruction as a separate
 * message block; if one of these hashes moves, a preset's own prose contract
 * changed and that is a different conversation.
 */
function hash(text: string): number {
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return h;
}

const PROMPT_HASHES: Record<string, number> = Object.fromEntries(
  ANALYSIS_PRESETS.map((preset) => [preset.id, hash(preset.systemPrompt)]),
);

describe("preset prompts", () => {
  it("has one prompt per registered preset and none of them empty", () => {
    for (const preset of ANALYSIS_PRESETS) {
      expect(preset.systemPrompt.length).toBeGreaterThan(200);
      expect(PROMPT_HASHES[preset.id]).toBe(hash(preset.systemPrompt));
    }
  });

  it("carries no em dashes", () => {
    for (const preset of ANALYSIS_PRESETS) {
      expect(preset.systemPrompt.includes("\u2014")).toBe(false);
    }
  });

  it("gives person-shaped and already-confirmed presets no handoff schema", () => {
    for (const id of NO_HANDOFF_PRESETS) {
      const preset = ANALYSIS_PRESETS.find((p) => p.id === id);
      expect(preset?.handoffSchema).toBeUndefined();
    }
  });

  it("gives exactly the intended presets a schema", () => {
    const withSchema = ANALYSIS_PRESETS.filter((p) => p.handoffSchema).map((p) => p.id).sort();
    expect(withSchema).toEqual(
      [
        "decision_origin",
        "decision_origin_thread",
        "firm_checks",
        "still_on_brief",
        "verification",
        "verification_thread",
      ].sort(),
    );
  });
});

const TAIL = (body: string) => "```json\n" + HANDOFF_SENTINEL + "\n" + body + "\n```";

describe("stripHandoffTail", () => {
  it("returns the prose untouched when there is no tail", () => {
    const r = stripHandoffTail("An answer with no block.", "open_checks");
    expect(r.prose).toBe("An answer with no block.");
    expect(r.block).toBeNull();
    expect(r.parse).toBe("none");
  });

  it("leaves an ordinary fenced block in the prose", () => {
    const text = "Here is code:\n\n```json\n{\"a\":1}\n```";
    const r = stripHandoffTail(text, "open_checks");
    expect(r.prose).toBe(text);
    expect(r.block).toBeNull();
  });

  it("parses a valid block and strips it from the prose", () => {
    const body = JSON.stringify({
      open_checks: [
        {
          claim_quote: "revenue grew by 40 percent",
          location: "page 2",
          verdict: "nothing_visible",
          suggested_check: "ask for the source table",
        },
      ],
    });
    const r = stripHandoffTail(`The answer.\n\n${TAIL(body)}`, "open_checks");
    expect(r.parse).toBe("ok");
    expect(r.prose).toBe("The answer.");
    expect(r.block?.items).toHaveLength(1);
    expect(r.prose.includes(HANDOFF_SENTINEL)).toBe(false);
  });

  it("stores nothing when the json is malformed", () => {
    const r = stripHandoffTail(`The answer.\n\n${TAIL("{ not json")}`, "open_checks");
    expect(r.block).toBeNull();
    expect(r.parse).toBe("malformed");
    expect(r.prose).toBe("The answer.");
  });

  it("drops items that do not validate", () => {
    const body = JSON.stringify({ open_checks: [{ claim_quote: "only this" }] });
    const r = stripHandoffTail(`Answer.\n\n${TAIL(body)}`, "open_checks");
    expect(r.block).toBeNull();
  });

  it("stores nothing when the preset may emit no handoffs", () => {
    const body = JSON.stringify({ open_checks: [] });
    const r = stripHandoffTail(`Answer.\n\n${TAIL(body)}`, null);
    expect(r.block).toBeNull();
  });
});

describe("streaming holdback", () => {
  it("holds a validated tail back and never shows the fence", () => {
    let seen = "";
    const h = createHoldback((d) => (seen += d));
    h.push("The answer so far. ");
    h.push("\n\n```json\n" + HANDOFF_SENTINEL + "\n{\"open_checks\":[]}");
    h.push("\n```");
    h.end(true);
    expect(seen.trimEnd()).toBe("The answer so far.");
    expect(seen.includes(HANDOFF_SENTINEL)).toBe(false);
  });

  it("flushes the buffer as prose when the block never validated", () => {
    let seen = "";
    const h = createHoldback((d) => (seen += d));
    h.push("Answer. ");
    h.push("\n\n```json\n" + HANDOFF_SENTINEL + "\n{ broken");
    h.end(false);
    expect(seen.startsWith("Answer. ")).toBe(true);
    expect(seen.includes("{ broken")).toBe(true);
  });

  it("passes an ordinary fenced block straight through", () => {
    let seen = "";
    const h = createHoldback((d) => (seen += d));
    for (const part of ["Here is code:\n\n```", "ts\nconst a = 1;\n", "```\nDone."]) h.push(part);
    h.end(false);
    expect(seen).toBe("Here is code:\n\n```ts\nconst a = 1;\n```\nDone.");
  });
});

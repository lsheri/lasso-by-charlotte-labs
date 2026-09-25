// @vitest-environment jsdom
import { readFileSync } from "node:fs";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/telemetry.functions", () => ({ recordAnonymousEventFn: vi.fn(() => Promise.resolve({ ok: true })) }));
vi.mock("@/components/markdown/MarkdownMessage", () => ({ MarkdownMessage: ({ content }: { content: string }) => <div data-testid="md">{content}</div> }));

import { DemoPresetBar } from "@/pages/DemoPages";
import { publicDemoPresets, publicSafeText, type DemoPresetRow } from "../demo-presets-shared";
import { guardEventDims } from "../event-dim-allowlist";
import { extractTurnRefs, naturalTurnLabels, RAW_TURN_TAG, stripTurnTags } from "../turn-labels";

afterEach(cleanup);
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
}

const WORK = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const row = (over: Partial<DemoPresetRow>): DemoPresetRow => ({
  position: 1,
  question: "Where did the $1.4M on slide 3 come from?",
  answer: "From the pricing chat.",
  context_manifest: null,
  turn_refs: [],
  generated_at: "2026-09-25T10:00:00Z",
  ...over,
});

describe("turn labels", () => {
  it("relabels both internal tag shapes in plain words", () => {
    const text = naturalTurnLabels("TURN 5 USER: hi\n\nTURN 6 ASSISTANT: hello\n\nTURN 7 · USER\nnext");
    expect(text).toContain("(turn 5, you said) hi");
    expect(text).toContain("(turn 6, the assistant replied) hello");
    expect(text).toContain("(turn 7, you said) next");
    expect(RAW_TURN_TAG.test(text)).toBe(false);
  });
  it("no rendered answer contains a raw TURN tag", () => {
    const answer = stripTurnTags("As TURN 5 USER said and TURN 6 ASSISTANT replied.");
    expect(/TURN \d+ (USER|ASSISTANT)/.test(answer)).toBe(false);
    expect(/TURN \d+ (USER|ASSISTANT)/.test(publicSafeText("See TURN 2 ASSISTANT"))).toBe(false);
  });
  it("ties a cited turn to the conversation named before it", () => {
    const refs = extractTurnRefs('In "Board charter options", turn 6 settled it. Pricing chat, turns 2 to 3.', [
      { id: WORK, title: "Board charter options" },
      { id: OTHER, title: "Pricing chat" },
    ]);
    expect(refs.map((r) => [r.work_item_id, r.turn_no])).toEqual([[WORK, 6], [OTHER, 2], [OTHER, 3]]);
  });
  it("the pipeline tells the model the rule and rewrites stray tags", () => {
    const src = readFileSync("src/lib/reflect-run.server.ts", "utf8");
    expect(src).toContain("TURN_CITATION_RULE");
    expect(src.match(/stripTurnTags\(/g)?.length).toBe(2);
  });
});

describe("public preset payload", () => {
  it("only answered rows travel", () => {
    const out = publicDemoPresets([row({}), row({ position: 2, answer: null }), row({ position: 3, answer: "  " })], new Set([WORK]));
    expect(out.map((p) => p.position)).toEqual([1]);
  });
  it("carries no urls or ids beyond work already on the board", () => {
    const out = publicDemoPresets(
      [
        row({
          answer: `See [the chat](https://chatgpt.com/c/abc) and https://drive.google.com/x and ${OTHER}.`,
          context_manifest: {
            engagement: { id: "33333333-3333-4333-8333-333333333333", name: "YSM" },
            brief_included: true,
            firm_checks_applied: 0,
            items: [
              { id: WORK, title: "Board charter options", kind: "conversation", detail: "turns 1-8" },
              { id: OTHER, title: "Hidden", kind: "document", detail: "" },
            ],
            excluded: [],
            assembled_at: "2026-09-25T10:00:00Z",
          },
          turn_refs: [
            { work_item_id: WORK, turn_no: 6, label: "Turn 6 in Board charter options" },
            { work_item_id: OTHER, turn_no: 2, label: "x" },
          ],
        }),
      ],
      new Set([WORK]),
    );
    const json = JSON.stringify(out);
    expect(json).not.toMatch(/https?:|\/\//);
    expect(json).not.toContain(OTHER);
    expect(json).not.toContain("33333333");
    expect(out[0]!.turnRefs).toEqual([{ work_item_id: WORK, turn_no: 6, label: "Turn 6 in Board charter options" }]);
  });
});

describe("server boundaries", () => {
  it("preset rows are read only after the engagement is proven to be in the demo org", () => {
    const src = readFileSync("src/lib/demo-board.server.ts", "utf8");
    const fn = src.slice(src.indexOf("export async function loadDemoPresets"));
    expect(fn.indexOf("eng.org_id !== orgId")).toBeGreaterThan(-1);
    expect(fn.indexOf("eng.org_id !== orgId")).toBeLessThan(fn.indexOf('from("demo_presets")'));
  });
  it("no anonymous path can reach the Ask pipeline", () => {
    for (const file of ["src/lib/demo-board.server.ts", "src/lib/demo-presets-shared.ts", "src/pages/DemoPages.tsx"]) {
      const src = readFileSync(file, "utf8");
      expect(src).not.toMatch(/runReflectTurn|reflect-run|regenerateDemoPresets/);
    }
    const fns = readFileSync("src/lib/demo.functions.ts", "utf8");
    const regen = fns.slice(fns.indexOf("export const regenerateDemoPresetsFn"));
    expect(regen).toContain("requireSupabaseAuth");
    const server = readFileSync("src/lib/demo-presets.server.ts", "utf8");
    expect(server).toContain('has_org_role", { p_org: orgId, p_roles: ["admin"]');
  });
  it("the three demo events keep only their dims", () => {
    expect(guardEventDims("demo.preset_opened", { code: "ysm-01", position: 1, q: "x" }).dims).toEqual({ code: "ysm-01", position: 1 });
    expect(guardEventDims("demo.turn_opened", { code: "ysm-01", position: 2 }).dims).toEqual({ code: "ysm-01", position: 2 });
    expect(guardEventDims("demo.presets_regenerated", { code: "ysm-01", answered: 4 }).dims).toEqual({ code: "ysm-01", answered: 4 });
  });
});

describe("demo preset bar", () => {
  const presets = publicDemoPresets(
    [
      row({ turn_refs: [{ work_item_id: WORK, turn_no: 6, label: "Turn 6 in Board charter options" }] }),
      row({ position: 2, question: "Send me the link to the chat where we settled it.", answer: "Here.", turn_refs: [{ work_item_id: WORK, turn_no: 4, label: "Turn 4" }] }),
      row({ position: 3, question: "Unanswered", answer: null }),
    ],
    new Set([WORK]),
  );

  it("renders chips for answered rows only", () => {
    render(<DemoPresetBar code="YSM-01" presets={presets} onOpenTurn={() => undefined} />);
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Where did the $1.4M on slide 3 come from?",
      "Send me the link to the chat where we settled it.",
    ]);
  });
  it("opens a labelled saved answer and the exact turn", () => {
    const onOpenTurn = vi.fn();
    render(<DemoPresetBar code="YSM-01" presets={presets} onOpenTurn={onOpenTurn} />);
    fireEvent.click(screen.getByText("Send me the link to the chat where we settled it."));
    expect(screen.getByText(/Saved answer, generated by Lasso on/)).toBeTruthy();
    expect(screen.getByText("Opens the turn inside Lasso.")).toBeTruthy();
    expect(screen.queryByText(/connected account/)).toBeNull();
    fireEvent.click(screen.getByText("Open the exact turn"));
    expect(onOpenTurn).toHaveBeenCalledWith(WORK, 4, 2);
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  MCP_VOCAB,
  PLACEMENT_LINE,
  parsePlacementArgs,
  placementInputs,
  placementTarget,
  renderPlacement,
  renderUnknownRef,
} from "../mcp-vocab";

const handler = readFileSync(resolve(process.cwd(), "src/lib/mcp-handler.server.ts"), "utf8");
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const company = MCP_VOCAB.company;

describe("M2b — the optional placement inputs", () => {
  it("absent destination keeps today's behaviour", () => {
    const plan = parsePlacementArgs({});
    expect(plan.destination).toBeNull();
    expect(plan.move).toBe(false);
    expect(plan.suggestionOutcome).toBe("none");
    expect(plan.sourceProject).toBeNull();
  });

  it("reads a ref, a move and an outcome", () => {
    const plan = parsePlacementArgs({
      destination: " CFT-01 · General ",
      move: true,
      suggestion_outcome: "accepted",
    });
    expect(plan.destination).toBe("CFT-01 · General");
    expect(plan.move).toBe(true);
    expect(plan.suggestionOutcome).toBe("accepted");
  });

  it("an unknown outcome reads as none, and move defaults to false", () => {
    expect(parsePlacementArgs({ suggestion_outcome: "maybe" }).suggestionOutcome).toBe("none");
    expect(parsePlacementArgs({ move: "yes" }).move).toBe(false);
  });

  it("keeps the source project, with its id when there is one", () => {
    expect(parsePlacementArgs({ source_project: { name: "Cure First" } }).sourceProject).toEqual({
      name: "Cure First",
    });
    expect(
      parsePlacementArgs({ source_project: { name: "Cure First", id: "p_1" } }).sourceProject,
    ).toEqual({ name: "Cure First", id: "p_1" });
    expect(parsePlacementArgs({ source_project: { name: "  " } }).sourceProject).toBeNull();
  });

  it("every push tool offers the four inputs and the placement sentence", () => {
    expect(Object.keys(placementInputs(company))).toEqual([
      "destination",
      "move",
      "suggestion_outcome",
      "source_project",
    ]);
    expect(PLACEMENT_LINE).toContain("only pass destination after the user says yes");
    expect(handler.match(/\$\{PLACEMENT_LINE\}/g) ?? []).toHaveLength(3);
    expect(handler.match(/\.\.\.placementInputs\(vocab\)/g) ?? []).toHaveLength(3);
  });
});

describe("M2b — what the reply says", () => {
  it("placed and moved", () => {
    expect(renderPlacement(company, "placed", "CFT-01 · General", null)).toBe(
      "Saved and placed on CFT-01 · General. Your engagement team can see it there.",
    );
    expect(renderPlacement(company, "moved", "CFT-01 · General", null)).toContain(
      "Saved and placed on CFT-01 · General.",
    );
  });

  it("already here", () => {
    expect(renderPlacement(company, "already_here", "CFT-01 · General", null)).toBe(
      "Already on CFT-01 · General.",
    );
  });

  it("on another board asks, and never places a second time", () => {
    expect(renderPlacement(company, "on_other", "CFT-01 · General", "NWG-02 · Research")).toBe(
      "Saved. It is already on NWG-02 · Research. Ask the user whether to move it to CFT-01 · General; if yes, call again with move: true.",
    );
  });

  it("forbidden keeps it in the inbox", () => {
    expect(renderPlacement(company, "forbidden", "CFT-01 · General", null)).toBe(
      "Saved to your inbox only; you can't place work on that engagement.",
    );
  });

  it("an unknown ref lists the valid ones", () => {
    expect(renderUnknownRef(company, ["CFT-01 · General", "NWG-02 · Research"])).toBe(
      "Saved to your inbox only; that place is not one of yours. Valid places: CFT-01 · General, NWG-02 · Research.",
    );
    expect(renderUnknownRef(company, [])).toContain("no engagements yet");
  });

  it("reads in the workspace's own words", () => {
    expect(renderPlacement(MCP_VOCAB.edu, "placed", "BIO-1 · Week 2", null)).toContain(
      "Your assignment team can see it there.",
    );
  });

  it("no reply carries an id", () => {
    const texts = [
      renderPlacement(company, "placed", "CFT-01 · General", null),
      renderPlacement(company, "on_other", "CFT-01 · General", "NWG-02 · Research"),
      renderUnknownRef(company, ["CFT-01 · General"]),
    ];
    for (const text of texts) expect(UUID.test(text)).toBe(false);
  });
});

describe("M2b — what the event records", () => {
  it("only a real landing counts as a board", () => {
    expect(placementTarget("placed")).toBe("workboard");
    expect(placementTarget("moved")).toBe("workboard");
    expect(placementTarget("already_here")).toBe("workboard");
    expect(placementTarget("on_other")).toBe("inbox");
    expect(placementTarget("forbidden")).toBe("inbox");
    expect(placementTarget("")).toBe("inbox");
  });

  it("all three push events carry target and suggestion_outcome", () => {
    expect(handler.match(/target: \w+Placement\.target|target: convoPlacement\.target/g) ?? [])
      .toHaveLength(3);
    expect(handler.match(/suggestion_outcome: plan\.suggestionOutcome/g) ?? []).toHaveLength(3);
  });
});

describe("M2b — how the item actually lands", () => {
  it("calls the database function as the pushing person", () => {
    expect(handler).toContain('supabaseAdmin.rpc("mcp_place_item", {');
    expect(handler).toContain("p_actor: owner.profileId");
    expect(handler).toContain("p_work_item: itemId");
    expect(handler).toContain("p_task: place.taskId");
    expect(handler).toContain("p_move: plan.move");
  });

  it("resolves the ref against the owner's own places only", () => {
    expect(handler).toContain("const { places } = await readPlaces(owner)");
  });

  it("never writes a mapping row itself", () => {
    expect(handler).not.toMatch(/from\("work_item_tasks"\)\s*\n?\s*\.insert/);
  });

  it("stores the source project without disturbing other keys", () => {
    expect(handler.match(/source_project: plan\.sourceProject/g) ?? []).toHaveLength(3);
    expect(handler).toContain("...(plan.sourceProject ? { source_project: plan.sourceProject } : {})");
  });
});

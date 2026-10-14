import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("VP-1 version turn source guards", () => {
  const connector = readFileSync("src/lib/connector-import.server.ts", "utf8");
  const handler = readFileSync("src/lib/mcp-handler.server.ts", "utf8");
  const helper = readFileSync("src/lib/version-prompt.ts", "utf8");

  it("separates reconstructed and new version extras", () => {
    expect(connector).toContain("const backfillExtras = {");
    expect(connector).toContain("const newExtras = {");
    expect(connector).not.toContain("...extras,");
    const backfillExtras = connector.slice(connector.indexOf("const backfillExtras"), connector.indexOf("const newExtras"));
    expect(backfillExtras).not.toContain("created_at_turn");
    expect(backfillExtras).not.toContain("prompted_by_turn");
  });
  it("never stamps reconstructed v1 with new version turns", () => {
    const start = connector.indexOf('"initial_capture"');
    const backfill = connector.slice(start, connector.indexOf("})", start));
    expect(backfill).toContain("...backfillExtras,");
    expect(backfill).not.toContain("created_at_turn");
    expect(backfill).not.toContain("prompted_by_turn");
  });
  it("passes the produced turn once to recordNewVersion", () => {
    expect(handler.match(/createdAtTurn: attachment\.producedAtTurn/g)).toHaveLength(1);
  });
  it("imports the prompt helper and uses it in both version paths", () => {
    expect(handler).toContain('import { promptedByTurn } from "./version-prompt";');
    expect(handler.match(/promptedByTurn\(attachment\.producedAtTurn, userTurnPositions\)/g)).toHaveLength(2);
    expect(handler).toContain("created_at_turn: attachment.producedAtTurn");
    expect(handler).toContain("prompted_by_turn: promptTurn");
  });
  it("keeps the per-person reporting guardrail", () => {
    expect(helper).toContain("Provenance, never proportion");
  });
});
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  attachmentSummaryLine,
  receiptHead,
  receiptLine,
  matchPlace,
  type AttachmentOutcome,
} from "@/lib/mcp-handler.server";
import { MCP_VOCAB, chooseSuggestion, isScratchBoard, placeRef } from "@/lib/mcp-vocab";

const handler = readFileSync("src/lib/mcp-handler.server.ts", "utf8");

describe("P0 item 6 — a ref two boards share", () => {
  it("is the code and the workstream, and the board title only when asked", () => {
    expect(placeRef("CFT-01", "General")).toBe("CFT-01 · General");
    expect(placeRef("CFT-01", "General", "Diagnostic")).toBe("CFT-01 · General (Diagnostic)");
  });

  it("matches the exact ref, then a short form that names one place", () => {
    const places = [
      { ref: "CFT-01 · General (Diagnostic)", shortRef: "CFT-01 · General" },
      { ref: "CFT-01 · General (Pilot)", shortRef: "CFT-01 · General" },
      { ref: "ACM-02 · Pricing", shortRef: "ACM-02 · Pricing" },
    ];
    expect(matchPlace(places, "CFT-01 · General (Pilot)").place?.ref).toBe(
      "CFT-01 · General (Pilot)",
    );
    expect(matchPlace(places, "ACM-02 · Pricing").place?.ref).toBe("ACM-02 · Pricing");
    const shared = matchPlace(places, "CFT-01 · General");
    expect(shared.place).toBeNull();
    expect(shared.colliding).toHaveLength(2);
  });
});

describe("P0 item 7 — a scratch board is never suggested", () => {
  const places = [
    {
      ref: "CFT-99 · General",
      containerName: "Cure First",
      code: "CFT-99",
      boardTitle: "Test for Cure First",
      workstreamName: "General",
    },
    {
      ref: "CFT-01 · General",
      containerName: "Cure First",
      code: "CFT-01",
      boardTitle: "Cure First",
      workstreamName: "General",
    },
  ];

  it("recognises the scratch names", () => {
    expect(isScratchBoard("Test for Cure First")).toBe(true);
    expect(isScratchBoard("Sandbox")).toBe(true);
    expect(isScratchBoard("Cure First")).toBe(false);
  });

  it("answers the real board, never the test one", () => {
    const suggested = chooseSuggestion(MCP_VOCAB.company, {
      places,
      projectRef: "CFT-99 · General",
      title: "Cure First diagnostic",
    });
    expect(suggested?.ref).not.toBe("CFT-99 · General");
    expect(suggested === null || suggested.ref === "CFT-01 · General").toBe(true);
  });

  it("orders the project signal by when the work was captured", () => {
    expect(handler).toContain('.order("captured_at", { ascending: false })');
  });
});

describe("P0 item 4 — positional receipts", () => {
  it("gives a one-line head of the first 40 characters", () => {
    expect(receiptHead("Can skills\nbe updated  programmatically for a long line of text")).toBe(
      "Can skills be updated programmatically f…",
    );
    expect(receiptHead("short one")).toBe("short one");
  });

  it("caps the text receipt at twelve positions and says how many more", () => {
    const many = Array.from({ length: 14 }, (_, i) => ({
      pos: i + 1,
      role: "user",
      chars: 10,
      head: "hi",
    }));
    const line = receiptLine(many);
    expect(line).toContain("Stored 1 user 10 'hi'");
    expect(line).toContain("and 2 more");
    expect(line.match(/user 10/g)).toHaveLength(12);
    expect(receiptLine([])).toBe("");
  });
});

describe("P0 item 2 — per-attachment outcomes", () => {
  it("counts each outcome and names the new versions", () => {
    const outcomes: AttachmentOutcome[] = [
      { title: "A", source_artifact_id: "a", outcome: "new", chars: 10 },
      { title: "B", source_artifact_id: "b", outcome: "new", chars: 10 },
      { title: "C", source_artifact_id: "c", outcome: "unchanged", chars: 10 },
      { title: "SKILL", source_artifact_id: "d", outcome: "new_version", chars: 10, version_no: 3 },
    ];
    expect(attachmentSummaryLine(outcomes)).toBe(
      " Attachments: 2 new, 1 unchanged, 1 new version (SKILL v3).",
    );
    expect(attachmentSummaryLine([])).toBe("");
  });
});

describe("P0 items 1, 3, 9, 10 — the handler's wiring", () => {
  it("places attachments with the thread and reports how many", () => {
    expect(handler).toContain("attachments placed on ${place.ref}");
    expect(handler).toContain("the rest stayed in the inbox");
    expect(handler).toContain("attachments_placed: versionRowsBucket(attachmentsPlaced)");
  });

  it("reads places once for a push", () => {
    expect(handler).toContain(
      "const knownPlaces = plan.destination ? (await readPlaces(owner)).places : undefined;",
    );
  });

  it("derives window.to instead of rejecting a disagreement", () => {
    expect(handler).toContain("const computed = from + messages.length - 1;");
    expect(handler).toContain("window.to said ${statedTo}");
    expect(handler).not.toContain("window.to must be an integer greater than or equal to from.");
    // the gap check is untouched
    expect(handler).toContain("storedBefore + 1");
  });

  it("falls back to the first user message for a missing title", () => {
    expect(handler).toContain('firstUserMessage.trim().slice(0, 60) || "Untitled conversation"');
    expect(handler).toContain('required: ["vendor", "orig_conversation_id", "messages"]');
    expect(handler).toContain('required: ["from", "total"]');
  });

  it("asks for the chat URL only on the first push", () => {
    expect(handler).toContain('const urlNote = pushMode === "created" ? missingChatUrlNote(args)');
  });

  it("scopes the options list to the suggested container", () => {
    expect(handler).toContain("call lasso_list_places to see them all.");
  });
});

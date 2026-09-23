import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ATTACHMENT_KINDS } from "@/lib/conversation-shared";
import { guardWorkboardEvent } from "@/lib/workboard-event-allowlist";
import { EVENT_DIM_KEYS } from "@/lib/event-dim-allowlist";
import { referenceMatch } from "@/lib/reference-file-shared";
import {
  attachmentSummaryLine,
  fileRefNote,
  parseIncomingAttachment,
} from "@/lib/mcp-handler.server";

const SHA = "a".repeat(64);

describe("P1b file_ref parsing", () => {
  it("rejects a file_ref that carries content", () => {
    const r = parseIncomingAttachment(
      { kind: "file_ref", title: "deck.pptx", content: "x", file_ref: { filename: "deck.pptx" } },
      ATTACHMENT_KINDS,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("file_ref carries no content");
  });
  it("rejects a file_ref without file_ref.filename", () => {
    expect(parseIncomingAttachment({ kind: "file_ref", title: "deck.pptx" }, ATTACHMENT_KINDS).ok).toBe(false);
  });
  it("rejects a bad sha256", () => {
    const r = parseIncomingAttachment(
      { kind: "file_ref", title: "d", file_ref: { filename: "d.pdf", sha256: "nope" } },
      ATTACHMENT_KINDS,
    );
    expect(r.ok).toBe(false);
  });
  it("accepts a valid file_ref with empty content", () => {
    const r = parseIncomingAttachment(
      { kind: "file_ref", title: "Deck", source_artifact_id: "deck.pptx", file_ref: { filename: "deck.pptx", sha256: SHA.toUpperCase(), bytes: 12 } },
      ATTACHMENT_KINDS,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.attachment.content).toBe("");
      expect(r.attachment.fileRef).toEqual({ filename: "deck.pptx", sha256: SHA, bytes: 12 });
    }
  });
  it("still rejects a non-file_ref attachment without content", () => {
    expect(parseIncomingAttachment({ kind: "artifact_code", title: "x" }, ATTACHMENT_KINDS).ok).toBe(false);
    expect(parseIncomingAttachment({ kind: "artifact_code", title: "x", content: "y" }, ATTACHMENT_KINDS).ok).toBe(true);
  });
});

describe("P1b outcome words", () => {
  it("names file placeholders", () => {
    const one = { title: "a", source_artifact_id: "a", outcome: "reference_created" as const, chars: 0 };
    expect(attachmentSummaryLine([one])).toBe(" Attachments: 1 file placeholder.");
    expect(attachmentSummaryLine([one, { ...one, title: "b" }])).toBe(" Attachments: 2 file placeholders.");
    expect(fileRefNote(0)).toBe("");
    expect(fileRefNote(2)).toBe(" 2 file placeholders on the board; add the file to complete each one.");
  });
});

describe("P1b match", () => {
  it("computes yes, no and unknown", () => {
    expect(referenceMatch(SHA, SHA)).toBe("yes");
    expect(referenceMatch(SHA.toUpperCase(), SHA)).toBe("yes");
    expect(referenceMatch(SHA, "b".repeat(64))).toBe("no");
    expect(referenceMatch(null, SHA)).toBe("unknown");
    expect(referenceMatch("", SHA)).toBe("unknown");
  });
});

describe("P1b wiring", () => {
  const source = readFileSync("src/lib/mcp-handler.server.ts", "utf8");
  it("file_ref rows join attachmentIds so they are placed with the thread", () => {
    const branch = source.slice(source.indexOf('attachment.kind === "file_ref"'), source.indexOf("// The server decides what an artifact is."));
    expect(branch).toContain("attachmentIds.push(refResult.data.id)");
    expect(branch).toContain("attachmentIds.push(refMatch.id)");
    expect(branch).toContain('content_fidelity: "reference"');
  });
  it("emits the file_refs dim and lists the new event", () => {
    expect(source).toContain("file_refs: versionRowsBucket(fileRefCount)");
    expect(EVENT_DIM_KEYS["mcp.push"]).toContain("file_refs");
    const kept = guardWorkboardEvent("workboard.reference_file_added", { matched: "yes", via: "drop", name: "x" });
    expect(kept).toEqual({ keep: true, dims: { matched: "yes", via: "drop" } });
  });
});

describe("P1b fix pass: open larger wording", () => {
  it("tells the reader a reference file has not been added yet", () => {
    const src = readFileSync("src/components/peek/RenderedContent.tsx", "utf8");
    expect(src).toContain('item.content_fidelity === "reference"');
    expect(src).toContain("This file was made in a chat and has not been added yet. Add it from the card on the board.");
  });
});

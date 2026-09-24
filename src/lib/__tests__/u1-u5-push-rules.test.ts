import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ATTACHMENT_KINDS } from "@/lib/conversation-shared";
import { guardEventDims } from "@/lib/event-dim-allowlist";
import {
  attachmentSummaryLine,
  isTextFilename,
  parseIncomingAttachment,
} from "@/lib/mcp-handler.server";
import { PREVIEW_CSP } from "@/lib/workboard-card-preview.shared";

const src = readFileSync("src/lib/mcp-handler.server.ts", "utf8");

describe("U1 push rules", () => {
  it("states the new push instructions", () => {
    for (const s of ["Never attach a file the person uploaded", "list them for the person", "under about 40 KB", "never send one about Lasso"]) {
      expect(src).toContain(s);
    }
  });

  it("parses origin and include strictly", () => {
    const base = { kind: "artifact_html", title: "T", content: "<p>x</p>", source_artifact_id: "a" };
    const a = parseIncomingAttachment({ ...base, origin: "seen_in_chat", include: true }, ATTACHMENT_KINDS);
    expect(a.ok && a.attachment.origin).toBe("seen_in_chat");
    expect(a.ok && a.attachment.include).toBe(true);
    const b = parseIncomingAttachment({ ...base, origin: "banana", include: "yes" }, ATTACHMENT_KINDS);
    expect(b.ok && b.attachment.origin).toBe("made_in_chat");
    expect(b.ok && b.attachment.include).toBe(false);
  });

  it("words the held outcome", () => {
    expect(attachmentSummaryLine([{ title: "T", source_artifact_id: "a", outcome: "held", chars: 0 }])).toContain("1 held back");
  });

  it("recognises text filenames", () => {
    expect(isTextFilename("plan.html")).toBe(true);
    expect(isTextFilename("Data.CSV")).toBe(true);
    expect(isTextFilename("deck.pptx")).toBe(false);
    expect(isTextFilename("notes")).toBe(false);
  });

  it("checks held before the file_ref branch in the loop", () => {
    const loop = src.indexOf("for (const attachment of attachments)");
    const held = src.indexOf('attachment.origin === "seen_in_chat"', loop);
    const ref = src.indexOf('attachment.kind === "file_ref"', loop);
    expect(loop).toBeGreaterThan(-1);
    expect(held).toBeGreaterThan(loop);
    expect(ref).toBeGreaterThan(held);
  });

  it("keeps the two new mcp.push dims", () => {
    const r = guardEventDims("mcp.push", { attachments_held: "1-2", text_refs: "0" });
    expect(JSON.stringify(r)).toContain("attachments_held");
    expect(JSON.stringify(r)).toContain("text_refs");
  });
});

describe("U5 preview CSP", () => {
  it("stays closed apart from the two library hosts", () => {
    expect(PREVIEW_CSP).toContain("connect-src 'none'");
    expect(PREVIEW_CSP).toContain("form-action 'none'");
    expect(PREVIEW_CSP).not.toContain("unsafe-eval");
    const script = PREVIEW_CSP.split(";").find((d) => d.trim().startsWith("script-src"))!;
    const hosts = script.match(/https:\/\/\S+/g) ?? [];
    expect(hosts.length).toBeGreaterThan(0);
    for (const h of hosts) expect(["https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"]).toContain(h);
  });
});

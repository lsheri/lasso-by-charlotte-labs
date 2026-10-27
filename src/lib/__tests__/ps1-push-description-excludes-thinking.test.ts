import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { PUSH_DESC_BUILD, LASSO_CONNECTOR_VERSION } from "../mcp-handler.server";


const src = readFileSync("src/lib/mcp-handler.server.ts", "utf8");

describe("PS1 — the push tool never asks the model to reproduce its own thinking", () => {
  const conversation = src.indexOf('name: "push_conversation"');
  const thread = src.indexOf('name: "push_thread"');
  const conversationDef = conversation > -1 ? src.slice(conversation, thread) : "";

  it("excludes thinking in the push_conversation description", () => {
    expect(conversationDef).toContain("are never part of the transcript");
    expect(conversationDef).toContain("visible conversation only");
  });

  it("excludes thinking in the messages field description", () => {
    expect(conversationDef).toContain("never the assistant's own thinking");
  });

  it("excludes thinking in the content field description", () => {
    expect(conversationDef).toContain("Never the assistant's thinking");
  });

  it("still keeps every load-bearing rule that was already there", () => {
    expect(conversationDef).toContain(
      "Never compose new summaries, recaps or section write-ups and send them as attachments.",
    );
    expect(conversationDef).toContain(
      'enum: ["user", "assistant", "tool"]',
    );
  });
});

describe("PS2 — the push description states server behaviour instead of demanding full reproduction", () => {
  const conversation = src.indexOf('name: "push_conversation"');
  const thread = src.indexOf('name: "push_thread"');
  const conversationDef = conversation > -1 ? src.slice(conversation, thread) : "";

  it("drops the absolutist anti-summary register", () => {
    expect(conversationDef).not.toContain("Verbatim is non-negotiable");
    expect(conversationDef).not.toContain("Never summarize the transcript");
  });

  it("says what the person is doing and how big a window to start with", () => {
    expect(conversationDef).toContain(
      "saving their own conversation into their own record",
    );
    expect(conversationDef).toContain("about ten messages");
  });
});

/**
 * CANARY-1: the description carries a build marker so an installed client can be
 * asked which one it shows. The value comes from the exported constant, so the
 * marker and this test cannot drift apart.
 */
describe("CANARY-1 — the push_conversation description carries a build marker", () => {
  const conversation = src.indexOf('name: "push_conversation"');
  const thread = src.indexOf('name: "push_thread"');
  const conversationDef = conversation > -1 ? src.slice(conversation, thread) : "";

  // The description literal as written, then with its interpolations resolved
  // the way the server resolves them, so the marker is checked as served text.
  const literal = (() => {
    const body = conversationDef.slice(conversationDef.indexOf("description:"));
    return body.slice(0, body.indexOf("`,"));
  })();
  const rendered = literal
    .replace("${placementLine(vocab)}", "placed")
    .replace("${PUSH_DESC_BUILD}", PUSH_DESC_BUILD)
    .replace("${LASSO_CONNECTOR_VERSION}", LASSO_CONNECTOR_VERSION);

  it("ends with the marker built from the exported constant", () => {
    expect(rendered.endsWith(` desc-build: ${PUSH_DESC_BUILD} connector: ${LASSO_CONNECTOR_VERSION}`)).toBe(true);
  });

  it("sits one space after the final sentence and appears once", () => {
    expect(rendered).toContain(`one your client refused. placed desc-build: ${PUSH_DESC_BUILD}`);
    expect(rendered).not.toContain("  desc-build");
    expect(src.split("desc-build:").length - 1).toBe(1);
  });

  it("is a date-style marker, not a commit sha", () => {
    expect(PUSH_DESC_BUILD).toMatch(/^oct\d{2}[a-z]$/);
  });

  it("still keeps the two phrases PS1 removed out of the description", () => {
    expect(rendered).not.toContain("Verbatim is non-negotiable");
    expect(rendered).not.toContain("Never summarize the transcript");
  });
});



describe("PS3 — the description routes artifacts to text and carries the connector version", () => {
  const start = src.indexOf('`When the user');
  const literal = src.slice(start + 1, src.indexOf('`,', start));
  const rendered = literal.replace("${placementLine(vocab)}", "placed")
    .replace("${PUSH_DESC_BUILD}", PUSH_DESC_BUILD)
    .replace("${LASSO_CONNECTOR_VERSION}", LASSO_CONNECTOR_VERSION);
  it("preserves text routes and the bounded versioned description", () => {
    expect(rendered.length).toBeLessThan(3800);
    expect(rendered).toContain("read the document's text with its own read tool");
    expect(rendered).not.toContain("export tool first");
    expect(rendered).toContain("push_attachment once per attachment");
    expect(rendered).toContain("Call lasso_push_options first");
    expect(rendered).toContain("rejects a file_ref for a document with no rendition");
    expect(rendered.endsWith(`connector: ${LASSO_CONNECTOR_VERSION}`)).toBe(true);
    expect(PUSH_DESC_BUILD).toBe("oct27e");
    expect(LASSO_CONNECTOR_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

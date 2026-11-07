import { describe, expect, it } from "vitest";

import { resolveCitations, type ChatMessage, type RecordDocument } from "@/lib/ai.server";
import { fromAnthropicResponse, readAnthropicStream, toAnthropicBody } from "@/lib/anthropic.server";
import { recordDocument } from "@/lib/reflect-context.server";

const chat: RecordDocument = {
  id: "item-chat",
  title: "D8TAOPS venture-scale diligence",
  kind: "conversation",
  turnNumbers: [1, 2, 3],
  blocks: ["(turn 1, you said) what is venture scale", "(turn 2, the assistant replied) it means", "(turn 3, you said) ok"],
  context: "Type: ai_thread · Date: 2026-10-22",
};
const file: RecordDocument = { id: "item-doc", title: "D8 Notes.md", kind: "text", turnNumbers: [], blocks: ["Next steps: call Troy."], context: "Type: document" };

function sse(events: unknown[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const e of events) controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
      controller.close();
    },
  });
}

describe("TOTAL-1 documents and citations", () => {
  it("splits a stored conversation into one block per turn, labelled in plain words", () => {
    const raw = "TURN 1 USER: what is venture scale\n\nTURN 2 ASSISTANT: it means\nmore\n\nTURN 3 USER: ok";
    const doc = recordDocument({ id: "x", title: "Chat", type: "ai_thread" }, raw, "ctx");
    expect(doc.kind).toBe("conversation");
    expect(doc.turnNumbers).toEqual([1, 2, 3]);
    expect(doc.blocks[0]).toBe("(turn 1, you said) what is venture scale");
    expect(doc.blocks[1]).toBe("(turn 2, the assistant replied) it means\nmore");
    expect(doc.blocks[2]).toBe("(turn 3, you said) ok");
  });

  it("a file is one text block", () => {
    const doc = recordDocument({ id: "y", title: "Notes", type: "document" }, "hello", "ctx");
    expect(doc).toEqual({ id: "y", title: "Notes", kind: "text", turnNumbers: [], blocks: ["hello"], context: "ctx" });
  });

  it("the record turn becomes citable document blocks with the breakpoint on the last one", () => {
    const messages: ChatMessage[] = [
      { role: "system", content: "SYS" },
      { role: "user", content: "RECORD INDEX: 2 items", documents: [chat, file] },
      { role: "assistant", content: "I have read the record above." },
      { role: "user", content: "q" },
    ];
    const body = toAnthropicBody(messages, "claude-sonnet-5-5", {}, false) as { messages: { role: string; content: unknown }[] };
    const record = body.messages[0]!.content as Record<string, unknown>[];
    expect(record[0]).toEqual({ type: "text", text: "RECORD INDEX: 2 items" });
    expect(record[1]).toMatchObject({ type: "document", title: chat.title, citations: { enabled: true }, context: chat.context });
    expect((record[1]!["source"] as { type: string; content: unknown[] }).type).toBe("content");
    expect((record[1]!["source"] as { content: unknown[] }).content).toHaveLength(3);
    expect(record[2]).toMatchObject({ type: "document", source: { type: "text", media_type: "text/plain", data: "Next steps: call Troy." }, cache_control: { type: "ephemeral" } });
    expect(record[1]!["cache_control"]).toBeUndefined();
    expect(record[0]!["cache_control"]).toBeUndefined();
  });

  it("a response's citations come back resolved to the item and the turn", () => {
    const parsed = fromAnthropicResponse(
      {
        model: "claude-sonnet-5-5",
        stop_reason: "end_turn",
        content: [
          { type: "text", text: "You asked ", citations: null },
          { type: "text", text: "what is venture scale", citations: [{ type: "content_block_location", cited_text: "what is venture scale", document_index: 0, document_title: chat.title, start_block_index: 0, end_block_index: 1 }] },
          { type: "text", text: " and noted ", citations: null },
          { type: "text", text: "call Troy", citations: [{ type: "char_location", cited_text: "call Troy.", document_index: 1, document_title: file.title, start_char_index: 12, end_char_index: 22 }] },
        ],
        usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 8 },
      },
      "claude-sonnet-5-5",
      {},
    );
    expect(parsed.text).toBe("You asked what is venture scale and noted call Troy");
    const resolved = resolveCitations(parsed.citations, [{ role: "user", content: "", documents: [chat, file] }]);
    expect(resolved).toEqual([
      { document_index: 0, document_id: "item-chat", document_title: chat.title, turn_no: 1, cited_text: "what is venture scale" },
      { document_index: 1, document_id: "item-doc", document_title: file.title, turn_no: null, cited_text: "call Troy." },
    ]);
  });

  it("a citation pointing outside the documents we sent is dropped", () => {
    expect(resolveCitations([{ document_index: 7, cited_text: "x" }], [{ role: "user", content: "", documents: [chat] }])).toEqual([]);
  });

  it("the stream carries citations_delta alongside text", async () => {
    const deltas: string[] = [];
    const out = await readAnthropicStream(
      sse([
        { type: "message_start", message: { model: "claude-sonnet-5-5", usage: { input_tokens: 3, cache_read_input_tokens: 2 } } },
        { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
        { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "ok " } },
        { type: "content_block_delta", index: 0, delta: { type: "citations_delta", citation: { type: "content_block_location", cited_text: "ok", document_index: 0, start_block_index: 2, end_block_index: 3 } } },
        { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 1 } },
      ]),
      (d) => {
        deltas.push(d);
      },
      "claude-sonnet-5-5",
      {},
    );
    expect(deltas).toEqual(["ok "]);
    expect(out.citations).toEqual([{ document_index: 0, cited_text: "ok", start_block_index: 2, end_block_index: 3 }]);
    expect(resolveCitations(out.citations, [{ role: "user", content: "", documents: [chat] }])[0]?.turn_no).toBe(3);
  });
});

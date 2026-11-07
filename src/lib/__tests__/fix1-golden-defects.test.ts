import { describe, expect, it } from "vitest";

import { RECORD_ACK, buildReflectConversation } from "@/lib/prompt-assembly";
import { unmatchedQuotes } from "@/lib/quote-check";
import { extractTurnRefs } from "@/lib/turn-labels";

// Each case is a defect the golden set found on 7 Nov, in the words the model used.
describe("FIX-1 golden-set defects", () => {
  const chats = [
    { id: "dili", title: "D8TAOPS venture-scale diligence" },
    { id: "req", title: "D8TAOPS data request — opportunity history" },
  ];

  it("a turn attaches to the chat named before it even when the dash became a comma", () => {
    const answer =
      '"D8TAOPS venture-scale diligence" runs to turn 50, with 21 of those turns from you. D8TAOPS data request, opportunity history runs to turn 12, with 6 of those turns from you.';
    const refs = extractTurnRefs(answer, chats);
    expect(refs.map((r) => [r.work_item_id, r.turn_no])).toEqual([
      ["dili", 50],
      ["req", 12],
    ]);
  });

  it("when one title sits inside another, the longer, nearer one wins", () => {
    const refs = extractTurnRefs("In Branch of D8TAOPS venture-scale diligence, turn 3 asks again.", [
      ...chats,
      { id: "branch", title: "Branch of D8TAOPS venture-scale diligence" },
    ]);
    expect(refs[0]?.work_item_id).toBe("branch");
  });

  it("ranges still read as two turns, and a number after a full stop is not a range", () => {
    expect(extractTurnRefs("Turns 3-5 in D8TAOPS venture-scale diligence.", chats).map((r) => r.turn_no)).toEqual([3, 5]);
    expect(extractTurnRefs("D8TAOPS venture-scale diligence, turn 5. 4 items follow.", chats).map((r) => r.turn_no)).toEqual([5]);
  });

  it("a quoted title whose dash became a comma is verbatim; changed words are not", () => {
    const context = "WORK ITEM: D8TAOPS data request — opportunity history";
    expect(unmatchedQuotes('In "D8TAOPS data request, opportunity history" you asked twice.', context)).toEqual([]);
    expect(unmatchedQuotes('In "D8TAOPS data request, opportunity forecast" you asked twice.', context)).toHaveLength(1);
  });

  it("the cited record is the same bytes whatever view the question came from", () => {
    const prompts = [{ role: "system" as const, content: "SYS" }];
    const docs = [{ id: "a", title: "Chat", kind: "conversation" as const, turnNumbers: [1], blocks: ["(turn 1, you said) hi"] }];
    const board = buildReflectConversation({ prompts, historyMessages: [], scopeMode: "engagements", context: "", documents: docs, preamble: "INDEX", message: "q", perQuestionNote: "WHERE THE PERSON IS: on the workboard D8." });
    const stream = buildReflectConversation({ prompts, historyMessages: [], scopeMode: "tasks", context: "", documents: docs, preamble: "INDEX", message: "q", perQuestionNote: "WHERE THE PERSON IS: on a chosen set of workstreams." });
    const ack = board.findIndex((t) => t.content === RECORD_ACK);
    expect(board.slice(0, ack + 1)).toEqual(stream.slice(0, ack + 1));
    expect(stream.at(-1)!.content).toContain("chosen set of workstreams");
  });
});

/** ATTACH-1: Add work groups a chat with its pieces and picks them together. */
import { describe, expect, it } from "vitest";

import { orderWithBundles, toggleWithPieces } from "@/lib/add-work-selection";
import type { BundleItem } from "@/components/canvas-lab/canvas-lab-model";

const CHAT = "chat-1";
const PIECE_A = "piece-a";
const PIECE_B = "piece-b";

function chat(id: string): BundleItem {
  return {
    id,
    type: "ai_thread",
    owner_id: "me",
    orig_conversation_id: "conv-1",
    captured_at: "2026-10-01T00:00:00Z",
  };
}

function piece(id: string, turn: number): BundleItem {
  return {
    id,
    type: "document",
    owner_id: "me",
    orig_conversation_id: "conv-1",
    captured_at: "2026-10-01T00:00:00Z",
    source_meta: { role: "attachment", produced_at_turn: turn },
  };
}

describe("ATTACH-1 toggleWithPieces", () => {
  it("ticking a chat with two pieces selects three ids", () => {
    const next = toggleWithPieces(new Set(), CHAT, [PIECE_A, PIECE_B]);
    expect([...next].sort()).toEqual([CHAT, PIECE_A, PIECE_B].sort());
  });

  it("unticking that chat clears all three", () => {
    const picked = toggleWithPieces(new Set(), CHAT, [PIECE_A, PIECE_B]);
    const next = toggleWithPieces(picked, CHAT, [PIECE_A, PIECE_B]);
    expect(next.size).toBe(0);
  });

  it("ticking a piece alone selects only that piece", () => {
    const next = toggleWithPieces(new Set(), PIECE_A, []);
    expect([...next]).toEqual([PIECE_A]);
  });

  it("selecting both pieces does not select the chat", () => {
    let picked = toggleWithPieces(new Set(), PIECE_A, []);
    picked = toggleWithPieces(picked, PIECE_B, []);
    expect(picked.has(PIECE_A)).toBe(true);
    expect(picked.has(PIECE_B)).toBe(true);
    expect(picked.has(CHAT)).toBe(false);
  });

  it("does not mutate the set it was given", () => {
    const picked = new Set([CHAT]);
    toggleWithPieces(picked, PIECE_A, []);
    expect([...picked]).toEqual([CHAT]);
  });
});

describe("ATTACH-1 orderWithBundles", () => {
  it("docks each piece under its chat, in bundle order", () => {
    const rows = orderWithBundles([chat(CHAT), piece(PIECE_B, 2), piece(PIECE_A, 1)]);
    expect(rows.map((row) => row.item.id)).toEqual([CHAT, PIECE_A, PIECE_B]);
    expect(rows[0]?.chatId).toBeNull();
    expect(rows[1]?.chatId).toBe(CHAT);
    expect(rows[2]?.chatId).toBe(CHAT);
  });

  it("returns a piece whose chat is absent from the list as a top-level row", () => {
    const rows = orderWithBundles([piece(PIECE_A, 1), chat("chat-other")]);
    const orphan = rows.find((row) => row.item.id === PIECE_A);
    expect(orphan).toBeDefined();
    expect(orphan?.chatId).toBeNull();
  });

  it("keeps unrelated work as top-level rows", () => {
    const loose: BundleItem = { id: "loose", type: "document", owner_id: "me" };
    const rows = orderWithBundles([loose, chat(CHAT), piece(PIECE_A, 1)]);
    expect(rows.map((row) => row.item.id)).toEqual(["loose", CHAT, PIECE_A]);
  });
});

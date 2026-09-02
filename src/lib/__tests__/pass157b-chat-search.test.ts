import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  CHAT_SEARCH_DEBOUNCE_MS,
  CHAT_SEARCH_MIN_CHARS,
  isSettledQuery,
  queryLenBand,
  resultBand,
} from "@/lib/chat-search-signal";
import { mapEventForEgress, type EgressEventRow } from "@/lib/egress-shared";

describe("chat library search — the bands", () => {
  it("bands the query length at its edges", () => {
    expect(queryLenBand(1)).toBe("1-10");
    expect(queryLenBand(10)).toBe("1-10");
    expect(queryLenBand(11)).toBe("11-30");
    expect(queryLenBand(30)).toBe("11-30");
    expect(queryLenBand(31)).toBe("31-80");
    expect(queryLenBand(80)).toBe("31-80");
    expect(queryLenBand(81)).toBe("80+");
  });

  it("bands the result count at its edges", () => {
    expect(resultBand(0)).toBe("0");
    expect(resultBand(1)).toBe("1-5");
    expect(resultBand(5)).toBe("1-5");
    expect(resultBand(6)).toBe("6-20");
    expect(resultBand(20)).toBe("6-20");
    expect(resultBand(21)).toBe("21+");
  });

  it("waits for two characters and a still second and a half", () => {
    expect(CHAT_SEARCH_MIN_CHARS).toBe(2);
    expect(CHAT_SEARCH_DEBOUNCE_MS).toBe(1500);
    expect(isSettledQuery("a")).toBe(false);
    expect(isSettledQuery(" a ")).toBe(false);
    expect(isSettledQuery("ab")).toBe(true);
  });
});

describe("chat library search — no event per keystroke", () => {
  it("debounces in the hook and never records on change alone", () => {
    const src = readFileSync("src/hooks/use-chat-search-signal.ts", "utf8");
    expect(src).toContain("setTimeout");
    expect(src).toContain("CHAT_SEARCH_DEBOUNCE_MS");
    expect(src).toContain("clearTimeout");
    // A query already recorded is never recorded again as a plain search.
    expect(src).toContain("lastSent.current === trimmed");

    const page = readFileSync("src/pages/AiRecordPage.tsx", "utf8");
    expect(page).toContain('placeholder="Search your chats"');
    expect(page).not.toMatch(/onChange=\{[^}]*noteChatSearch/);
  });

  it("keeps the words out of dims and in the payload", () => {
    const src = readFileSync("src/lib/chat-library.functions.ts", "utf8");
    expect(src).toContain("chatlib.search");
    expect(src).toContain("payload: { query:");
    expect(src).not.toMatch(/dims:[\s\S]{0,200}query:/);
  });
});

function row(over: Partial<EgressEventRow> = {}): EgressEventRow {
  return {
    id: 1,
    event_uuid: "u1",
    event_type: "chatlib.search",
    ts: "2026-09-01T10:00:00.000Z",
    tenant_hash: "tenant",
    actor_hash: "actor",
    org_id: "org-1",
    schema_version: "v2",
    consent_tier: "b",
    consent_ledger_version: 3,
    dims: { query_len_band: "11-30", result_band: "1-5", had_click: false },
    payload: { query: "pricing deck rewrite" },
    ...over,
  };
}

describe("chat library search — what leaves at each level", () => {
  it("sends no query text at counts level", () => {
    const mapped = mapEventForEgress(row({ consent_tier: "b" }));
    expect(mapped.kind).toBe("send");
    const serialized = JSON.stringify(mapped);
    expect(serialized).not.toContain("pricing deck rewrite");
    expect(serialized).not.toContain('"query"');
  });

  it("sends the query at work details level", () => {
    const mapped = mapEventForEgress(row({ consent_tier: "c" }));
    expect(mapped.kind).toBe("send");
    if (mapped.kind !== "send") return;
    expect((mapped.event as { dims: Record<string, unknown> }).dims["query"]).toBe(
      "pricing deck rewrite",
    );
    expect((mapped.event as { dims: Record<string, unknown> }).dims["query_len_band"]).toBe(
      "11-30",
    );
  });
});

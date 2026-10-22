import { beforeEach, describe, expect, it, vi } from "vitest";

// Follows the hoisted-mock pattern used by pass125-archive-metering.test.ts
// and the neighbouring sh1a thread test: every server module ensureExtract
// dynamically imports is mocked, and the call recordEvent receives is pinned.
const mocks = vi.hoisted(() => ({
  recordEvent: vi.fn(),
  upsert: vi.fn(),
  getItemText: vi.fn(),
  chat: vi.fn(),
  orgNameFor: vi.fn(),
  logHealth: vi.fn(),
  /** The stored work_item_extracts row (null = no extract yet). */
  existing: null as { content_hash: string } | null,
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "work_items") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "wi-1",
                  title: "Pricing notes",
                  owner_id: "profile-7",
                  org_id: "org-9",
                  content: null,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "work_item_extracts") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: mocks.existing, error: null }) }),
          }),
          upsert: mocks.upsert,
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  },
}));

vi.mock("@/lib/item-text.server", () => ({
  ITEM_TEXT_COLUMNS: "content",
  getItemText: mocks.getItemText,
}));

vi.mock("@/lib/ai.server", () => ({
  MODELS: { fast: "fast-model" },
  chatComplete: mocks.chat,
  orgNameFor: mocks.orgNameFor,
}));

vi.mock("@/lib/health.server", () => ({ logHealth: mocks.logHealth }));
vi.mock("./ai-usage", () => ({ usageDims: vi.fn(() => ({})) }));
vi.mock("./telemetry.server", () => ({ recordEvent: mocks.recordEvent }));

import { ensureExtract } from "@/lib/extract.server";

const COMPLETION = {
  text: JSON.stringify({ summary: "A pricing memo." }),
  tokensIn: 10,
  tokensOut: 5,
  costUsd: 0.01,
};

async function hashOf(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

beforeEach(async () => {
  for (const m of [
    mocks.recordEvent,
    mocks.upsert,
    mocks.getItemText,
    mocks.chat,
    mocks.orgNameFor,
    mocks.logHealth,
  ]) {
    m.mockReset();
  }
  mocks.existing = null;
  mocks.getItemText.mockResolvedValue({ status: "ok", reason: null, text: "Readable text." });
  mocks.chat.mockResolvedValue(COMPLETION);
  mocks.orgNameFor.mockResolvedValue("Org");
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.recordEvent.mockResolvedValue(undefined);
});

describe("ea1: extract.generated carries the person (EXTRACT-ATTR)", () => {
  it("records extract.generated with the owner's profileId and no userId", async () => {
    const ok = await ensureExtract("wi-1");
    expect(ok).toBe(true);
    expect(mocks.recordEvent).toHaveBeenCalledTimes(1);
    const event = (mocks.recordEvent.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
    expect(event["eventType"]).toBe("extract.generated");
    expect(event["orgId"]).toBe("org-9");
    expect(event["profileId"]).toBe("profile-7");
    expect(event["userId"]).toBeNull();
  });

  it("records nothing when the source text is unchanged", async () => {
    mocks.existing = { content_hash: await hashOf("Readable text.") };
    const ok = await ensureExtract("wi-1");
    expect(ok).toBe(true);
    expect(mocks.recordEvent).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  SHARED_SENTENCE_CACHE_TTL_MS,
  clearSharedSentenceCache,
  sharedSentenceCacheSize,
  sharedSentenceKey,
  withSharedSentenceCache,
} from "@/lib/shared-sentence-cache";

const DELIVERABLE = "The rebuild lands in March and the pricing stays tiered.";

beforeEach(() => clearSharedSentenceCache());

describe("shared sentence memo", () => {
  it("computes once for the same deliverable text and candidate", async () => {
    const load = vi.fn(async () => ({ text: "a quote", turn_no: 3, role: "user" }));
    const key = sharedSentenceKey(DELIVERABLE, "item-1");
    const first = await withSharedSentenceCache(key, load);
    const second = await withSharedSentenceCache(key, load);
    expect(load).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it("misses when the deliverable text changes", async () => {
    const load = vi.fn(async () => null);
    await withSharedSentenceCache(sharedSentenceKey(DELIVERABLE, "item-1"), load);
    await withSharedSentenceCache(sharedSentenceKey(`${DELIVERABLE} Revised.`, "item-1"), load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("misses for a different candidate", async () => {
    const load = vi.fn(async () => null);
    await withSharedSentenceCache(sharedSentenceKey(DELIVERABLE, "item-1"), load);
    await withSharedSentenceCache(sharedSentenceKey(DELIVERABLE, "item-2"), load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("recomputes once the entry has aged out", async () => {
    const load = vi.fn(async () => null);
    const key = sharedSentenceKey(DELIVERABLE, "item-1");
    await withSharedSentenceCache(key, load, 0);
    await withSharedSentenceCache(key, load, SHARED_SENTENCE_CACHE_TTL_MS + 1);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("clears, and a cold cache behaves like no cache", async () => {
    const load = vi.fn(async () => null);
    const key = sharedSentenceKey(DELIVERABLE, "item-1");
    await withSharedSentenceCache(key, load);
    expect(sharedSentenceCacheSize()).toBe(1);
    clearSharedSentenceCache();
    expect(sharedSentenceCacheSize()).toBe(0);
    await withSharedSentenceCache(key, load);
    expect(load).toHaveBeenCalledTimes(2);
  });
});

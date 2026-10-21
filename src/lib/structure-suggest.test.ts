import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  GENERIC_REGION_NAMES,
  STRUCTURE_INPUT_MAX_BYTES,
  DIGEST_CHUNKS_MAX,
  DIGEST_CHUNK_MAX_BYTES,
  validateInput,
  validateStructure,
  validateStructures,
  chunkInput,
  mergeDigests,
  type StructureDigest,
} from "@/lib/structure-suggest-shared";

vi.mock("@/lib/ai.server", () => ({ chatComplete: vi.fn() }));
vi.mock("@/lib/telemetry.server", () => ({ recordEvent: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));
import { recordEvent } from "@/lib/telemetry.server";
import { guardEventDims } from "@/lib/event-dim-allowlist";
import { chatComplete } from "@/lib/ai.server";
import { suggestStructures } from "@/lib/structure-suggest.server";

const base = { id: "a", cut: "workstream", title: "By cost pool", why: "The call kept returning to three cost pools." };

describe("structure validator", () => {
  it("rejects a structure containing Discovery", () => {
    const result = validateStructure({ ...base, regions: ["Warehouse cost", "Discovery", "Freight lanes"] });
    expect(result).toEqual({ ok: false, reason: "generic_region_name" });
  });

  it("rejects generic names case-insensitively", () => {
    expect(validateStructure({ ...base, regions: ["Warehouse cost", "NEXT STEPS", "Freight lanes"] })).toEqual({ ok: false, reason: "generic_region_name" });
    expect(GENERIC_REGION_NAMES).toEqual(expect.arrayContaining(["discovery", "analysis", "recommendation", "next steps", "research", "findings", "conclusion", "change management", "operating model", "data and analytics", "project management", "miscellaneous", "other", "general"]));
  });

  it("rejects two and six regions, passes three and five", () => {
    expect(validateStructure({ ...base, regions: ["A cost", "B cost"] })).toEqual({ ok: false, reason: "too_few_regions" });
    expect(validateStructure({ ...base, regions: ["A", "B", "C", "D", "E", "F"] })).toEqual({ ok: false, reason: "too_many_regions" });
    expect(validateStructure({ ...base, regions: ["A", "B", "C"] }).ok).toBe(true);
    expect(validateStructure({ ...base, regions: ["A", "B", "C", "D", "E"] }).ok).toBe(true);
  });

  it("rejects a 33-character name and accepts 32", () => {
    expect(validateStructure({ ...base, regions: ["x".repeat(33), "B", "C"] })).toEqual({ ok: false, reason: "region_name_too_long" });
    expect(validateStructure({ ...base, regions: ["x".repeat(32), "B", "C"] }).ok).toBe(true);
  });

  it("rejects duplicate names inside one structure", () => {
    expect(validateStructure({ ...base, regions: ["Warehouse cost", "warehouse cost", "Freight"] })).toEqual({ ok: false, reason: "duplicate_region_name" });
  });

  it("rejects a cut outside the closed set", () => {
    expect(validateStructure({ ...base, cut: "theme", regions: ["A", "B", "C"] })).toEqual({ ok: false, reason: "bad_cut" });
  });

  it("passes a valid three-structure response through unchanged", () => {
    const structures = [
      { id: "q", cut: "question", title: "By question", why: "Two open questions drive the work.", regions: ["Asset 1 diligence", "Asset 2 diligence", "Lease exposure"] },
      { id: "d", cut: "deliverable", title: "By deliverable", why: "The board wants three outputs.", regions: ["Board memo", "Savings model", "Vendor shortlist", "Site map"] },
      { id: "w", cut: "workstream", title: "By workstream", why: "Three teams own the cost pools.", regions: ["Warehouse cost", "Procurement savings", "Freight lanes", "Fleet leases", "IT contracts"] },
    ];
    const check = validateStructures({ structures });
    expect(check.rejected).toEqual([]);
    expect(check.valid).toEqual(structures);
  });

  it("never lets a generic structure through a whole response", () => {
    const check = validateStructures({ structures: [
      { ...base, regions: ["Warehouse cost", "Freight", "Fleet"] },
      { ...base, id: "b", cut: "question", regions: ["Analysis", "Freight", "Fleet"] },
    ] });
    expect(check.valid.map((s) => s.id)).toEqual(["a"]);
    expect(check.rejected).toEqual([{ index: 1, reason: "generic_region_name" }]);
  });

  it("allows phase at most once and never repeats a cut", () => {
    const check = validateStructures([
      { ...base, id: "p1", cut: "phase", regions: ["A", "B", "C"] },
      { ...base, id: "p2", cut: "phase", regions: ["D", "E", "F"] },
      { ...base, id: "w2", regions: ["G", "H", "I"] },
      { ...base, id: "w3", regions: ["J", "K", "L"] },
    ]);
    expect(check.valid.map((s) => s.id)).toEqual(["p1", "w2"]);
    expect(check.rejected.map((r) => r.reason)).toEqual(["second_phase", "duplicate_cut"]);
  });

  it("returns nothing for a malformed response", () => {
    expect(validateStructures(null).valid).toEqual([]);
    expect(validateStructures({ structures: "x" }).valid).toEqual([]);
  });
});

describe("input cap", () => {
  it("refuses above total chunk capacity and accepts exactly that capacity", () => {
    expect(STRUCTURE_INPUT_MAX_BYTES).toBe(DIGEST_CHUNKS_MAX * DIGEST_CHUNK_MAX_BYTES);
    expect(STRUCTURE_INPUT_MAX_BYTES).toBe(2048000);
    expect(validateInput({ kind: "document", text: "a".repeat(STRUCTURE_INPUT_MAX_BYTES + 1) })).toEqual({ ok: false, reason: "text_too_large" });
    expect(validateInput({ kind: "document", text: "a".repeat(STRUCTURE_INPUT_MAX_BYTES) }).ok).toBe(true);
    expect(validateInput({ kind: "email", text: "hi" })).toEqual({ ok: false, reason: "bad_kind" });
  });
});

describe("read everything then propose", () => {
  beforeEach(() => { vi.mocked(chatComplete).mockReset(); vi.mocked(recordEvent).mockReset(); });

  const digest = (names: StructureDigest["names"], statedGoal: string | null = null, arc: string | null = null): StructureDigest => ({ names, statedGoal, arc });
  const response = (value: unknown, costUsd = 0) => ({ text: JSON.stringify(value), costUsd }) as Awaited<ReturnType<typeof chatComplete>>;
  const structures = ["question", "deliverable", "workstream"].map((cut) => ({ ...base, cut, regions: ["Warehouse cost", "Freight lanes", "Fleet leases"] }));

  it("splits 95 KB into three chunks without losing text or splitting words", () => {
    const text = "warehouse ".repeat(9728);
    expect(new TextEncoder().encode(text).length).toBe(95 * 1024);
    const result = chunkInput(text);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.chunks).toHaveLength(3);
    expect(result.chunks.join("")).toBe(text);
    for (const chunk of result.chunks) {
      expect(new TextEncoder().encode(chunk).length).toBeLessThanOrEqual(40 * 1024);
      expect(chunk.endsWith(" ")).toBe(true);
    }
  });

  it("counts UTF-8 bytes and prefers a paragraph near the limit", () => {
    const first = "café ".repeat(6500) + "\n\n";
    const text = first + "lease ".repeat(1000);
    const result = chunkInput(text);
    if (!result.ok) throw new Error(result.reason);
    expect(result.chunks[0]).toBe(first);
    expect(result.chunks.join("")).toBe(text);
    expect(result.chunks.every((chunk) => new TextEncoder().encode(chunk).length <= 40 * 1024)).toBe(true);
  });

  it("refuses more than 50 chunks without making calls", async () => {
    const text = "word ".repeat(409601);
    expect(chunkInput(text)).toEqual({ ok: false, reason: "too_many_chunks" });
    expect(await suggestStructures({ kind: "document", text })).toEqual({ status: "refused", reason: "text_too_large" });
    expect(chatComplete).not.toHaveBeenCalled();
  });

  it("refuses a word larger than a chunk rather than splitting or dropping it", () => {
    expect(chunkInput("x".repeat(40 * 1024 + 1))).toEqual({ ok: false, reason: "word_too_large" });
  });

  it("merges case-insensitively, collapses whitespace, and keeps first spelling and non-null context", () => {
    expect(mergeDigests([
      digest([{ name: "Warehouse  cost", kind: "cost_pool", mentions: 2 }]),
      digest([{ name: " warehouse COST ", kind: "cost_pool", mentions: 3 }], "Reduce freight cost", "Lease review then renewal"),
      digest([], "Later goal", "Later arc"),
    ])).toEqual(digest([{ name: "Warehouse  cost", kind: "cost_pool", mentions: 5 }], "Reduce freight cost", "Lease review then renewal"));
  });

  it("sorts descending by mentions and caps the merged list at 60", () => {
    const merged = mergeDigests([digest(Array.from({ length: 70 }, (_, i) => ({ name: `Asset ${i}`, kind: "object", mentions: i + 1 })))]);
    expect(merged.names).toHaveLength(60);
    expect(merged.names.map((entry) => entry.mentions)).toEqual(Array.from({ length: 60 }, (_, i) => 70 - i));
    expect(merged.names[0]?.name).toBe("Asset 69");
  });

  it.each(["Liam's", "Liam’s"])("rejects possessive region %s", (name) => {
    expect(validateStructure({ ...base, regions: [name, "Freight lanes", "Fleet leases"] })).toEqual({ ok: false, reason: "possessive_region_name" });
  });

  it("continues after one failed chunk and sends only the digest to smart tier", async () => {
    const text = "RAW_EXPORT_MARKER ".repeat(3000);
    const read = digest([{ name: "Warehouse cost", kind: "cost_pool", mentions: 2 }], "Reduce cost");
    vi.mocked(chatComplete).mockRejectedValueOnce(new Error("chunk failed"))
      .mockResolvedValueOnce(response(read)).mockResolvedValueOnce(response({ structures }));
    const result = await suggestStructures({ text, kind: "transcript" });
    expect(result).toMatchObject({ status: "ok", lostChunks: 1, shortfall: null });
    expect(chatComplete).toHaveBeenCalledTimes(3);
    expect(vi.mocked(chatComplete).mock.calls.map((call) => call[1]?.tier)).toEqual(["fast", "fast", "smart"]);
    const proposal = vi.mocked(chatComplete).mock.calls[2];
    const readWithFlags = { ...read, names: read.names.map((entry) => ({ ...entry, outOfScope: false })) };
    expect(proposal?.[0][1]?.content).toBe(`Source kind: transcript\n\nDigest:\n${JSON.stringify(readWithFlags)}`);
    expect(JSON.stringify(proposal?.[0])).not.toContain("RAW_EXPORT_MARKER");
    expect(proposal?.[0][0]?.content).toContain("Do not offer the phase cut");
  });

  it("retains one retry and two valid structures with a shortfall", async () => {
    vi.mocked(chatComplete).mockResolvedValueOnce(response(digest([])))
      .mockResolvedValueOnce(response({ structures: structures.slice(0, 2) }))
      .mockResolvedValueOnce(response({ structures: [{ ...base, regions: ["Discovery", "Freight", "Fleet"] }] }));
    expect(await suggestStructures({ kind: "document", text: "Warehouse cost" })).toMatchObject({
      status: "ok", lostChunks: 0, structures: [{ cut: "question" }, { cut: "deliverable" }],
      shortfall: "Only 2 of 3 suggestions met the naming and shape rules after one retry.",
    });
    expect(vi.mocked(chatComplete).mock.calls.map((call) => call[1]?.tier)).toEqual(["fast", "smart", "smart"]);
  });

  it("runs at most four digests and reports every settlement including failure", async () => {
    const text = "warehouse ".repeat(21000);
    const chunked = chunkInput(text);
    if (!chunked.ok) throw new Error(chunked.reason);
    expect(chunked.chunks).toHaveLength(6);
    const pending: { resolve: (value: Awaited<ReturnType<typeof chatComplete>>) => void; reject: (reason: Error) => void }[] = [];
    let active = 0;
    let peak = 0;
    vi.mocked(chatComplete).mockImplementation((_messages, options) => {
      if (options?.tier === "smart") return Promise.resolve(response({ structures }));
      active += 1;
      peak = Math.max(peak, active);
      return new Promise((resolve, reject) => pending.push({
        resolve: (value) => { active -= 1; resolve(value); },
        reject: (reason) => { active -= 1; reject(reason); },
      }));
    });
    const progress = vi.fn();
    const request = suggestStructures({ text, kind: "transcript" }, undefined, ORG, progress);
    expect(pending).toHaveLength(4);
    pending[1]?.reject(new Error("lost"));
    await vi.waitFor(() => expect(pending).toHaveLength(5));
    expect(progress).toHaveBeenLastCalledWith(1, 6);
    pending[4]?.resolve(response(digest([])));
    await vi.waitFor(() => expect(pending).toHaveLength(6));
    for (const index of [5, 3, 0, 2]) pending[index]?.resolve(response(digest([])));
    expect(await request).toMatchObject({ status: "ok", lostChunks: 1 });
    expect(peak).toBe(4);
    expect(progress.mock.calls).toEqual([[1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 6]]);
    expect(recordEvent).toHaveBeenCalledTimes(1);
  });

  it("produces the identical merged digest for different completion orders", async () => {
    const reads = [
      digest([{ name: "Warehouse  cost", kind: "cost_pool", mentions: 2 }, { name: "Freight lanes", kind: "object", mentions: 5 }], "First goal", "First arc"),
      digest([{ name: "warehouse COST", kind: "cost_pool", mentions: 3 }], "Second goal", "Second arc"),
      digest([{ name: "Fleet leases", kind: "object", mentions: 5 }]),
    ];
    async function finish(order: number[]) {
      vi.mocked(chatComplete).mockReset();
      const pending: ((value: Awaited<ReturnType<typeof chatComplete>>) => void)[] = [];
      vi.mocked(chatComplete).mockImplementation((_messages, options) => options?.tier === "smart"
        ? Promise.resolve(response({ structures }))
        : new Promise((resolve) => pending.push(resolve)));
      const request = suggestStructures({ text: "warehouse ".repeat(9728), kind: "document" });
      expect(pending).toHaveLength(3);
      for (const index of order) {
        pending[index]?.(response(reads[index]));
        await Promise.resolve();
      }
      await request;
      return vi.mocked(chatComplete).mock.calls.find((call) => call[1]?.tier === "smart")?.[0][1]?.content;
    }
    const first = await finish([0, 1, 2]);
    const second = await finish([2, 1, 0]);
    const readsWithFlags = reads.map((read) => ({ ...read, names: read.names.map((entry) => ({ ...entry, outOfScope: false })) }));
    expect(first).toBe(`Source kind: document\n\nDigest:\n${JSON.stringify(mergeDigests(readsWithFlags))}`);
    expect(second).toBe(first);
  });

  it("ignores progress callback exceptions without losing chunks or repeating the event", async () => {
    vi.mocked(chatComplete).mockResolvedValueOnce(response(digest([]))).mockResolvedValueOnce(response({ structures }));
    expect(await suggestStructures({ text: "Warehouse", kind: "document" }, undefined, ORG, () => { throw new Error("view closed"); })).toMatchObject({ status: "ok", lostChunks: 0 });
    expect(recordEvent).toHaveBeenCalledTimes(1);
  });

  it("counts malformed digests as lost and reports all chunks lost", async () => {
    vi.mocked(chatComplete).mockResolvedValueOnce(response({ names: [{ name: "Liam", kind: "person", mentions: 1 }], statedGoal: null, arc: null }));
    expect(await suggestStructures({ kind: "document", text: "Warehouse" })).toEqual({ status: "failed", reason: "No chunk digest could be generated.", lostChunks: 1 });
    expect(chatComplete).toHaveBeenCalledTimes(1);
  });

  const ORG = "structure-test-org";
  const allowedKeys = ["source_kind", "input_band", "chunks_band", "lost_chunks", "returned", "retried", "outcome", "reason", "digest_cost_band", "propose_cost_band"];
  function emittedDims() {
    expect(recordEvent).toHaveBeenCalledTimes(1);
    const event = vi.mocked(recordEvent).mock.calls[0]?.[1];
    if (!event?.dims) throw new Error("Expected event dims");
    expect(event.eventType).toBe("structure.suggested");
    expect(event.orgId).toBe(ORG);
    // Like unitS8: inspect every emitted key, not just a selected safe subset.
    for (const key of Object.keys(event.dims)) expect(allowedKeys).toContain(key);
    expect(guardEventDims("structure.suggested", event.dims).dims).toEqual(event.dims);
    return event.dims;
  }

  it("fires once for ok with separate summed digest and proposal cost bands, including retry", async () => {
    const read = digest([{ name: "SECRET_DIGEST_NAME", kind: "object", mentions: 1 }], "SECRET_GOAL", "SECRET_ARC");
    vi.mocked(chatComplete).mockResolvedValueOnce(response(read, 0.03)).mockResolvedValueOnce(response(read, 0.03))
      .mockResolvedValueOnce(response({ structures: structures.slice(0, 2) }, 0.02))
      .mockResolvedValueOnce(response({ structures: structures.slice(2) }, 0.02));
    await suggestStructures({ kind: "mixed", text: "SECRET_INPUT ".repeat(4000) }, { surface: "test", orgId: "wrong-org", userId: "SECRET_PERSON" }, ORG);
    expect(emittedDims()).toEqual({ source_kind: "mixed", input_band: "40-160KB", chunks_band: "2-4", lost_chunks: "0", returned: "3", retried: true, outcome: "ok", digest_cost_band: "$0.05-0.25", propose_cost_band: "$0.01-0.05" });
  });

  it("fires once for refused without inventing a chunk count", async () => {
    await suggestStructures({ kind: "document", text: "x".repeat(STRUCTURE_INPUT_MAX_BYTES + 1) }, undefined, ORG);
    expect(emittedDims()).toEqual({ source_kind: "document", input_band: "760KB+", lost_chunks: "0", returned: "0", retried: false, outcome: "refused", reason: "text_too_large", digest_cost_band: "<$0.01", propose_cost_band: "<$0.01" });
    expect(chatComplete).not.toHaveBeenCalled();
  });

  it("fires once for failed, never copying an exception message into dims", async () => {
    vi.mocked(chatComplete).mockRejectedValueOnce(new Error("SECRET_EXCEPTION"));
    await suggestStructures({ kind: "transcript", text: "SECRET_INPUT" }, undefined, ORG);
    expect(emittedDims()).toEqual({ source_kind: "transcript", input_band: "0-40KB", chunks_band: "1", lost_chunks: "1", returned: "0", retried: false, outcome: "failed", reason: "No chunk digest could be generated.", digest_cost_band: "<$0.01", propose_cost_band: "<$0.01" });
  });

  it("never substitutes meta.orgId when explicit orgId is missing", async () => {
    vi.mocked(chatComplete).mockResolvedValueOnce(response(digest([]))).mockResolvedValueOnce(response({ structures }));
    await suggestStructures({ kind: "document", text: "Warehouse" }, { surface: "test", orgId: ORG });
    await suggestStructures({ kind: "document", text: "" }, { surface: "test", orgId: ORG });
    vi.mocked(chatComplete).mockRejectedValueOnce(new Error("failure"));
    await suggestStructures({ kind: "document", text: "Warehouse" }, { surface: "test", orgId: ORG });
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("omits invalid source kind rather than recording arbitrary input", async () => {
    await suggestStructures({ kind: "SECRET_KIND", text: "Warehouse" }, undefined, ORG);
    expect(emittedDims()).not.toHaveProperty("source_kind");
    expect(emittedDims()["reason"]).toBe("bad_kind");
  });
});

describe("what a region is allowed to be", () => {
  beforeEach(() => { vi.mocked(chatComplete).mockReset(); vi.mocked(recordEvent).mockReset(); });

  const digest = (names: StructureDigest["names"], statedGoal: string | null = null, arc: string | null = null): StructureDigest => ({ names, statedGoal, arc });
  const response = (value: unknown, costUsd = 0) => ({ text: JSON.stringify(value), costUsd }) as Awaited<ReturnType<typeof chatComplete>>;
  const structures = ["question", "deliverable", "workstream"].map((cut) => ({ ...base, cut, regions: ["Carrier and freight cost", "Warehouse lease decision", "Private label margin"] }));

  it("rejects a region equal to the board title, case and whitespace insensitive", () => {
    expect(validateStructure({ ...base, regions: ["Meridian Foods margin review", "Freight", "Fleet"] }, "Meridian Foods margin review"))
      .toEqual({ ok: false, reason: "region_is_the_board" });
    expect(validateStructure({ ...base, regions: ["  meridian foods   margin REVIEW ", "Freight", "Fleet"] }, "Meridian Foods margin review"))
      .toEqual({ ok: false, reason: "region_is_the_board" });
  });

  it.each(["November", "November 2026", "2026"])("rejects the date-only region %s", (name) => {
    expect(validateStructure({ ...base, regions: [name, "Freight", "Fleet"] })).toEqual({ ok: false, reason: "region_is_a_date" });
  });

  it("does not reject a deliverable that names a month", () => {
    expect(validateStructure({ ...base, regions: ["November board pack", "Freight", "Fleet"] }).ok).toBe(true);
  });

  it("puts the board title in the stage 2 prompt as the container name", async () => {
    vi.mocked(chatComplete).mockResolvedValueOnce(response(digest([]))).mockResolvedValueOnce(response({ structures }));
    await suggestStructures({ kind: "document", text: "Warehouse" }, undefined, undefined, undefined, "Meridian Foods margin review");
    const proposal = vi.mocked(chatComplete).mock.calls.find((call) => call[1]?.tier === "smart");
    expect(proposal?.[0][1]?.content).toContain("Container name, never a region: Meridian Foods margin review");
  });

  it("passes a structure whose regions are fine unchanged, board title supplied", async () => {
    vi.mocked(chatComplete).mockResolvedValueOnce(response(digest([]))).mockResolvedValueOnce(response({ structures }));
    const result = await suggestStructures({ kind: "document", text: "Warehouse" }, undefined, undefined, undefined, "Meridian Foods margin review");
    expect(result).toMatchObject({ status: "ok", shortfall: null, lostChunks: 0 });
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.structures.map((entry) => entry.regions)).toEqual(structures.map((entry) => entry.regions));
  });

  it("rejects a board-titled region through a whole response and keeps the valid ones", () => {
    const check = validateStructures({ structures: [
      { ...base, regions: ["Meridian Foods margin review", "Freight", "Fleet"] },
      { ...base, id: "b", cut: "question", regions: ["Carrier and freight cost", "Warehouse lease decision", "Private label margin"] },
    ] }, "Meridian Foods margin review");
    expect(check.valid.map((s) => s.id)).toEqual(["b"]);
    expect(check.rejected).toEqual([{ index: 0, reason: "region_is_the_board" }]);
  });
});

describe("out of scope material", () => {
  beforeEach(() => { vi.mocked(chatComplete).mockReset(); vi.mocked(recordEvent).mockReset(); });

  const digest = (names: StructureDigest["names"], statedGoal: string | null = null, arc: string | null = null): StructureDigest => ({ names, statedGoal, arc });
  const response = (value: unknown, costUsd = 0) => ({ text: JSON.stringify(value), costUsd }) as Awaited<ReturnType<typeof chatComplete>>;
  const structures = ["question", "deliverable", "workstream"].map((cut) => ({ ...base, cut, regions: ["Carrier and freight cost", "Warehouse lease decision", "Private label margin"] }));

  it("marks a name out of scope when any chunk says so, and leaves it unset otherwise", () => {
    const merged = mergeDigests([
      digest([{ name: "Procurement savings", kind: "function", mentions: 2 }, { name: "Freight lanes", kind: "object", mentions: 1 }]),
      digest([{ name: "procurement  SAVINGS", kind: "function", mentions: 1, outOfScope: true }]),
      digest([{ name: "Freight lanes", kind: "object", mentions: 2, outOfScope: false }]),
    ]);
    expect(merged.names.find((entry) => entry.name === "Procurement savings")).toEqual({ name: "Procurement savings", kind: "function", mentions: 3, outOfScope: true });
    expect(merged.names.find((entry) => entry.name === "Freight lanes")).toEqual({ name: "Freight lanes", kind: "object", mentions: 3 });
  });

  it("carries the outOfScope flag into the stage 2 prompt, which bars it from regions", async () => {
    const read = digest([{ name: "Procurement savings", kind: "function", mentions: 3, outOfScope: true }]);
    vi.mocked(chatComplete).mockResolvedValueOnce(response(read)).mockResolvedValueOnce(response({ structures }));
    await suggestStructures({ kind: "transcript", text: "Warehouse" });
    const proposal = vi.mocked(chatComplete).mock.calls.find((call) => call[1]?.tier === "smart");
    expect(proposal?.[0][1]?.content).toContain('"outOfScope":true');
    expect(proposal?.[0][0]?.content).toContain("Names marked outOfScope in the digest are never regions.");
    expect(proposal?.[0][0]?.content).toContain("Write every region name in sentence case: capital on the first word and on proper nouns only. Never all lower case, never title case.");
  });
});

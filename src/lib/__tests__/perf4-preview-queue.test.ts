import { describe, expect, it } from "vitest";

import { enqueue, PREVIEW_CONCURRENCY } from "@/hooks/use-workboard-file-previews";

function gate() {
  let open!: () => void;
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { promise, open };
}

describe("PERF-4: board file previews load a few at a time", () => {
  it("runs up to three at once and starts the next as one finishes", async () => {
    expect(PREVIEW_CONCURRENCY).toBe(3);
    const gates = Array.from({ length: 5 }, gate);
    const started: number[] = [];
    const done = gates.map((g, i) => enqueue(async () => { started.push(i); await g.promise; return i; }));
    await Promise.resolve();
    expect(started).toEqual([0, 1, 2]);
    gates[1]!.open();
    await done[1];
    await Promise.resolve();
    expect(started).toEqual([0, 1, 2, 3]);
    for (const g of gates) g.open();
    expect(await Promise.all(done)).toEqual([0, 1, 2, 3, 4]);
  });

  it("passes a failure back to its own caller and keeps the queue moving", async () => {
    const failing = enqueue(async () => { throw new Error("no preview"); });
    const thrown = enqueue(() => { throw new Error("threw at once"); });
    const after = enqueue(async () => "next");
    await expect(failing).rejects.toThrow("no preview");
    await expect(thrown).rejects.toThrow("threw at once");
    expect(await after).toBe("next");
  });
});

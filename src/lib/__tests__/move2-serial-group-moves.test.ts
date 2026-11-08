// MOVE-2: two quick moves of the same section never clash. 8 Nov live check: the second move,
// 1.4 s after the first, was sent with the versions the first save had just replaced.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { createSerialQueue } from "@/lib/serial-queue";

const page = readFileSync(resolve(process.cwd(), "src/pages/CanvasLabPage.tsx"), "utf8");

describe("MOVE-2 group moves go one at a time", () => {
  it("a second job starts only after the first has finished, and sees what the first wrote", async () => {
    const enqueue = createSerialQueue();
    let version = 1;
    const seen: number[] = [];
    let release!: () => void;
    const first = enqueue(async () => { seen.push(version); await new Promise<void>((r) => { release = r; }); version = 2; return "a"; });
    const second = enqueue(async () => { seen.push(version); return "b"; });
    await Promise.resolve();
    expect(seen).toEqual([1]);
    release();
    expect(await first).toBe("a");
    expect(await second).toBe("b");
    expect(seen).toEqual([1, 2]);
  });

  it("a failed job does not block the next one", async () => {
    const enqueue = createSerialQueue();
    const failed = enqueue(async () => { throw new Error("no"); });
    await expect(failed).rejects.toThrow("no");
    expect(await enqueue(async () => "next")).toBe("next");
  });

  it("the board queues every group move and updates its refs before the next one reads them", () => {
    expect(page).toContain("return moveQueueRef.current(() => sendMoveMany(frameIds, nodeIds));");
    const send = page.slice(page.indexOf("async function sendMoveMany("), page.indexOf("async function persistLink("));
    expect(send.indexOf("framesRef.current = framesRef.current.map(bump);")).toBeLessThan(send.indexOf("setFrames((current) => current?.map(bump) ?? current);"));
    expect(send).toContain("nodesRef.current = nodesRef.current.map(bump);");
  });

  it("Retry my change on a group move resends every row with its current version", () => {
    const resolveConflict = page.slice(page.indexOf("function resolveConflict("), page.indexOf("end durable save pipeline"));
    expect(resolveConflict).toContain('if (state.retry.type === "move_many")');
    expect(resolveConflict).toContain("const fresh = await lab.refresh();");
    expect(resolveConflict).toContain("expectedVersion: versionOf.get(entry.nodeId) ?? entry.expectedVersion");
  });

  it("the server writes a group move's rows together, each with its own version check", () => {
    const server = readFileSync(resolve(process.cwd(), "src/lib/canvas-lab.server.ts"), "utf8");
    const move = server.slice(server.indexOf("export async function moveMany("));
    expect(move).toContain("await Promise.all([...frameWrites, ...nodeWrites]);");
    expect(move).toContain('.eq("version", entry.expectedVersion)');
  });
});

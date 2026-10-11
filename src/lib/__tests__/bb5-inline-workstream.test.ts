/**
 * BB-5: "+ workstream" makes a real workstream, and moving work into one files it.
 * The page is too data-bound to mount, so its wiring is pinned as source and the
 * event helper is driven for real.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

const logEvent = vi.fn();
vi.mock("@/lib/telemetry", () => ({ logEvent: (...args: unknown[]) => logEvent(...args) }));
const { noteWorkboardWorkstreamCreated } = await import("@/components/canvas-lab/canvas-lab-telemetry");
const { WORKBOARD_EVENT_DIMS } = await import("@/lib/workboard-event-allowlist");

const source = readFileSync(resolve(__dirname, "../../pages/CanvasLabPage.tsx"), "utf8");
const fn = (name: string, end: string) => { const a = source.indexOf(`function ${name}(`); return source.slice(a, source.indexOf(end, a)); };
const addWorkstream = fn("addWorkstream", "// W3: the colour block is retired.");
const moveToFrame = fn("moveToFrame", "\n  }\n");

describe("BB-5 inline workstream", () => {
  it("creates the workstream first, then persists a task frame", () => {
    const create = addWorkstream.indexOf("createDrawnWorkstream({ data: { engagement_id: engagementId, name, profile_id: profile?.id } })");
    const persist = addWorkstream.indexOf("await persistDrawnFrame(frame, created.id)");
    expect(create).toBeGreaterThan(0);
    expect(persist).toBeGreaterThan(create);
    expect(addWorkstream).toContain("id: `task:${created.id}`");
  });

  it("never saves a custom frame from this path, and adds nothing on failure", () => {
    expect(addWorkstream).not.toContain('kind: "custom"');
    const failure = addWorkstream.slice(addWorkstream.indexOf("} catch {"), addWorkstream.indexOf("const frame"));
    expect(failure).toContain("return;");
    expect(failure).not.toContain("setFrames");
  });

  it("files work moved into a task frame, and only moves cards otherwise", () => {
    expect(moveToFrame).toContain("const taskId = frameTaskId(target);");
    expect(moveToFrame).toMatch(/if \(taskId && node\.workItemId\) \{\s*void claimCard\(node as ClaimCandidate, taskId, frameId\)/);
    expect(moveToFrame.lastIndexOf("applyFrameMove(node.id, frameId);")).toBeGreaterThan(moveToFrame.indexOf("claimCard("));
    expect(fn("claimCard", "async function commitDrawnWorkstream")).toContain("moveItemToWorkstream({ data: { item_id: card.workItemId, task_id: taskId");
  });

  it("fires workstream_created once with only via and claimed", () => {
    expect(addWorkstream.match(/noteWorkboardWorkstreamCreated\(/g)).toHaveLength(1);
    noteWorkboardWorkstreamCreated("org", 0);
    noteWorkboardWorkstreamCreated("org", 7);
    noteWorkboardWorkstreamCreated(undefined, 1);
    expect(logEvent).toHaveBeenCalledTimes(2);
    expect(logEvent).toHaveBeenNthCalledWith(1, "workboard.workstream_created", "org", { via: "inline_add", claimed: "0" });
    expect(logEvent).toHaveBeenNthCalledWith(2, "workboard.workstream_created", "org", { via: "inline_add", claimed: "5-19" });
    expect(WORKBOARD_EVENT_DIMS["workboard.workstream_created"]).toEqual(["via", "claimed"]);
  });
});

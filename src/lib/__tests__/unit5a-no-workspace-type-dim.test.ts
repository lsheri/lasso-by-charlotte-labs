import { describe, expect, it } from "vitest";

import { ALL_EVENT_DIM_KEYS, EVENT_DIM_KEYS } from "../event-dim-allowlist";
import { WORKBOARD_EVENT_DIMS } from "../workboard-event-allowlist";

/**
 * workspace_type is a column on the events table, stamped server-side and
 * immutable. A dim naming a workspace would only be meaningful if an event
 * could be about a different workspace than the one it is stamped with, for
 * example a partner acting inside a client's workspace. That is not what
 * workspace_type means: it is the acting workspace, which is exactly what
 * the column already holds. If that case ever arrives it needs a differently
 * named dim, not this one back.
 *
 * No exemptions. If workspace_type is added back to either allowlist, this
 * test fails on purpose.
 */
function workspaceTypeKeys(table: Readonly<Record<string, readonly string[]>>): string[] {
  return Object.entries(table)
    .filter(([, keys]) => keys.some((k) => k === "workspace_type"))
    .map(([name]) => name);
}

describe("unit 5a no event declares a workspace_type dim", () => {
  it("EVENT_DIM_KEYS", () => expect(workspaceTypeKeys(EVENT_DIM_KEYS)).toEqual([]));
  it("ALL_EVENT_DIM_KEYS", () =>
    expect(workspaceTypeKeys(ALL_EVENT_DIM_KEYS as Readonly<Record<string, readonly string[]>>)).toEqual([]));
  it("WORKBOARD_EVENT_DIMS", () => expect(workspaceTypeKeys(WORKBOARD_EVENT_DIMS)).toEqual([]));
});

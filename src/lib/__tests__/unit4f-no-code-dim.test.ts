import { describe, expect, it } from "vitest";

import { ALL_EVENT_DIM_KEYS, EVENT_DIM_KEYS } from "../event-dim-allowlist";
import { WORKBOARD_EVENT_DIMS } from "../workboard-event-allowlist";

/**
 * A workboard code is derived from a container name, so it can carry part of
 * a client's name. It is content. No event may ever declare it as a dim.
 */
function codeKeys(table: Readonly<Record<string, readonly string[]>>): string[] {
  return Object.entries(table)
    .filter(([, keys]) => keys.some((k) => k === "code" || /(^|_)code$/.test(k)))
    .map(([name]) => name);
}

describe("unit 4f no event declares a code dim", () => {
  it("EVENT_DIM_KEYS", () => expect(codeKeys(EVENT_DIM_KEYS)).toEqual([]));
  it("ALL_EVENT_DIM_KEYS", () =>
    expect(codeKeys(ALL_EVENT_DIM_KEYS as Readonly<Record<string, readonly string[]>>)).toEqual([]));
  it("WORKBOARD_EVENT_DIMS", () => expect(codeKeys(WORKBOARD_EVENT_DIMS)).toEqual([]));
});

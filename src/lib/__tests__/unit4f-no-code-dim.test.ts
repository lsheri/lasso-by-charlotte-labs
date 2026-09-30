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

/**
 * The only exceptions, pinned by name. These three send the invented public
 * demo board code (YSM-01 and friends), never a real workboard's code. The
 * list may shrink; it may never grow without this test being edited.
 */
const DEMO_CODE_EXEMPT = ["demo.preset_opened", "demo.presets_regenerated", "demo.turn_opened"];

function offenders(table: Readonly<Record<string, readonly string[]>>): string[] {
  return codeKeys(table).filter((name) => !DEMO_CODE_EXEMPT.includes(name));
}

describe("unit 4f no event declares a code dim", () => {
  it("EVENT_DIM_KEYS", () => expect(offenders(EVENT_DIM_KEYS)).toEqual([]));
  it("ALL_EVENT_DIM_KEYS", () =>
    expect(offenders(ALL_EVENT_DIM_KEYS as Readonly<Record<string, readonly string[]>>)).toEqual([]));
  it("WORKBOARD_EVENT_DIMS", () => expect(codeKeys(WORKBOARD_EVENT_DIMS)).toEqual([]));
  it("the demo exemption is exactly the three invented-code events", () =>
    expect(codeKeys(EVENT_DIM_KEYS).sort()).toEqual(DEMO_CODE_EXEMPT));
});

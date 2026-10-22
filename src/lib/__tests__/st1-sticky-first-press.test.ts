import { describe, expect, it } from "vitest";

import { stickyStartsEditing, stickyTriggerEntersEdit } from "@/lib/card-click";

describe("ST-1 sticky edit decisions", () => {
  it("starts a selected editable empty sticky in editing mode", () => {
    expect(stickyStartsEditing({ selected: true, editable: true, textLength: 0 })).toBe(true);
  });

  it("does not enter editing on a single click", () => {
    expect(stickyTriggerEntersEdit("click", true)).toBe(false);
  });

  it("enters editing on a double click", () => {
    expect(stickyTriggerEntersEdit("doubleClick", true)).toBe(true);
  });
});
import { describe, expect, it } from "vitest";
import { cardBodyClickSelects, cardDoubleClick, stickyStartsEditing, stickyTriggerEntersEdit } from "@/lib/card-click";

const at = (x: number, y: number) => ({ x, y });

describe("BI-1 card clicks", () => {
  it("a clean single click selects", () => {
    expect(cardBodyClickSelects({ readOnly: false, clickCount: 1, down: at(10, 10), up: at(12, 11), onControl: false })).toBe(true);
  });
  it("a click that moved past the threshold does not select", () => {
    expect(cardBodyClickSelects({ readOnly: false, clickCount: 1, down: at(10, 10), up: at(20, 10), onControl: false })).toBe(false);
  });
  it("the second click of a double-click, a control click, and read-only never select", () => {
    expect(cardBodyClickSelects({ readOnly: false, clickCount: 2, down: at(0, 0), up: at(0, 0), onControl: false })).toBe(false);
    expect(cardBodyClickSelects({ readOnly: false, clickCount: 1, down: at(0, 0), up: at(0, 0), onControl: true })).toBe(false);
    expect(cardBodyClickSelects({ readOnly: true, clickCount: 1, down: at(0, 0), up: at(0, 0), onControl: false })).toBe(false);
  });
  it("a double-click opens and undoes the first click's select", () => {
    expect(cardDoubleClick({ readOnly: false, moved: false, onControl: false, firstClickSelected: true })).toEqual({ open: true, undoSelect: true });
  });
  it("a non-deliverable card opens on double-click (no deliverable input exists)", () => {
    expect(cardDoubleClick({ readOnly: false, moved: false, onControl: false, firstClickSelected: false }).open).toBe(true);
  });
  it("a dragged or read-only double-click does nothing", () => {
    expect(cardDoubleClick({ readOnly: false, moved: true, onControl: false, firstClickSelected: true })).toEqual({ open: false, undoSelect: false });
    expect(cardDoubleClick({ readOnly: true, moved: false, onControl: false, firstClickSelected: true }).open).toBe(false);
  });
});

describe("BI-1 stickies", () => {
  it("an empty sticky does not enter edit on a single click", () => {
    expect(stickyTriggerEntersEdit("click", true)).toBe(false);
  });
  it("double-click and the pencil enter edit when editable", () => {
    expect(stickyTriggerEntersEdit("doubleClick", true)).toBe(true);
    expect(stickyTriggerEntersEdit("pencil", true)).toBe(true);
    expect(stickyTriggerEntersEdit("pencil", false)).toBe(false);
  });
  it("a brand-new selected empty sticky still auto-enters edit", () => {
    expect(stickyStartsEditing({ selected: true, editable: true, textLength: 0 })).toBe(true);
    expect(stickyStartsEditing({ selected: true, editable: true, textLength: 3 })).toBe(false);
    expect(stickyStartsEditing({ selected: false, editable: true, textLength: 0 })).toBe(false);
  });
});

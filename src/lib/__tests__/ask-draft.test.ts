import { describe, expect, it } from "vitest";
import { askDraftFromLocation, resolveAskDraft, resolveAskDrop } from "@/lib/ask-draft";

const ID = "id-preview--57cd51ce-f7b4-4cd0-a7d0-761453b5935b.lovable.app";

describe("ASK-D1 gate", () => {
  it.each(["lasso.charlotte-labs.com", "lasso-coaching-hub.lovable.app", "project--57cd51ce-f7b4-4cd0-a7d0-761453b5935b.lovable.app"])("is null on %s whatever the query", (host) => {
    expect(askDraftFromLocation(host, "?ask=a")).toBeNull();
    expect(askDraftFromLocation(host, "?ask=b")).toBeNull();
    const store = new Map<string, string>([["lasso.ask-draft", "a"]]);
    const s = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
    expect(resolveAskDraft(host, "", s)).toBeNull();
  });
  it("returns a and b on an id-preview host", () => {
    expect(askDraftFromLocation(ID, "?ask=a")).toBe("a");
    expect(askDraftFromLocation(ID, "?ask=b")).toBe("b");
  });
  it("is null with no param", () => {
    expect(askDraftFromLocation(ID, "")).toBeNull();
    expect(askDraftFromLocation(ID, "?ask=c")).toBeNull();
  });
  it("remembers the choice on the preview host and ask=off clears it", () => {
    const store = new Map<string, string>();
    const s = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
    expect(resolveAskDraft(ID, "?ask=b", s)).toBe("b");
    expect(resolveAskDraft(ID, "", s)).toBe("b");
    expect(resolveAskDraft(ID, "?ask=off", s)).toBeNull();
    expect(resolveAskDraft(ID, "", s)).toBeNull();
  });
});

describe("ASK-D1 drop targets", () => {
  const W = 1200, H = 800;
  it("resolves each target and free", () => {
    expect(resolveAskDrop(600, 740, W, H)).toBe("bottom_centre");
    expect(resolveAskDrop(1100, 740, W, H)).toBe("bottom_right");
    expect(resolveAskDrop(40, 300, W, H)).toBe("lock_left");
    expect(resolveAskDrop(1160, 300, W, H)).toBe("lock_right");
    expect(resolveAskDrop(600, 300, W, H)).toBe("free");
  });
});

import { autoPinPoint, revealPan } from "@/lib/ask-draft";

describe("ASK-D2 automatic pin point", () => {
  it("sits 40 board pixels right of the picked cards, top aligned", () => {
    const picked = [{ x: 100, y: 200, width: 240, height: 120 }, { x: 80, y: 260, width: 200, height: 100 }];
    expect(autoPinPoint(picked, [...picked])).toEqual({ x: 380, y: 200 });
  });
  it("moves clear of another card in the way", () => {
    const picked = [{ x: 100, y: 200, width: 240, height: 120 }];
    const blocker = { x: 380, y: 200, width: 280, height: 200 };
    const at = autoPinPoint(picked, [...picked, blocker])!;
    const overlaps = at.x < blocker.x + blocker.width && at.x + 240 > blocker.x && at.y < blocker.y + blocker.height && at.y + 120 > blocker.y;
    expect(overlaps).toBe(false);
  });
  it("pans only when the point is off the visible canvas", () => {
    expect(revealPan({ x: 100, y: 100 }, { x: 0, y: 0 }, 1, { width: 1200, height: 800 })).toBeNull();
    expect(revealPan({ x: 1100, y: 100 }, { x: 0, y: 0 }, 1, { width: 1200, height: 800 })).toEqual({ x: -196, y: 0 });
  });
});

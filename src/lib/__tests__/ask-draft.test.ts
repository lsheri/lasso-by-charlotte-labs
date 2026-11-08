import { describe, expect, it } from "vitest";
import { askDraftFromLocation, resolveAskDraft } from "@/lib/ask-draft";

const ID = "id-preview--57cd51ce-f7b4-4cd0-a7d0-761453b5935b.lovable.app";

describe("ASK-D1 gate, lifted 7 Nov for draft b", () => {
  const PROD_HOSTS = ["lasso.charlotte-labs.com", "lasso-coaching-hub.lovable.app", "project--57cd51ce-f7b4-4cd0-a7d0-761453b5935b.lovable.app"];
  const mkStore = (seed: [string, string][] = []) => { const store = new Map<string, string>(seed); return { store, s: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) } }; };
  it.each(PROD_HOSTS)("the ?ask=a|b experiment switch stays off on %s", (host) => {
    expect(askDraftFromLocation(host, "?ask=a")).toBeNull();
    expect(askDraftFromLocation(host, "?ask=b")).toBeNull();
  });
  it.each(PROD_HOSTS)("%s gets draft b by default, never a, even with a remembered a or ?ask=a", (host) => {
    expect(resolveAskDraft(host, "", mkStore().s)).toBe("b");
    expect(resolveAskDraft(host, "", mkStore([["lasso.ask-draft", "a"]]).s)).toBe("b");
    expect(resolveAskDraft(host, "?ask=a", mkStore().s)).toBe("b");
  });
  it.each(PROD_HOSTS)("ask=off on %s is remembered and returns the docked panel; ask=on undoes it", (host) => {
    const { store, s } = mkStore();
    expect(resolveAskDraft(host, "?ask=off", s)).toBeNull();
    expect(store.get("lasso.ask-draft")).toBe("off");
    expect(resolveAskDraft(host, "", s)).toBeNull();
    expect(resolveAskDraft(host, "?ask=on", s)).toBe("b");
    expect(resolveAskDraft(host, "", s)).toBe("b");
  });
  it("survives storage that throws", () => {
    const bad = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } };
    expect(resolveAskDraft("lasso.charlotte-labs.com", "", bad)).toBe("b");
    expect(resolveAskDraft("lasso.charlotte-labs.com", "?ask=off", bad)).toBeNull();
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

describe("ASK-B1 default draft", () => {
  const mk = () => { const store = new Map<string, string>(); return { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) }; };
  it("a preview host with an empty store resolves to b", () => {
    expect(resolveAskDraft(ID, "", mk())).toBe("b");
  });
  it("after ask=off it stays null", () => {
    const s = mk();
    expect(resolveAskDraft(ID, "?ask=off", s)).toBeNull();
    expect(s.getItem("lasso.ask-draft")).toBe("off");
    expect(resolveAskDraft(ID, "", s)).toBeNull();
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
    expect(at).not.toEqual({ x: 380, y: 200 });
    const overlaps = at.x < blocker.x + blocker.width && at.x + 280 > blocker.x && at.y < blocker.y + blocker.height && at.y + 120 > blocker.y;
    expect(overlaps).toBe(false);
  });
  it("pans only when the point is off the visible canvas", () => {
    expect(revealPan({ x: 100, y: 100 }, { x: 0, y: 0 }, 1, { width: 1200, height: 800 })).toBeNull();
    expect(revealPan({ x: 1100, y: 100 }, { x: 0, y: 0 }, 1, { width: 1200, height: 800 })).toEqual({ x: -196, y: 0 });
  });
});

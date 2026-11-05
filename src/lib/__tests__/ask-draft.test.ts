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

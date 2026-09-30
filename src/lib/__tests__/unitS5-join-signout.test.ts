import { describe, expect, it, vi } from "vitest";

import { signOutAndReturn } from "@/lib/join-return";

describe("Unit S5 sign out and continue", () => {
  it("signs out, then goes to /join?code=<the same code>", async () => {
    const order: string[] = [];
    const go = vi.fn((u: string) => order.push(`go:${u}`));
    await signOutAndReturn({
      clearCache: () => void order.push("clear"),
      signOut: async () => void order.push("signOut"),
      go,
      origin: "https://example.test",
      code: "ADM-NDMECQ",
    });
    expect(order.slice(0, 2)).toEqual(["clear", "signOut"]);
    expect(go).toHaveBeenCalledTimes(1);
    const u = new URL(go.mock.calls[0]![0]);
    expect(u.pathname).toBe("/join");
    expect(u.searchParams.get("code")).toBe("ADM-NDMECQ");
    expect(go.mock.calls[0]![0]).not.toContain("/join/ADM");
  });

  it("keeps eng and still leaves the screen when sign out throws", async () => {
    const go = vi.fn();
    await signOutAndReturn({
      clearCache: () => {},
      signOut: async () => {
        throw new Error("offline");
      },
      go,
      origin: "https://example.test",
      code: "A B&C",
      eng: "e1",
    });
    const u = new URL(go.mock.calls[0]![0]);
    expect(u.searchParams.get("code")).toBe("A B&C");
    expect(u.searchParams.get("eng")).toBe("e1");
  });
});

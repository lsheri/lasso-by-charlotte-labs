// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-profile", () => ({ useProfile: () => ({ data: { id: "me", org_id: "org" } }) }));
const logEvent = vi.fn();
vi.mock("@/lib/telemetry", () => ({ logEvent: (...args: unknown[]) => logEvent(...args) }));

import { readAskHome, readAskPosition, writeAskHome } from "@/lib/ask-draft";
import { AskHomeCard } from "@/components/settings/AskHomeCard";

function memStore(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed));
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) } as unknown as Storage;
}

afterEach(() => { cleanup(); window.localStorage.clear(); logEvent.mockClear(); });

describe("SET-1 Ask home", () => {
  it("defaults to bottom_right with no store, an empty store, or garbage", () => {
    expect(readAskHome(null)).toBe("bottom_right");
    expect(readAskHome(memStore())).toBe("bottom_right");
    expect(readAskHome(memStore({ "lasso.ask-draft.home": "upside_down" }))).toBe("bottom_right");
  });
  it("round-trips lock_left", () => {
    const store = memStore();
    writeAskHome("lock_left", store);
    expect(readAskHome(store)).toBe("lock_left");
  });
  it("readAskPosition falls back to the home for draft b and bottom_centre for draft a", () => {
    const store = memStore({ "lasso.ask-draft.home": "lock_right" });
    expect(readAskPosition("b", store)).toEqual({ to: "lock_right" });
    expect(readAskPosition("a", store)).toEqual({ to: "bottom_centre" });
  });
  it("card shows four radios, Bottom right by default, and Locked right writes the key", () => {
    render(<AskHomeCard />);
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    expect((screen.getByLabelText("Bottom right") as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByLabelText("Locked right"));
    expect(window.localStorage.getItem("lasso.ask-draft.home")).toBe("lock_right");
    expect(logEvent).toHaveBeenCalledWith("settings.changed", "org", { section: "appearance", setting: "ask_home", change: "updated" });
  });
});

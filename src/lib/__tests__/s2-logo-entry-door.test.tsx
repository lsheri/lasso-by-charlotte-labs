// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => (
    <a href={to} data-router="1" {...rest}>
      {children}
    </a>
  ),
}));

import { EntryDoorLink } from "@/components/layout/EntryDoorLink";
import { ENTRY_DOOR_KEY } from "@/lib/entry-door";

function hrefOf() {
  return screen.getByText("LASSO").closest("a")!.getAttribute("href");
}

describe("S2: the logo goes back to the entry door", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("1. no stored source points at Lasso's /", () => {
    render(<EntryDoorLink>LASSO</EntryDoorLink>);
    expect(hrefOf()).toBe("/");
  });

  it("2. front door points at charlotte-labs.com", () => {
    window.localStorage.setItem(ENTRY_DOOR_KEY, "front_door");
    render(<EntryDoorLink>LASSO</EntryDoorLink>);
    expect(hrefOf()).toBe("https://charlotte-labs.com");
    expect(screen.getByText("LASSO").closest("a")!.getAttribute("target")).toBeNull();
  });

  it("3. edu points at the edu origin", () => {
    window.localStorage.setItem(ENTRY_DOOR_KEY, "edu_landing");
    render(<EntryDoorLink>LASSO</EntryDoorLink>);
    expect(hrefOf()).toBe("https://edu.charlotte-labs.com");
  });

  it("4. an unmapped value points at /", () => {
    window.localStorage.setItem(ENTRY_DOOR_KEY, "ceiba");
    render(<EntryDoorLink>LASSO</EntryDoorLink>);
    expect(hrefOf()).toBe("/");
  });

  it("5. https://evil.test points at /", () => {
    window.localStorage.setItem(ENTRY_DOOR_KEY, "https://evil.test");
    render(<EntryDoorLink>LASSO</EntryDoorLink>);
    expect(hrefOf()).toBe("/");
  });

  it("6. a throwing storage read is no entry door", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(<EntryDoorLink>LASSO</EntryDoorLink>);
    expect(hrefOf()).toBe("/");
  });
});

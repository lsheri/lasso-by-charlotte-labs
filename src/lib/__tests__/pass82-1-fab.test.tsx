// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const routerState = { pathname: "/coaching/e1/s1" };
const profileState: { role: string } = { role: "coach" };

vi.mock("@tanstack/react-router", () => ({
  useRouterState: ({ select }: { select: (s: unknown) => unknown }) =>
    select({ location: { pathname: routerState.pathname } }),
  Link: ({ children, ...rest }: never) => <a {...(rest as object)}>{children as never}</a>,
}));

vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ data: { role: profileState.role } }),
}));

const handlerState: { handler: (() => void) | null } = { handler: null };
vi.mock("@/components/reflect/ask-lasso-context", () => ({
  useAskLassoHandler: () => handlerState.handler,
}));

import { AskLassoFab } from "@/components/reflect/AskLassoFab";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("AskLassoFab", () => {
  it("renders nothing for a coach with no registered handler", () => {
    profileState.role = "coach";
    handlerState.handler = null;
    const { container } = render(<AskLassoFab />);
    expect(container.textContent).toBe("");
  });

  it("renders for a coach once a page registers a handler", () => {
    profileState.role = "coach";
    handlerState.handler = () => undefined;
    render(<AskLassoFab />);
    expect(screen.getByLabelText("Ask Lasso")).toBeTruthy();
  });

  it("shows the hint once, then never again", () => {
    profileState.role = "em";
    handlerState.handler = null;
    const first = render(<AskLassoFab />);
    expect(first.container.textContent).toContain("Ask about the work on this page.");
    screen.getByLabelText("Ask Lasso").click();
    cleanup();
    const second = render(<AskLassoFab />);
    expect(second.container.textContent).not.toContain("Ask about the work on this page.");
  });
});

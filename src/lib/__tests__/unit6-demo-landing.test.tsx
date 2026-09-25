// @vitest-environment jsdom
import { createRef } from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const { noteDemoOpened } = vi.hoisted(() => ({ noteDemoOpened: vi.fn() }));
vi.mock("@/lib/demo-telemetry", () => ({ noteDemoOpened }));

import { useDemoHomeOpened } from "@/components/demo/DemoHomeWorkspace";

const LANDING = readFileSync("src/components/marketing/B2BLanding.tsx", "utf8");
const INDEX = readFileSync("src/routes/index.tsx", "utf8");
const DEMO_PAGE = readFileSync("src/pages/DemoPages.tsx", "utf8");
const DEMO_ROUTE = readFileSync("src/routes/demo.index.tsx", "utf8");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  noteDemoOpened.mockClear();
  document.body.innerHTML = "";
});

describe("Unit 6 demo plus landing", () => {
  it("keeps the signed-in redirect and renders the shared demo on both public entrances", () => {
    expect(INDEX).toContain('if (data.user) throw redirect({ to: "/home" })');
    expect(LANDING).toContain('<DemoHomeWorkspace surface="landing" />');
    expect(DEMO_PAGE).toContain('<DemoHomeWorkspace surface="home" />');
    expect(DEMO_ROUTE).toContain("DemoHomePage");
  });

  it("places the demo between the hero and hero video, followed by every existing section", () => {
    const ordered = [
      'className="landing-next-hero"',
      'id="demo"',
      "<HeroVideo />",
      'id="beats"',
      'className="landing-usecases',
      'className="landing-share',
      'className="landing-close',
      'id="pilot"',
      "<footer",
    ].map((marker) => LANDING.indexOf(marker));
    expect(ordered.every((position) => position >= 0)).toBe(true);
    expect(ordered).toEqual([...ordered].sort((a, b) => a - b));
    expect(LANDING).toContain("Open a real workspace. Every figure is invented.");
  });

  it("uses the new primary action for a smooth demo scroll and preserves its existing event", () => {
    expect(LANDING).toContain("Open the demo workspace");
    expect(LANDING).not.toContain("See it work ↓");
    expect(LANDING).toContain('document.querySelector("#demo")?.scrollIntoView({ behavior: "smooth", block: "start" })');
    expect(LANDING).toContain('event_type: "landing.see_it_work_clicked"');
    expect(LANDING).toContain('dims: { location: "hero" }');
  });

  it("records the landing demo once when it first intersects", () => {
    let callback: IntersectionObserverCallback = () => undefined;
    const disconnect = vi.fn();
    const observe = vi.fn();
    vi.stubGlobal("IntersectionObserver", class {
      constructor(next: IntersectionObserverCallback) { callback = next; }
      observe = observe;
      disconnect = disconnect;
    });
    const section = document.createElement("section");
    document.body.appendChild(section);
    const ref = createRef<HTMLElement>();
    ref.current = section;
    renderHook(() => useDemoHomeOpened("landing", ref));

    act(() => callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    act(() => callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));

    expect(observe).toHaveBeenCalledWith(section);
    expect(noteDemoOpened).toHaveBeenCalledOnce();
    expect(noteDemoOpened).toHaveBeenCalledWith("landing", "none");
    expect(disconnect).toHaveBeenCalled();
  });

  it("changes the board back destination by auth state and keeps pilot on the landing", () => {
    expect(DEMO_PAGE).toContain("const { session, loading: sessionLoading } = useSession()");
    expect(DEMO_PAGE).toContain('<Link to="/demo"');
    expect(DEMO_PAGE).toContain('<Link to="/" hash="demo"');
    expect(DEMO_PAGE).toContain('to="/"');
    expect(DEMO_PAGE).toContain('hash="pilot"');
  });

  it("does not touch the archived landing", () => {
    const archive = readFileSync("src/routes/landing-archive.2026-09-25.tsx", "utf8");
    expect(archive).toContain('createFileRoute("/landing-archive/2026-09-25")');
    expect(archive).not.toContain("DemoHomeWorkspace");
  });
});
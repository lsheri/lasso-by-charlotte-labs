// @vitest-environment jsdom
// The demo story keeps a beat's target in sight on a Home of any height: the page is moved when the beat starts, the
// person's own scrolling stops that, and the card steps aside when it would cover the target. Nothing is requested
// or stored for it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ access: vi.fn(), navigate: vi.fn(), log: vi.fn(), path: "/home" }));

vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => m.navigate,
  useRouterState: ({ select }: { select: (state: { location: { pathname: string; searchStr: string } }) => unknown }) =>
    select({ location: { pathname: m.path, searchStr: "?tour=1" } }),
}));
vi.mock("@/lib/firm-story.functions", () => ({ firmStoryAccessFn: (...a: unknown[]) => m.access(...a) }));
vi.mock("@/lib/telemetry", () => ({ logEvent: (...a: unknown[]) => m.log(...a) }));
vi.mock("@/components/skin/use-skin", () => ({ useBrand: () => ({ name: "Lasso" }) }));

import { FirmStory } from "@/components/firm-story/FirmStory";
/** Any demo workspace: found by its settings marker now, never by this id. */
const KESTREL_BAY_ORG_ID = "demo-org";

// The page as the browser would lay it out: 1440 x 900, the card 416 x 340 at the bottom past the sidebar.
const page = { askTop: 480, scrollY: 0, maxScroll: 2000 };
const rectOf = (top: number, left: number, width: number, height: number) => ({ top, left, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;

function layOut() {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const id = this.getAttribute("data-testid");
    if (id === "ask-the-firm") return rectOf(page.askTop - page.scrollY, 338, 1022, 172);
    if (id === "firm-story-card") {
      const frame = this.closest('[data-testid="firm-story"]') as HTMLElement | null;
      const top = frame?.style.top ? Number.parseFloat(frame.style.top) : 900 - 16 - 340;
      const left = frame?.style.justifyContent === "flex-end" ? 1440 - 16 - 416 : 270;
      return rectOf(top, left, 416, 340);
    }
    return rectOf(0, 0, 0, 0);
  });
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 900 });
  Object.defineProperty(window, "scrollY", { configurable: true, get: () => page.scrollY });
  window.scrollBy = vi.fn((options?: ScrollToOptions | number) => {
    const by = typeof options === "object" ? (options.top ?? 0) : 0;
    page.scrollY = Math.max(0, Math.min(page.maxScroll, page.scrollY + by));
  }) as typeof window.scrollBy;
}

async function toBeatOne() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <div data-testid="ask-the-firm" />
      <FirmStory profile={{ id: "p1", org_id: KESTREL_BAY_ORG_ID, demo_firm: true }} />
    </QueryClientProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10);
  });
  fireEvent.click(screen.getByTestId("firm-story-launcher"));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByTestId("firm-story-card").getAttribute("data-story-beat")).toBe("1");
}
const tick = (ms = 350) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const placement = () => screen.getByTestId("firm-story").getAttribute("data-story-placement");

beforeEach(() => {
  vi.useFakeTimers();
  window.sessionStorage.clear();
  m.access.mockReset().mockResolvedValue({ allowed: true, window: "partner", boardId: "story-board" });
  m.navigate.mockReset();
  m.path = "/home";
  Object.assign(page, { askTop: 480, scrollY: 0, maxScroll: 2000 });
  layOut();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("the demo story keeps its target in sight", () => {
  it("moves the page so a target under the card sits at the top, and leaves the card where it is", async () => {
    await toBeatOne();
    await tick();
    expect(page.scrollY).toBe(468);
    expect(placement()).toBe("bottom-start");
    expect(screen.getByTestId("firm-story").style.top).toBe("");
  });

  it("does not move a page whose target is already clear (a manager's Home)", async () => {
    page.askTop = 64;
    await toBeatOne();
    await tick(1000);
    expect(window.scrollBy).not.toHaveBeenCalled();
    expect(placement()).toBe("bottom-start");
  });

  it("follows a block that loads late above the target, however late, until the person scrolls", async () => {
    await toBeatOne();
    await tick();
    page.askTop = 1100; // the proposals rows arrived and pushed it back under the card
    await tick();
    expect(page.scrollY).toBe(1088);
    await tick(7000); // long after the page settled (QA second pass, finding A)
    page.askTop = 1700;
    await tick();
    expect(page.scrollY).toBe(1688);
    await tick(3000);
    fireEvent.wheel(window);
    page.askTop = 1900;
    await tick(700);
    expect(page.scrollY).toBe(1688);
  });

  it("stops moving the page once the person scrolls for themselves", async () => {
    await toBeatOne();
    await tick();
    fireEvent.wheel(window);
    page.scrollY = 0;
    await tick();
    expect(page.scrollY).toBe(0);
  });

  it("moves the card to a clear corner when the page cannot move far enough, and back when it can", async () => {
    page.maxScroll = 0;
    await toBeatOne();
    await tick(700);
    expect(placement()).toBe("top-end");
    expect(screen.getByTestId("firm-story").style.top).toBe("16px");
    fireEvent.wheel(window);
    page.askTop = 64;
    await tick(700);
    expect(placement()).toBe("bottom-start");
    expect(screen.getByTestId("firm-story").style.top).toBe("");
  });

  it("lines the page up again on a later beat that points at the same place", async () => {
    await toBeatOne();
    await tick();
    fireEvent.wheel(window);
    page.scrollY = 0;
    m.path = "/firm-brain";
    fireEvent.click(screen.getByRole("button", { name: "Next" })); // beat 2, on Firm brain
    m.path = "/home";
    fireEvent.click(screen.getByRole("button", { name: "Next" })); // beat 3, Home again
    await tick();
    expect(page.scrollY).toBe(468);
  });

  it("puts the card at the top of a phone on beat 2 (the firm map), and back at the bottom on beat 3", async () => {
    // A phone: 390 x 844, the map taller than the screen, the card 358 x 380 above the tab bar.
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      const id = this.getAttribute("data-testid");
      if (id === "firm-brain-map") return rectOf(205, 16, 358, 1400);
      if (id === "ask-the-firm") return rectOf(64, 16, 358, 300);
      if (id === "firm-story-card") {
        const frame = this.closest('[data-testid="firm-story"]') as HTMLElement | null;
        const top = frame?.style.top ? Number.parseFloat(frame.style.top) : 844 - 72 - 380;
        return rectOf(top, 16, 358, 380);
      }
      return rectOf(0, 0, 0, 0);
    });
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 844 });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <div data-testid="ask-the-firm" />
        <div data-testid="firm-brain-map" />
        <FirmStory profile={{ id: "p1", org_id: KESTREL_BAY_ORG_ID, demo_firm: true }} />
      </QueryClientProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    fireEvent.click(screen.getByTestId("firm-story-launcher"));
    fireEvent.click(screen.getByRole("button", { name: "Next" })); // beat 1, Home
    await tick(700);
    expect(placement()).toBe("bottom-start");
    m.path = "/firm-brain";
    fireEvent.click(screen.getByRole("button", { name: "Next" })); // beat 2, Firm brain
    await tick(700);
    expect(screen.getByTestId("firm-story-card").getAttribute("data-story-beat")).toBe("2");
    expect(placement()).toBe("top-start");
    expect(screen.getByTestId("firm-story").style.top).toBe("16px");
    expect(window.scrollBy).not.toHaveBeenCalled(); // the map is read from its top, with the page where it is
    m.path = "/home";
    fireEvent.click(screen.getByRole("button", { name: "Next" })); // beat 3, Home again
    await tick(700);
    expect(placement()).toBe("bottom-start");
    expect(screen.getByTestId("firm-story").style.top).toBe("");
  });

  it("asks the server for nothing more and stores only the beat", async () => {
    await toBeatOne();
    await tick(1000);
    expect(m.access).toHaveBeenCalledTimes(1);
    expect(Object.keys(window.sessionStorage)).toHaveLength(1);
  });
});

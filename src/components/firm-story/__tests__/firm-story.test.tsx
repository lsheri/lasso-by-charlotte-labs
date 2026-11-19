// @vitest-environment jsdom
// 19 Nov, Kestrel Bay demo story: the overlay in the signed-in shell. Hidden without the flag, outside the demo firm,
// when the server says no and when its check fails; both modes from one script; the "You are" chip and the handoff
// card; explore and resume on the same beat; only the beat number is stored; reactions and the role pick leave as
// content-free events; the product name follows the brand.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  flag: true,
  access: vi.fn(),
  navigate: vi.fn(),
  log: vi.fn(),
  path: "/home",
  brand: "Charlotte",
}));

vi.mock("@/hooks/use-feature-flag", () => ({ useFeatureFlag: () => m.flag }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => m.navigate,
  useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => unknown }) => select({ location: { pathname: m.path } }),
}));
vi.mock("@/lib/firm-story.functions", () => ({ firmStoryAccessFn: (...a: unknown[]) => m.access(...a) }));
vi.mock("@/lib/telemetry", () => ({ logEvent: (...a: unknown[]) => m.log(...a) }));
vi.mock("@/components/skin/use-skin", () => ({ useBrand: () => ({ name: m.brand }) }));

import { FirmStory } from "@/components/firm-story/FirmStory";
import { FIRM_STORY_SCRIPT } from "@/lib/firm-story-script";
import { KESTREL_BAY_ORG_ID, STORY_STORAGE_KEY } from "@/lib/firm-story-shared";

const demoProfile = { id: "p1", org_id: KESTREL_BAY_ORG_ID };

function mount(profile: { id: string; org_id: string } | null = demoProfile): ReactNode {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <FirmStory profile={profile} />
    </QueryClientProvider>,
  );
  return null;
}

const card = () => screen.getByTestId("firm-story-card");
const launcher = () => screen.findByTestId("firm-story-launcher");
const next = () => fireEvent.click(screen.getByRole("button", { name: /^(Next|Finish)$/ }));

async function start() {
  fireEvent.click(await launcher());
  return card();
}

beforeEach(() => {
  m.flag = true;
  m.path = "/home";
  m.brand = "Charlotte";
  m.access.mockReset().mockResolvedValue({ allowed: true, window: "partner" });
  m.navigate.mockReset();
  m.log.mockReset();
  window.sessionStorage.clear();
  window.localStorage.clear();
  window.history.replaceState(null, "", "/home");
});

afterEach(cleanup);

describe("who sees the story", () => {
  it("renders nothing and calls nothing without the flag", async () => {
    m.flag = false;
    mount();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByTestId("firm-story")).toBeNull();
    expect(m.access).not.toHaveBeenCalled();
  });

  it("renders nothing and calls nothing for a profile in another workspace, or with no profile", async () => {
    mount({ id: "p9", org_id: "15db4d78-eed3-4443-b9ef-437a67ad1b79" });
    mount(null);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByTestId("firm-story")).toBeNull();
    expect(m.access).not.toHaveBeenCalled();
  });

  it("renders nothing when the server says no, even in the demo firm with the flag on", async () => {
    m.access.mockResolvedValue({ allowed: false });
    mount();
    await waitFor(() => expect(m.access).toHaveBeenCalledWith({ data: { profile_id: "p1" } }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByTestId("firm-story")).toBeNull();
  });

  it("renders nothing when the server check fails", async () => {
    m.access.mockRejectedValue(new Response("Forbidden", { status: 403 }));
    mount();
    await waitFor(() => expect(m.access).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByTestId("firm-story")).toBeNull();
  });

  it("offers Start the tour to an allowed person, and stores nothing until they press it", async () => {
    mount();
    expect((await launcher()).textContent).toBe("Start the tour");
    expect(window.sessionStorage.length).toBe(0);
    expect(m.log).not.toHaveBeenCalled();
  });
});

describe("the Partner's window", () => {
  it("starts on the title card with no product screen, the role pick and the demo line", async () => {
    mount();
    const first = await start();
    expect(first.getAttribute("data-story-beat")).toBe("0");
    expect(first.textContent).toContain(FIRM_STORY_SCRIPT.beats[0].caption);
    expect(first.textContent).toContain("Which is closest to you?");
    expect(first.querySelector("[data-story-demo-line]")?.textContent).toContain("fictional");
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    expect(m.navigate).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(STORY_STORAGE_KEY)).toBe("0");
    expect(m.log).toHaveBeenCalledWith("firm_story.started", KESTREL_BAY_ORG_ID, { mode: "self", window: "partner", script_version: FIRM_STORY_SCRIPT.version });
  });

  it("shows the You are chip, the beat count and the demo line on every beat it plays", async () => {
    mount();
    await start();
    for (const n of [1, 2, 3]) {
      next();
      expect(card().getAttribute("data-story-beat")).toBe(String(n));
      expect(card().querySelector("[data-story-you-are]")?.textContent).toBe("You are: Partner");
      expect(card().textContent).toContain(`Beat ${n} of 8`);
      expect(card().querySelector("[data-story-demo-line]")).not.toBeNull();
      expect(screen.getByRole("button", { name: "Explore on my own" })).toBeTruthy();
    }
  });

  it("goes to where the next beat happens, and offers the way there when the person has wandered", async () => {
    mount();
    await start();
    next();
    expect(m.navigate).not.toHaveBeenCalled(); // beat 1 is on Home, where the person already is
    next();
    expect(m.navigate).toHaveBeenLastCalledWith({ to: "/firm" });
    expect(screen.getByRole("button", { name: "Open the firm view" })).toBeTruthy(); // the mocked path is still /home
    fireEvent.click(screen.getByRole("button", { name: "Open the firm view" }));
    expect(m.navigate).toHaveBeenCalledTimes(2);
  });

  it("shows a handoff card when the character changes, and continues on the same window's next beat", async () => {
    mount();
    await start();
    for (let i = 0; i < 4; i += 1) next();
    expect(card().getAttribute("data-story-view")).toBe("handoff");
    expect(card().textContent).toContain("Hand over to the Engagement lead");
    expect(card().textContent).toContain("other browser window");
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    expect(window.sessionStorage.getItem(STORY_STORAGE_KEY)).toBe("4");
    fireEvent.click(screen.getByRole("button", { name: "Back in this window: continue" }));
    expect(card().getAttribute("data-story-beat")).toBe("5");
    expect(m.navigate).toHaveBeenLastCalledWith({ to: "/engagements/$id/canvas-lab", params: { id: "4a4abc70-32af-4cdb-8772-3850f9d673bc" } });
  });

  it("ends on the closing line, then stops talking", async () => {
    window.sessionStorage.setItem(STORY_STORAGE_KEY, "8");
    mount();
    await waitFor(() => expect(card().getAttribute("data-story-beat")).toBe("8"));
    expect(card().querySelector("[data-story-you-are]")?.textContent).toBe("You are: You");
    next();
    expect(card().getAttribute("data-story-view")).toBe("done");
    expect(card().textContent).toContain("What one engagement learns, the whole firm keeps.");
    expect(m.log).toHaveBeenCalledWith("firm_story.finished", KESTREL_BAY_ORG_ID, expect.objectContaining({ script_version: FIRM_STORY_SCRIPT.version }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByTestId("firm-story-card")).toBeNull();
    expect((await launcher()).textContent).toBe("Start the tour");
  });
});

describe("the Engagement lead's window", () => {
  it("starts on the handoff beat, shows no fee wording of its own, and hands back to the Partner", async () => {
    m.access.mockResolvedValue({ allowed: true, window: "lead" });
    m.path = "/engagements/4a4abc70-32af-4cdb-8772-3850f9d673bc/canvas-lab";
    mount();
    const first = await start();
    expect(first.getAttribute("data-story-beat")).toBe("4");
    expect(first.querySelector("[data-story-you-are]")?.textContent).toBe("You are: Engagement lead");
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    next();
    expect(card().textContent).toContain("Hand over to the Partner");
    fireEvent.click(screen.getByRole("button", { name: "Back in this window: continue" }));
    expect(card().getAttribute("data-story-beat")).toBe("6");
    next();
    expect(card().getAttribute("data-story-view")).toBe("handoff");
    expect(card().textContent).toContain("The rest of the tour happens in the other browser window.");
    expect(screen.queryByRole("button", { name: "Back in this window: continue" })).toBeNull();
  });
});

describe("two modes from one script", () => {
  it("self-guided shows the short caption only", async () => {
    mount();
    await start();
    next();
    expect(card().getAttribute("data-story-mode")).toBe("self");
    expect(card().querySelector("[data-story-caption]")?.textContent).toBe(FIRM_STORY_SCRIPT.beats[1].caption);
    expect(card().querySelector("[data-story-notes]")).toBeNull();
    expect(card().textContent).not.toContain(FIRM_STORY_SCRIPT.beats[1].question);
  });

  it("presenter mode adds the speaker notes and the viewer question, from the switch or the address", async () => {
    mount();
    await start();
    next();
    fireEvent.click(screen.getByRole("button", { name: "Presenter notes" }));
    expect(card().getAttribute("data-story-mode")).toBe("presenter");
    expect(card().querySelector("[data-story-notes]")?.textContent).toContain(FIRM_STORY_SCRIPT.beats[1].notes);
    expect(card().querySelector("[data-story-question]")?.textContent).toBe("How would you find that out today?");
    expect(window.sessionStorage.length).toBe(1); // the mode is not stored
    cleanup();
    window.history.replaceState(null, "", "/home?tour=presenter");
    mount();
    await waitFor(() => expect(card().getAttribute("data-story-mode")).toBe("presenter"));
  });

  it("names the product from the brand in both looks, and never from the script", async () => {
    window.sessionStorage.setItem(STORY_STORAGE_KEY, "6");
    m.access.mockResolvedValue({ allowed: true, window: "lead" });
    mount();
    await waitFor(() => expect(card().textContent).toContain("Work arrives in Charlotte from the tools"));
    expect(card().textContent).not.toContain("{product}");
    cleanup();
    m.brand = "Lasso";
    mount();
    await waitFor(() => expect(card().textContent).toContain("Work arrives in Lasso from the tools"));
    expect(card().textContent).not.toContain("Charlotte");
  });
});

describe("explore and resume", () => {
  it("collapses to a Resume tour chip and comes back to the same beat", async () => {
    mount();
    await start();
    next();
    next();
    m.log.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Explore on my own" }));
    expect(screen.queryByTestId("firm-story-card")).toBeNull();
    expect(screen.queryByTestId("firm-story-spotlight")).toBeNull();
    expect(m.log).toHaveBeenCalledWith("firm_story.explored", KESTREL_BAY_ORG_ID, { beat: 2, mode: "self", script_version: FIRM_STORY_SCRIPT.version });
    const chip = await launcher();
    expect(chip.textContent).toBe("Resume tour");
    expect(window.sessionStorage.getItem(STORY_STORAGE_KEY)).toBe("2");
    fireEvent.click(chip);
    expect(card().getAttribute("data-story-beat")).toBe("2");
    expect(m.log).toHaveBeenCalledTimes(1); // resuming is not a second start
  });

  it("comes back on the same beat after a reload", async () => {
    window.sessionStorage.setItem(STORY_STORAGE_KEY, "3");
    mount();
    await waitFor(() => expect(card().getAttribute("data-story-beat")).toBe("3"));
    expect(m.log).not.toHaveBeenCalled();
  });

  it("treats a tampered stored value as not started", async () => {
    window.sessionStorage.setItem(STORY_STORAGE_KEY, "42");
    mount();
    expect((await launcher()).textContent).toBe("Start the tour");
    expect(screen.queryByTestId("firm-story-card")).toBeNull();
  });
});

describe("what the story keeps and sends", () => {
  it("keeps only the beat number, in session storage, and nothing in local storage", async () => {
    mount();
    await start();
    fireEvent.click(card().querySelector('[data-story-role="sells"]') as HTMLElement);
    next();
    fireEvent.click(screen.getByRole("button", { name: "Presenter notes" }));
    fireEvent.click(card().querySelector('[data-story-reaction="this_is_us"]') as HTMLElement);
    next();
    expect(window.sessionStorage.length).toBe(1);
    expect(window.sessionStorage.getItem(STORY_STORAGE_KEY)).toBe("2");
    expect(window.localStorage.length).toBe(0);
  });

  it("sends a reaction once per change, with the beat, the reaction, the mode and the script version only", async () => {
    mount();
    await start();
    next();
    m.log.mockClear();
    const us = card().querySelector('[data-story-reaction="this_is_us"]') as HTMLElement;
    fireEvent.click(us);
    fireEvent.click(us);
    expect(us.getAttribute("aria-pressed")).toBe("true");
    expect(m.log).toHaveBeenCalledTimes(1);
    expect(m.log).toHaveBeenCalledWith("firm_story.reacted", KESTREL_BAY_ORG_ID, { beat: 1, reaction: "this_is_us", mode: "self", script_version: FIRM_STORY_SCRIPT.version });
    fireEvent.click(card().querySelector('[data-story-reaction="not_a_problem"]') as HTMLElement);
    expect(m.log).toHaveBeenLastCalledWith("firm_story.reacted", KESTREL_BAY_ORG_ID, { beat: 1, reaction: "not_a_problem", mode: "self", script_version: FIRM_STORY_SCRIPT.version });
  });

  it("sends the role pick once per change, as a closed word", async () => {
    mount();
    await start();
    m.log.mockClear();
    const both = card().querySelector('[data-story-role="both"]') as HTMLElement;
    fireEvent.click(both);
    fireEvent.click(both);
    expect(m.log).toHaveBeenCalledTimes(1);
    expect(m.log).toHaveBeenCalledWith("firm_story.role_picked", KESTREL_BAY_ORG_ID, { role_pick: "both", mode: "self", script_version: FIRM_STORY_SCRIPT.version });
  });

  it("never puts words from the script or the page into an event", async () => {
    mount();
    await start();
    fireEvent.click(card().querySelector('[data-story-role="delivers"]') as HTMLElement);
    for (let i = 0; i < 3; i += 1) {
      next();
      fireEvent.click(card().querySelector('[data-story-reaction="this_is_us"]') as HTMLElement);
    }
    fireEvent.click(screen.getByRole("button", { name: "Explore on my own" }));
    const allowed = new Set(["beat", "reaction", "role_pick", "mode", "window", "script_version"]);
    for (const call of m.log.mock.calls) {
      const dims = call[2] as Record<string, unknown>;
      for (const [key, value] of Object.entries(dims)) {
        expect(allowed.has(key), `${String(call[0])} carries ${key}`).toBe(true);
        expect(String(value).length, `${key} is a short closed value`).toBeLessThanOrEqual(13);
      }
    }
  });
});

describe("the spotlight", () => {
  it("outlines the real surface a beat points at when it is on the page, and takes no clicks", async () => {
    const surface = document.createElement("div");
    surface.setAttribute("data-testid", "ask-the-firm");
    surface.getBoundingClientRect = () => ({ top: 100, left: 50, width: 400, height: 200, right: 450, bottom: 300, x: 50, y: 100, toJSON: () => ({}) });
    document.body.appendChild(surface);
    try {
      mount();
      await start();
      expect(screen.queryByTestId("firm-story-spotlight")).toBeNull(); // the title card points at nothing
      next();
      const ring = await screen.findByTestId("firm-story-spotlight");
      expect(ring.getAttribute("aria-hidden")).toBe("true");
      expect(ring.className).toContain("pointer-events-none");
      expect(ring.style.top).toBe("96px");
      expect(ring.style.width).toBe("408px");
    } finally {
      surface.remove();
    }
  });

  it("draws nothing when the surface is not on the page", async () => {
    mount();
    await start();
    next();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByTestId("firm-story-spotlight")).toBeNull();
  });
});

describe("layering", () => {
  it("sits above the full-screen board page and hides the outline while a dialog is open", async () => {
    const surface = document.createElement("div");
    surface.setAttribute("data-testid", "ask-the-firm");
    surface.getBoundingClientRect = () => ({ top: 100, left: 50, width: 400, height: 200, right: 450, bottom: 300, x: 50, y: 100, toJSON: () => ({}) });
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("data-state", "open");
    document.body.append(surface);
    try {
      mount();
      await start();
      next();
      expect(screen.getByTestId("firm-story").className).toContain("z-(--layer-ledger)");
      await screen.findByTestId("firm-story-spotlight");
      document.body.append(dialog);
      await waitFor(() => expect(screen.queryByTestId("firm-story-spotlight")).toBeNull(), { timeout: 2000 });
    } finally {
      surface.remove();
      dialog.remove();
    }
  });
});

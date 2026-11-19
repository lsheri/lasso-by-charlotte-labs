// @vitest-environment jsdom
// 19 Nov, Kestrel Bay demo story: the findings of the independent review of #240, each as a test that failed before
// its fix. S1: the entry is opt-in and clear of the sidebar. S2: the story can be ended and restarted, the Engagement
// lead's last card has a way out, Close forgets the beat, and a beat never carries to another person. S3: the card
// gives way to an open dialog. N1: no flash of the start button on reload. N2: the handoff card has Back.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ access: vi.fn(), navigate: vi.fn(), log: vi.fn(), path: "/home", search: "" }));

vi.mock("@/hooks/use-feature-flag", () => ({ useFeatureFlag: () => true }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => m.navigate,
  useRouterState: ({ select }: { select: (state: { location: { pathname: string; searchStr: string } }) => unknown }) =>
    select({ location: { pathname: m.path, searchStr: m.search } }),
}));
vi.mock("@/lib/firm-story.functions", () => ({ firmStoryAccessFn: (...a: unknown[]) => m.access(...a) }));
vi.mock("@/lib/telemetry", () => ({ logEvent: (...a: unknown[]) => m.log(...a) }));
vi.mock("@/components/skin/use-skin", () => ({ useBrand: () => ({ name: "Charlotte" }) }));

import { FirmStory } from "@/components/firm-story/FirmStory";
import { KESTREL_BAY_ORG_ID } from "@/lib/firm-story-shared";

const KEY = "lasso.firm-story.beat.v1";
const keyFor = (profileId: string) => `${KEY}.${profileId}`;

function mount(profileId = "p1") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <FirmStory profile={{ id: profileId, org_id: KESTREL_BAY_ORG_ID }} />
    </QueryClientProvider>,
  );
}

function at(search: string) {
  m.search = search;
  window.history.replaceState(null, "", `/home${search}`);
}

const card = () => screen.getByTestId("firm-story-card");
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));
const next = () => fireEvent.click(screen.getByRole("button", { name: /^(Next|Finish)$/ }));

beforeEach(() => {
  m.path = "/home";
  at("");
  m.access.mockReset().mockResolvedValue({ allowed: true, window: "partner" });
  m.navigate.mockReset();
  m.log.mockReset();
  window.sessionStorage.clear();
});

afterEach(cleanup);

describe("S1: the entry is opt-in", () => {
  it("shows nothing to an allowed person who was not given the tour link and has not started", async () => {
    mount();
    await settle();
    expect(screen.queryByTestId("firm-story")).toBeNull();
    expect(screen.queryByTestId("firm-story-launcher")).toBeNull();
  });

  it("F2: does not ask the server at all without the link or a stored beat, and asks once the link is there", async () => {
    const view = mount();
    await settle();
    expect(m.access).not.toHaveBeenCalled();
    at("?tour=1");
    view.rerender(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <FirmStory profile={{ id: "p1", org_id: KESTREL_BAY_ORG_ID }} />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(m.access).toHaveBeenCalledTimes(1));
    expect(await screen.findByTestId("firm-story-launcher")).toBeTruthy();
  });

  it("F5: does not watch the page for dialogs for a person who has not opted in", async () => {
    const observe = vi.spyOn(MutationObserver.prototype, "observe");
    try {
      mount();
      await settle();
      expect(observe).not.toHaveBeenCalled();
      cleanup();
      at("?tour=1");
      mount();
      await screen.findByTestId("firm-story-launcher");
      expect(observe).toHaveBeenCalled();
    } finally {
      observe.mockRestore();
    }
  });

  it("shows Start the tour when the address carries ?tour, whatever its value", async () => {
    for (const search of ["?tour", "?tour=1", "?tour=presenter", "?brand=charlotte&tour=x"]) {
      at(search);
      mount();
      expect((await screen.findByTestId("firm-story-launcher")).textContent, search).toBe("Start the tour");
      cleanup();
    }
  });

  it("does not treat other words in the address as the tour link", async () => {
    at("?detour=1&tourist=yes");
    mount();
    await settle();
    expect(m.access).not.toHaveBeenCalled();
    expect(screen.queryByTestId("firm-story")).toBeNull();
  });

  it("shows the card without the link when this person already started in this tab", async () => {
    window.sessionStorage.setItem(keyFor("p1"), "2");
    mount();
    await waitFor(() => expect(card().getAttribute("data-story-beat")).toBe("2"));
  });

  it("keeps the start button after the link has gone from the address, until the page is reloaded", async () => {
    at("?tour=1");
    const view = mount();
    await screen.findByTestId("firm-story-launcher");
    at("");
    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <FirmStory profile={{ id: "p1", org_id: KESTREL_BAY_ORG_ID }} />
      </QueryClientProvider>,
    );
    expect(await screen.findByTestId("firm-story-launcher")).toBeTruthy();
  });

  it("sits past the sidebar on wide screens, so it never covers the sidebar's footer link", async () => {
    at("?tour=1");
    mount();
    await screen.findByTestId("firm-story-launcher");
    const frame = screen.getByTestId("firm-story").className;
    expect(frame).toContain("md:justify-start");
    // F7: from the sidebar's own width token, so the button follows the sidebar if its width changes.
    expect(frame).toContain("md:pl-[calc(var(--nav-width)+0.875rem)]");
    expect(frame).not.toMatch(/(^| )md:pl-4( |$)/);
    expect(readFileSync("src/design/tokens.css", "utf8")).toMatch(/--nav-width:\s*\d+px/);
  });

  it("sits past the narrow rail on the board page, which has no sidebar", async () => {
    at("?tour=1");
    m.path = "/engagements/4a4abc70-32af-4cdb-8772-3850f9d673bc/canvas-lab";
    mount();
    await screen.findByTestId("firm-story-launcher");
    expect(screen.getByTestId("firm-story").className).toContain("md:pl-[calc(52px+1rem)]");
    // The rail has no width token; this is where its width lives. If it changes, change PAST_BOARD_RAIL with it.
    expect(readFileSync("src/components/canvas-lab/WorkboardChrome.tsx", "utf8")).toContain("workboard-side-rail z-30 flex w-[52px]");
  });
});

describe("S2: ending, restarting and changing person", () => {
  it("End tour on a beat forgets the beat and returns to Start the tour", async () => {
    at("?tour=1");
    mount();
    fireEvent.click(await screen.findByTestId("firm-story-launcher"));
    next();
    expect(window.sessionStorage.getItem(keyFor("p1"))).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: "End tour" }));
    expect(screen.queryByTestId("firm-story-card")).toBeNull();
    expect(window.sessionStorage.length).toBe(0);
    expect((await screen.findByTestId("firm-story-launcher")).textContent).toBe("Start the tour");
  });

  it("a second run starts again on the first beat with a clean card", async () => {
    at("?tour=1");
    mount();
    fireEvent.click(await screen.findByTestId("firm-story-launcher"));
    fireEvent.click(card().querySelector('[data-story-role="sells"]') as HTMLElement);
    next();
    fireEvent.click(card().querySelector('[data-story-reaction="this_is_us"]') as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: "End tour" }));
    fireEvent.click(await screen.findByTestId("firm-story-launcher"));
    expect(card().getAttribute("data-story-beat")).toBe("0");
    expect(card().querySelector('[data-story-role="sells"]')?.getAttribute("aria-pressed")).toBe("false");
    next();
    expect(card().querySelector('[data-story-reaction="this_is_us"]')?.getAttribute("aria-pressed")).toBe("false");
    expect(m.log.mock.calls.filter((call) => call[0] === "firm_story.started")).toHaveLength(2);
  });

  it("Close on the closing card forgets the beat, so a reload does not bring the closing card back", async () => {
    window.sessionStorage.setItem(keyFor("p1"), "8");
    mount();
    await waitFor(() => expect(card().getAttribute("data-story-beat")).toBe("8"));
    next();
    expect(card().getAttribute("data-story-view")).toBe("done");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(window.sessionStorage.length).toBe(0);
    cleanup();
    mount();
    await settle();
    expect(screen.queryByTestId("firm-story-card")).toBeNull();
    expect(screen.queryByTestId("firm-story")).toBeNull();
  });

  it("the Engagement lead's last card has a way out, and the lead can then start again at its first beat", async () => {
    m.access.mockResolvedValue({ allowed: true, window: "lead" });
    window.sessionStorage.setItem(keyFor("p1"), "7");
    mount();
    await waitFor(() => expect(card().getAttribute("data-story-view")).toBe("handoff"));
    expect(card().textContent).toContain("The rest of the tour happens in the other browser window.");
    fireEvent.click(screen.getByRole("button", { name: "End tour" }));
    expect(window.sessionStorage.length).toBe(0);
    fireEvent.click(await screen.findByTestId("firm-story-launcher"));
    expect(card().getAttribute("data-story-beat")).toBe("4");
  });

  it("End tour sits beside Resume tour while exploring", async () => {
    window.sessionStorage.setItem(keyFor("p1"), "2");
    mount();
    await waitFor(() => card());
    fireEvent.click(screen.getByRole("button", { name: "Explore on my own" }));
    expect((await screen.findByTestId("firm-story-launcher")).textContent).toBe("Resume tour");
    fireEvent.click(screen.getByRole("button", { name: "End tour" }));
    expect(window.sessionStorage.length).toBe(0);
    expect((await screen.findByTestId("firm-story-launcher")).textContent).toBe("Start the tour");
  });

  it("a beat stored by one person is not inherited by the next person in the same tab, and is removed", async () => {
    window.sessionStorage.setItem(keyFor("partner-profile"), "5");
    window.sessionStorage.setItem(KEY, "5"); // the key the first build of #240 used
    window.sessionStorage.setItem("something.else", "kept");
    m.access.mockResolvedValue({ allowed: true, window: "lead" });
    mount("lead-profile");
    await settle();
    expect(m.access).not.toHaveBeenCalled();
    expect(screen.queryByTestId("firm-story-card")).toBeNull();
    expect(screen.queryByTestId("firm-story")).toBeNull();
    expect(window.sessionStorage.getItem(keyFor("partner-profile"))).toBeNull();
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
    expect(window.sessionStorage.getItem("something.else")).toBe("kept");
  });

  it("still stores nothing but the beat number as the value", async () => {
    at("?tour=1");
    mount();
    fireEvent.click(await screen.findByTestId("firm-story-launcher"));
    next();
    next();
    expect(window.sessionStorage.length).toBe(1);
    expect(window.sessionStorage.getItem(keyFor("p1"))).toBe("2");
  });
});

describe("S3: an open dialog", () => {
  function openDialog(role = "dialog") {
    const dialog = document.createElement("div");
    dialog.setAttribute("role", role);
    dialog.setAttribute("data-state", "open");
    document.body.append(dialog);
    return dialog;
  }

  it("collapses the card while a dialog is open and brings it back on the same beat when it closes", async () => {
    window.sessionStorage.setItem(keyFor("p1"), "1");
    mount();
    await waitFor(() => card());
    expect(screen.getByTestId("firm-story").className).toContain("z-(--layer-ledger)");
    const dialog = openDialog();
    try {
      await waitFor(() => expect(screen.queryByTestId("firm-story-card")).toBeNull());
      expect(screen.getByTestId("firm-story-launcher").textContent).toBe("Resume tour");
      // Below the dialogs' layer, so every dialog and its scrim sit over it wherever they are in the page.
      const frame = screen.getByTestId("firm-story").className;
      expect(frame).toContain("z-(--layer-tabbar)");
      expect(frame).not.toContain("z-(--layer-backdrop)");
      expect(frame).not.toContain("z-(--layer-ledger)");
      expect(m.log).not.toHaveBeenCalled(); // giving way to a dialog is not "explored"
    } finally {
      await act(async () => {
        dialog.remove();
        await settle();
      });
    }
    await waitFor(() => expect(card().getAttribute("data-story-beat")).toBe("1"));
    expect(window.sessionStorage.getItem(keyFor("p1"))).toBe("1");
  });

  it("gives way to a confirm dialog too", async () => {
    window.sessionStorage.setItem(keyFor("p1"), "1");
    mount();
    await waitFor(() => card());
    const dialog = openDialog("alertdialog");
    try {
      await waitFor(() => expect(screen.queryByTestId("firm-story-card")).toBeNull());
    } finally {
      dialog.remove();
    }
  });

  it("ignores a dialog that is in the page but closed", async () => {
    window.sessionStorage.setItem(keyFor("p1"), "1");
    const closed = document.createElement("div");
    closed.setAttribute("role", "dialog");
    closed.setAttribute("data-state", "closed");
    document.body.append(closed);
    try {
      mount();
      await waitFor(() => card());
      await settle();
      expect(screen.getByTestId("firm-story-card")).toBeTruthy();
    } finally {
      closed.remove();
    }
  });
});

describe("F3: dialogs built by hand, which carry no data-state", () => {
  function handBuilt(display?: string) {
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    if (display) dialog.style.display = display;
    document.body.append(dialog);
    return dialog;
  }

  it("gives way while one is in the page, and comes back when it is removed", async () => {
    window.sessionStorage.setItem(keyFor("p1"), "1");
    mount();
    await waitFor(() => card());
    const dialog = handBuilt();
    try {
      await waitFor(() => expect(screen.queryByTestId("firm-story-card")).toBeNull());
    } finally {
      await act(async () => {
        dialog.remove();
        await settle();
      });
    }
    await waitFor(() => expect(card().getAttribute("data-story-beat")).toBe("1"));
  });

  it("follows Settings, which stays in the page hidden: shown, then hidden again", async () => {
    window.sessionStorage.setItem(keyFor("p1"), "1");
    const settings = handBuilt("none");
    try {
      mount();
      await waitFor(() => card());
      await settle();
      expect(screen.getByTestId("firm-story-card")).toBeTruthy();
      await act(async () => {
        settings.style.display = "";
        await settle();
      });
      await waitFor(() => expect(screen.queryByTestId("firm-story-card")).toBeNull());
      await act(async () => {
        settings.style.display = "none";
        await settle();
      });
      await waitFor(() => expect(card().getAttribute("data-story-beat")).toBe("1"));
    } finally {
      settings.remove();
    }
  });

  it("counts a hand-built dialog inside a hidden parent as closed", async () => {
    window.sessionStorage.setItem(keyFor("p1"), "1");
    const parent = document.createElement("div");
    parent.hidden = true;
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    parent.append(dialog);
    document.body.append(parent);
    try {
      mount();
      await waitFor(() => card());
      await settle();
      expect(screen.getByTestId("firm-story-card")).toBeTruthy();
    } finally {
      parent.remove();
    }
  });
});

describe("F4: a beat left in the tab by someone else", () => {
  it("is removed when the next person is in another workspace, with no request and nothing shown", async () => {
    window.sessionStorage.setItem(keyFor("harper"), "6");
    window.sessionStorage.setItem("lasso.active_profile_id", "kept");
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <FirmStory profile={{ id: "outsider", org_id: "another-org" }} />
      </QueryClientProvider>,
    );
    await settle();
    expect(window.sessionStorage.getItem(keyFor("harper"))).toBeNull();
    expect(window.sessionStorage.getItem("lasso.active_profile_id")).toBe("kept");
    expect(m.access).not.toHaveBeenCalled();
    expect(screen.queryByTestId("firm-story")).toBeNull();
  });

  it("reads storage once per first render, and reading removes nothing", async () => {
    window.sessionStorage.setItem(keyFor("p1"), "2");
    const remove = vi.spyOn(Storage.prototype, "removeItem");
    try {
      mount();
      await waitFor(() => card());
      expect(remove).not.toHaveBeenCalled();
    } finally {
      remove.mockRestore();
    }
  });
});

describe("F6: the keyboard after the card goes", () => {
  it("moves focus to Start the tour after End tour", async () => {
    window.sessionStorage.setItem(keyFor("p1"), "2");
    mount();
    await waitFor(() => card());
    const end = screen.getByRole("button", { name: "End tour" });
    end.focus();
    fireEvent.click(end);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId("firm-story-launcher")));
  });

  it("moves focus to Resume tour after Explore on my own", async () => {
    window.sessionStorage.setItem(keyFor("p1"), "2");
    mount();
    await waitFor(() => card());
    fireEvent.click(screen.getByRole("button", { name: "Explore on my own" }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId("firm-story-launcher")));
    expect(screen.getByTestId("firm-story-launcher").textContent).toBe("Resume tour");
  });

  it("does not take focus from a dialog when the card only gives way to it", async () => {
    window.sessionStorage.setItem(keyFor("p1"), "2");
    mount();
    await waitFor(() => card());
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("data-state", "open");
    const inside = document.createElement("button");
    dialog.append(inside);
    document.body.append(dialog);
    inside.focus();
    try {
      await waitFor(() => expect(screen.queryByTestId("firm-story-card")).toBeNull());
      await settle();
      expect(document.activeElement).toBe(inside);
    } finally {
      dialog.remove();
    }
  });
});

describe("N1: no flash of the start button on reload", () => {
  it("never renders Start the tour when a beat is stored", async () => {
    at("?tour=1");
    window.sessionStorage.setItem(keyFor("p1"), "3");
    const seen: string[] = [];
    const observer = new MutationObserver(() => {
      const launcher = document.querySelector('[data-testid="firm-story-launcher"]');
      if (launcher) seen.push(launcher.textContent ?? "");
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    mount();
    await waitFor(() => expect(card().getAttribute("data-story-beat")).toBe("3"));
    await settle();
    observer.disconnect();
    expect(seen).toEqual([]);
    expect(m.log).not.toHaveBeenCalled();
  });
});

describe("N2: Back on the handoff card", () => {
  it("returns to the beat before the handoff", async () => {
    window.sessionStorage.setItem(keyFor("p1"), "3");
    mount();
    await waitFor(() => card());
    next();
    expect(card().getAttribute("data-story-view")).toBe("handoff");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(card().getAttribute("data-story-view")).toBe("beat");
    expect(card().getAttribute("data-story-beat")).toBe("3");
  });
});

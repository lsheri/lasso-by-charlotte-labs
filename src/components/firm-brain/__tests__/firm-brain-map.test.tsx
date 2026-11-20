// @vitest-environment jsdom
// 18 Nov: Firm Brain Build Spec, steps 3 and 4. The firm map on the firm view: hidden for a
// guest; without WebGL (or before the 3D map loads) the reading panel and a plain list, with no error; reduced motion
// moves nothing; an Ask the firm answer pulls exactly the engagements it quoted; no person and no unshared board shows.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEMO_BOARDS } from "@/lib/demo-firm";
import type { FirmAskResult } from "@/lib/firm-ask-shared";
import { forMap } from "@/lib/firm-map-shared";
import {
  corpusOf,
  demoRows,
  graphOf,
  itemId,
  mentions,
  PERSON_WORDS,
  UNSHARED,
} from "@/lib/__tests__/helpers/demo-firm-rows";

const m = vi.hoisted(() => ({
  webgl: false,
  reduce: false,
  getMap: vi.fn(),
  ask: vi.fn(),
  walk: vi.fn(),
  threeMounted: vi.fn(),
}));

vi.mock("@/lib/firm-walkthrough.functions", () => ({
  getFirmWalkthrough: (...a: unknown[]) => m.walk(...a),
}));

vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/webgl-capability", () => ({ hasWebGL: () => m.webgl }));
vi.mock("@/lib/firm-map.functions", () => ({ getFirmMap: (...a: unknown[]) => m.getMap(...a) }));
vi.mock("@/lib/firm-ask.functions", () => ({
  askTheFirm: (...a: unknown[]) => m.ask(...a),
  previewFirmSource: vi.fn(),
  keepOutOfFirmAnswers: vi.fn(),
}));
// jsdom has no WebGL, so the 3D renderer is stood in for: it records that it mounted and offers nothing else.
vi.mock("@/components/firm-brain/FirmMap3D", async () => {
  const { useEffect } = await import("react");
  return {
    default: function Fake3D(props: { layout: { threads: unknown[] }; onFail?: () => void }) {
      useEffect(() => {
        m.threeMounted(props);
      }, []); // eslint-disable-line react-hooks/exhaustive-deps
      return <div data-testid="firm-map-3d" />;
    },
  };
});

import { FirmBrainMap } from "@/components/firm-brain/FirmBrainMap";

const member = {
  id: "p1",
  role: "admin",
  has_firm_view: true,
  org_type: "company",
  is_guest: false,
};
const graph = forMap(graphOf(demoRows()));
const shared = DEMO_BOARDS.filter((board) => board.sharedWithFirm);

function wrap(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

function answer(
  claims: { itemId: string; boardId: string }[],
  status: FirmAskResult["status"] = "answered",
): FirmAskResult {
  const corpus = corpusOf(demoRows());
  const sources: FirmAskResult["sources"] = {};
  for (const claim of claims) {
    const item = corpus.items.find((entry) => entry.id === claim.itemId)!;
    sources[claim.itemId] = {
      title: item.title,
      type: item.type,
      date: item.date,
      boardId: item.boardId,
      boardTitle: "Board",
      shownOn: null,
    };
  }
  return {
    status,
    summary: status === "answered" ? "The firm has done this." : null,
    claims: claims.map((claim) => ({
      ...claim,
      text: "A claim.",
      quote: "a quote",
      grade: "quoted" as const,
    })),
    facts: [],
    nearest: null,
    read: { full: claims.map((claim) => claim.itemId), summary: [] },
    sources,
    coverage: "Read 26 engagements shared with the firm. Some engagements are not shared.",
    oneSource: false,
  };
}

async function ask(result: FirmAskResult) {
  m.ask.mockResolvedValueOnce(result);
  fireEvent.change(screen.getByLabelText("Question for the firm"), {
    target: { value: "Have we designed a service line?" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));
  await waitFor(() => expect(document.querySelector("[data-firm-answer]")).not.toBeNull());
}

const pulled = (selector: string) =>
  [...document.querySelectorAll(`${selector}[data-lit="true"]`)]
    .map((element) => element.getAttribute(selector.slice(1, -1)) ?? "")
    .sort();

let animate: ReturnType<typeof vi.fn>;
let errors: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  m.webgl = false;
  m.reduce = false;
  m.getMap.mockReset().mockResolvedValue(graph);
  m.ask.mockReset();
  m.threeMounted.mockReset();
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("reduce") ? m.reduce : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
  animate = vi.fn(() => ({ cancel: vi.fn() }));
  (Element.prototype as unknown as { animate: unknown }).animate = animate;
  errors = vi.spyOn(console, "error");
});
afterEach(() => {
  cleanup();
  errors.mockRestore();
  delete (Element.prototype as unknown as { animate?: unknown }).animate;
});

describe("who sees the map", () => {
  it("shows to a firm member, with Ask the firm beside it", async () => {
    wrap(<FirmBrainMap profile={member} />);
    expect(screen.getByTestId("firm-brain-map")).toBeTruthy();
    expect(screen.getByTestId("firm-view-ask")).toBeTruthy();
    await waitFor(() => expect(m.getMap).toHaveBeenCalledWith({ data: { profile_id: "p1" } }));
  });

  it("is absent for a guest and a coach, and never asks the server", () => {
    const { rerender } = wrap(<FirmBrainMap profile={{ ...member, is_guest: true }} />);
    expect(screen.queryByTestId("firm-brain-map")).toBeNull();
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <FirmBrainMap profile={{ ...member, role: "coach" }} />
      </QueryClientProvider>,
    );
    expect(screen.queryByTestId("firm-brain-map")).toBeNull();
    expect(m.getMap).not.toHaveBeenCalled();
  });

  it("goes away when the server refuses, leaving Ask the firm to its own rules", async () => {
    m.getMap.mockRejectedValue(new Response("Forbidden", { status: 403 }));
    wrap(<FirmBrainMap profile={member} />);
    await waitFor(() => expect(screen.queryByTestId("firm-brain-map")).toBeNull());
    expect(screen.getByTestId("firm-view-ask")).toBeTruthy();
  });
});

describe("without WebGL, or before the 3D map loads", () => {
  it("shows the reading panel and a plain list, with no error and no 3D map", async () => {
    m.webgl = false;
    wrap(<FirmBrainMap profile={member} />);
    await waitFor(() => expect(screen.getByTestId("firm-map-list")).toBeTruthy());
    expect(screen.getByTestId("firm-map-reading")).toBeTruthy();
    expect(screen.getByTestId("firm-brain-map").getAttribute("data-renderer")).toBe("list");
    expect(screen.queryByTestId("firm-map-3d")).toBeNull();
    expect(screen.queryByTestId("firm-map-flat")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(m.threeMounted).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
    // Every shared engagement is in the list, once.
    expect(document.querySelectorAll("[data-list-thread]")).toHaveLength(shared.length);
  });

  it("opens an engagement from the list in the reading panel and pulls its thread", async () => {
    wrap(<FirmBrainMap profile={member} />);
    await waitFor(() => expect(screen.getByTestId("firm-map-list")).toBeTruthy());
    fireEvent.click(document.querySelector('[data-list-thread="b5"]')!);
    expect(screen.getByTestId("firm-map-reading").getAttribute("data-reading")).toBe("thread");
    expect(pulled("[data-list-thread]")).toEqual(["b5"]);
  });

  // Step 6: the walk-through is reachable from the plain list, with no map drawn at all.
  it("opens a situation or a method from the list and offers its walk-through, which sends only the tag", async () => {
    m.walk.mockReset().mockReturnValue(new Promise(() => {}));
    wrap(<FirmBrainMap profile={member} />);
    await waitFor(() => expect(screen.getByTestId("firm-map-list")).toBeTruthy());
    // Every situation and method on the map is a button in the list.
    expect(document.querySelectorAll('[data-list-node^="situation:"]')).toHaveLength(
      graph.situations.length,
    );
    expect(document.querySelectorAll('[data-list-node^="method:"]')).toHaveLength(
      graph.methods.length,
    );
    expect(screen.queryByTestId("firm-walkthrough")).toBeNull();

    fireEvent.click(document.querySelector('[data-list-node="situation:integration"]')!);
    expect(screen.getByTestId("firm-map-reading").getAttribute("data-reading")).toBe("node");
    fireEvent.click(screen.getByTestId("firm-walkthrough-open"));
    expect(m.walk).toHaveBeenLastCalledWith({
      data: { kind: "situation", tag: "integration", profile_id: "p1" },
    });

    fireEvent.click(document.querySelector('[data-list-node="method:workshop"]')!);
    fireEvent.click(screen.getByTestId("firm-walkthrough-open"));
    expect(m.walk).toHaveBeenLastCalledWith({
      data: { kind: "method", tag: "workshop", profile_id: "p1" },
    });
    expect(m.walk).toHaveBeenCalledTimes(2);
  });

  it("offers no walk-through on an engagement picked from the list", async () => {
    wrap(<FirmBrainMap profile={member} />);
    await waitFor(() => expect(screen.getByTestId("firm-map-list")).toBeTruthy());
    fireEvent.click(document.querySelector('[data-list-thread="b5"]')!);
    expect(screen.queryByTestId("firm-walkthrough")).toBeNull();
  });

  it("loads the 3D map by dynamic import when WebGL is there", async () => {
    m.webgl = true;
    wrap(<FirmBrainMap profile={member} />);
    await waitFor(() => expect(screen.getByTestId("firm-map-3d")).toBeTruthy());
    expect(screen.getByTestId("firm-brain-map").getAttribute("data-renderer")).toBe("three");
    expect(m.threeMounted).toHaveBeenCalled();
    // The list stays one click away for keyboards and screen readers.
    expect(screen.getByTestId("firm-map-list")).toBeTruthy();
  });

  it("shows a plain line, not an error, when the map cannot be read", async () => {
    m.getMap.mockRejectedValue(new Error("network"));
    wrap(<FirmBrainMap profile={member} />);
    await waitFor(() =>
      expect(
        screen.getByText("The map could not be loaded. Ask the firm still works."),
      ).toBeTruthy(),
    );
    expect(screen.getByTestId("firm-view-ask")).toBeTruthy();
  });

  it("says so plainly when nothing is shared yet", async () => {
    m.getMap.mockResolvedValue({ situations: [], methods: [], threads: [] });
    wrap(<FirmBrainMap profile={member} />);
    await waitFor(() =>
      expect(screen.getByText(/Nothing is shared with the firm yet/)).toBeTruthy(),
    );
  });
});

describe("the flat map", () => {
  // The 3D renderer fails to start, so the flat SVG map stands in: the same layout, every point a button.
  async function flat() {
    m.webgl = true;
    m.threeMounted.mockImplementation((props: { onFail?: () => void }) => props.onFail?.());
    wrap(<FirmBrainMap profile={member} />);
    await waitFor(() => expect(screen.getByTestId("firm-map-flat")).toBeTruthy());
  }

  it("pulls a point's threads on hover and keeps them on tap", async () => {
    await flat();
    const node = document.querySelector('[data-node="method:stakeholder_interviews"]')!;
    const expected = graph.methods.find(
      (entry) => entry.id === "stakeholder_interviews",
    )!.threadIds;
    fireEvent.pointerEnter(node, { pointerType: "mouse" });
    expect(pulled("[data-thread]")).toEqual([...expected].sort());
    expect(screen.getByTestId("firm-map-reading").getAttribute("data-reading")).toBe("node");
    // Step 6: a point only under the mouse offers no walk-through; the button would vanish on the way to it.
    expect(screen.queryByTestId("firm-walkthrough")).toBeNull();
    fireEvent.pointerLeave(node, { pointerType: "mouse" });
    expect(pulled("[data-thread]")).toEqual([]);
    fireEvent.click(node);
    expect(pulled("[data-thread]")).toEqual([...expected].sort());
    expect(node.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("firm-walkthrough-open")).toBeTruthy();
  });

  it("sews the threads in date order on Replay", async () => {
    await flat();
    fireEvent.click(screen.getByTestId("firm-map-replay"));
    await waitFor(() => expect(animate).toHaveBeenCalled());
    const delays = animate.mock.calls.map((call) => (call[1] as { delay: number }).delay);
    expect(delays.length).toBeGreaterThan(10);
  });

  it("moves nothing under reduced motion: no Replay, no animation, no transition", async () => {
    m.reduce = true;
    await flat();
    expect(screen.queryByTestId("firm-map-replay")).toBeNull();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(animate).not.toHaveBeenCalled();
    for (const element of document.querySelectorAll("[data-thread], [data-node]")) {
      expect(element.getAttribute("class")).toContain("motion-reduce:transition-none");
    }
  });
});

describe("the answer trace", () => {
  it("pulls exactly the engagements the answer quoted, and fades every other thread", async () => {
    wrap(<FirmBrainMap profile={member} />);
    await waitFor(() => expect(screen.getByTestId("firm-map-list")).toBeTruthy());
    await ask(
      answer([
        { itemId: itemId("b5", "final"), boardId: "b5" },
        { itemId: itemId("b7", "int-cfo"), boardId: "b7" },
        { itemId: itemId("b5", "proposal"), boardId: "b5" },
      ]),
    );
    await waitFor(() => expect(pulled("[data-list-thread]")).toEqual(["b5", "b7"]));
    expect(screen.getByTestId("firm-map-reading").getAttribute("data-reading")).toBe("trace");
    const faded = [...document.querySelectorAll("[data-list-thread]")].filter((element) =>
      element.className.includes("opacity-50"),
    );
    expect(faded).toHaveLength(shared.length - 2);
  });

  it("pulls nothing for a not found answer or a refused people question", async () => {
    wrap(<FirmBrainMap profile={member} />);
    await waitFor(() => expect(screen.getByTestId("firm-map-list")).toBeTruthy());
    await ask(answer([{ itemId: itemId("b5", "final"), boardId: "b5" }]));
    await waitFor(() => expect(pulled("[data-list-thread]")).toEqual(["b5"]));

    await ask(answer([{ itemId: itemId("b5", "final"), boardId: "b5" }], "not_found"));
    await waitFor(() => expect(pulled("[data-list-thread]")).toEqual([]));
    expect(screen.getByTestId("firm-map-reading").getAttribute("data-reading")).toBe("overview");

    await ask(answer([{ itemId: itemId("b7", "int-cfo"), boardId: "b7" }], "about_people"));
    await waitFor(() =>
      expect(document.querySelector('[data-firm-answer="about_people"]')).not.toBeNull(),
    );
    expect(pulled("[data-list-thread]")).toEqual([]);
  });
});

describe("privacy on screen", () => {
  function everythingShown(): string[] {
    const shownText = document.body.textContent ?? "";
    const labels = [...document.querySelectorAll("[aria-label], [title]")].flatMap((element) => [
      element.getAttribute("aria-label") ?? "",
      element.getAttribute("title") ?? "",
    ]);
    return [shownText, ...labels];
  }

  it("names no person in any point, label, tooltip or panel row, in the list or the flat map", async () => {
    m.webgl = true;
    m.threeMounted.mockImplementation((props: { onFail?: () => void }) => props.onFail?.());
    wrap(<FirmBrainMap profile={member} />);
    await waitFor(() => expect(screen.getByTestId("firm-map-flat")).toBeTruthy());
    const seen = [...everythingShown()];
    // Every point's panel, and every deck label (they show when a few threads are pulled).
    for (const node of document.querySelectorAll("[data-node]")) {
      fireEvent.click(node);
      seen.push(...everythingShown());
      fireEvent.click(node);
    }
    const text = seen.join("\n");
    for (const name of PERSON_WORDS) expect(mentions(text, name), name).toBe(false);
  });

  it("never draws or counts b13, b20, b23 or b28", async () => {
    m.webgl = true;
    m.threeMounted.mockImplementation((props: { onFail?: () => void }) => props.onFail?.());
    wrap(<FirmBrainMap profile={member} />);
    await waitFor(() => expect(screen.getByTestId("firm-map-totals")).toBeTruthy());
    expect(screen.getByTestId("firm-map-totals").textContent).toContain(
      `${shared.length} engagements`,
    );
    expect(document.querySelector('[data-total="engagements"] dd')!.textContent).toBe(
      String(shared.length),
    );
    const text = everythingShown().join("\n");
    for (const key of UNSHARED) {
      const board = DEMO_BOARDS.find((entry) => entry.key === key)!;
      expect(text).not.toContain(board.title);
      expect(
        document.querySelector(
          `[data-thread="${key}"], [data-list-thread="${key}"], [data-node$=":${key}"]`,
        ),
      ).toBeNull();
    }
  });
});

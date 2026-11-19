// @vitest-environment jsdom
// 18 Nov: Firm Brain Build Spec, step 6. "How we do this" in the firm map's reading panel: a button that loads a
// walk-through in place. Habits with their quotes and sources, then examples that name their engagement and date and
// open the source as Ask the firm's citations do. Loading, a failed load (plain line, panel stays), thin data, no
// habits, a refusal, a double press and a reply that arrives after the person moved on.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MapReading } from "@/lib/firm-map-shared";
import {
  FIRM_WALK_COPY,
  type FirmWalkthroughResult,
  type WalkTag,
} from "@/lib/firm-walkthrough-shared";

const m = vi.hoisted(() => ({ walk: vi.fn(), preview: vi.fn(), keepOut: vi.fn() }));

vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/firm-walkthrough.functions", () => ({
  getFirmWalkthrough: (...a: unknown[]) => m.walk(...a),
}));
vi.mock("@/lib/firm-ask.functions", () => ({
  askTheFirm: vi.fn(),
  previewFirmSource: (...a: unknown[]) => m.preview(...a),
  keepOutOfFirmAnswers: (...a: unknown[]) => m.keepOut(...a),
}));

import { FirmMapReading } from "@/components/firm-brain/FirmMapReading";
import { FirmWalkthrough } from "@/components/firm-brain/FirmWalkthrough";

const WORKSHOP: WalkTag = { kind: "method", tag: "workshop" };

const habits: FirmWalkthroughResult = {
  status: "habits",
  kind: "method",
  tag: "workshop",
  label: "Co-design workshop",
  engagements: 4,
  habits: [
    {
      text: "Send the pre-read two days ahead.",
      quotes: [
        {
          itemId: "i1",
          boardId: "b3",
          quote: "The pre-read went out two days before the session",
          grade: "quoted",
        },
      ],
    },
    {
      text: "End on decisions, not themes.",
      quotes: [
        {
          itemId: "i2",
          boardId: "b10",
          quote: "Closed with five decisions and an owner for each",
          grade: "from_summary",
        },
      ],
    },
    {
      text: "Keep the room under twelve people.",
      quotes: [
        {
          itemId: "i1",
          boardId: "b3",
          quote: "Eleven people in the room, by design",
          grade: "quoted",
        },
      ],
    },
  ],
  examples: [
    {
      itemId: "i1",
      title: "Co-design workshop notes",
      type: "document",
      date: "2025-04-02",
      boardId: "b3",
      engagement: "Harborview College",
      boardTitle: "Advising redesign",
    },
    {
      itemId: "i2",
      title: "Call notes",
      type: "call",
      date: "2024-11-19",
      boardId: "b10",
      engagement: "Thistledown",
      boardTitle: "Thistledown",
    },
  ],
  sources: {
    i1: {
      title: "Co-design workshop notes",
      type: "document",
      date: "2025-04-02",
      boardId: "b3",
      boardTitle: "Advising redesign",
      shownOn: null,
    },
    i2: {
      title: "Call notes",
      type: "call",
      date: "2024-11-19",
      boardId: "b10",
      boardTitle: "Thistledown",
      shownOn: null,
    },
  },
  coverage: "Read 26 engagements shared with the firm. Some engagements are not shared.",
};
const thin: FirmWalkthroughResult = {
  ...habits,
  status: "thin",
  engagements: 2,
  habits: [],
  sources: {},
};
const none: FirmWalkthroughResult = { ...habits, status: "none", habits: [], sources: {} };

function wrap(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

const open = () => fireEvent.click(screen.getByTestId("firm-walkthrough-open"));
const state = () => screen.getByTestId("firm-walkthrough").getAttribute("data-walk");

beforeEach(() => {
  m.walk.mockReset();
  m.preview.mockReset();
  m.keepOut.mockReset();
});
afterEach(cleanup);

describe("How we do this", () => {
  it("asks for nothing until the button is pressed, then sends only the tag", async () => {
    m.walk.mockResolvedValue(habits);
    wrap(<FirmWalkthrough tag={WORKSHOP} profileId="p1" />);
    expect(screen.getByRole("button", { name: FIRM_WALK_COPY.open })).toBeTruthy();
    expect(m.walk).not.toHaveBeenCalled();
    open();
    await waitFor(() => expect(state()).toBe("habits"));
    expect(m.walk).toHaveBeenCalledTimes(1);
    expect(m.walk).toHaveBeenCalledWith({
      data: { kind: "method", tag: "workshop", profile_id: "p1" },
    });
  });

  it("shows each habit with its quote and its source, and marks a quote that came from a summary", async () => {
    m.walk.mockResolvedValue(habits);
    wrap(<FirmWalkthrough tag={WORKSHOP} profileId="p1" />);
    open();
    await waitFor(() => expect(document.querySelectorAll("[data-walk-habit]")).toHaveLength(3));
    const first = document.querySelectorAll("[data-walk-habit]")[0]!;
    expect(first.textContent).toContain("Send the pre-read two days ahead.");
    expect(first.querySelector('[data-walk-quote="quoted"]')!.textContent).toBe(
      "The pre-read went out two days before the session",
    );
    expect(first.querySelector("[data-firm-source]")!.textContent).toContain("Advising redesign");
    const second = document.querySelectorAll("[data-walk-habit]")[1]!;
    expect(second.querySelector('[data-walk-quote="from_summary"]')!.textContent).toContain(
      FIRM_WALK_COPY.fromSummary,
    );
    expect(screen.getByText(/Nothing is saved\./)).toBeTruthy();
  });

  it("lists the examples under the habits, each with its engagement and date", async () => {
    m.walk.mockResolvedValue(habits);
    wrap(<FirmWalkthrough tag={WORKSHOP} profileId="p1" />);
    open();
    await waitFor(() => expect(document.querySelectorAll("[data-walk-example]")).toHaveLength(2));
    expect(screen.getByText(FIRM_WALK_COPY.examplesTitle)).toBeTruthy();
    const [first, second] = [...document.querySelectorAll("[data-walk-example]")];
    expect(first!.textContent).toContain("Co-design workshop notes");
    expect(first!.textContent).toContain("Harborview College · Advising redesign");
    expect(first!.querySelector("[data-walk-example-date]")!.textContent).toBe("2 Apr 2025");
    // A board with no client is named once, by its title.
    expect(second!.textContent).toContain("Thistledown");
    expect(second!.textContent).not.toContain("Thistledown · Thistledown");
    expect(second!.querySelector("[data-walk-example-date]")!.textContent).toBe("19 Nov 2024");
    // The examples sit after the habits in the panel.
    const habit = document.querySelector("[data-walk-habit]")!;
    expect(habit.compareDocumentPosition(first!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("opens an example in the firm reader's read-only preview, as a citation does", async () => {
    m.walk.mockResolvedValue(habits);
    m.preview.mockResolvedValue({
      itemId: "i2",
      title: "Call notes",
      boardTitle: "Thistledown",
      type: "call",
      date: "2024-11-19",
      grade: "summary",
      text: "The stored summary of the call.",
      shownOn: null,
      canKeepOut: false,
    });
    wrap(<FirmWalkthrough tag={WORKSHOP} profileId="p1" />);
    open();
    await waitFor(() => expect(document.querySelector('[data-walk-example="i2"]')).not.toBeNull());
    fireEvent.click(document.querySelector('[data-walk-example="i2"]')!);
    await waitFor(() =>
      expect(m.preview).toHaveBeenCalledWith({ data: { item_id: "i2", profile_id: "p1" } }),
    );
    await waitFor(() => expect(screen.getByText("The stored summary of the call.")).toBeTruthy());
  });

  it("opens a habit's source the same way", async () => {
    m.walk.mockResolvedValue(habits);
    m.preview.mockResolvedValue({
      itemId: "i1",
      title: "Co-design workshop notes",
      boardTitle: "Advising redesign",
      type: "document",
      date: "2025-04-02",
      grade: "full",
      text: "The pre-read went out two days before the session.",
      shownOn: null,
      canKeepOut: false,
    });
    wrap(<FirmWalkthrough tag={WORKSHOP} profileId="p1" />);
    open();
    await waitFor(() => expect(document.querySelector("[data-firm-source]")).not.toBeNull());
    fireEvent.click(document.querySelector("[data-firm-source]")!);
    await waitFor(() =>
      expect(m.preview).toHaveBeenCalledWith({ data: { item_id: "i1", profile_id: "p1" } }),
    );
  });

  it("says it is reading while it loads, and locks the button so a second press asks nothing", async () => {
    let finish: (value: FirmWalkthroughResult) => void = () => {};
    m.walk.mockReturnValue(new Promise<FirmWalkthroughResult>((resolve) => (finish = resolve)));
    wrap(<FirmWalkthrough tag={WORKSHOP} profileId="p1" />);
    const button = screen.getByTestId("firm-walkthrough-open");
    fireEvent.click(button);
    fireEvent.click(button);
    expect(screen.getByRole("status").textContent).toContain(FIRM_WALK_COPY.pending);
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(m.walk).toHaveBeenCalledTimes(1);
    await act(async () => finish(habits));
    await waitFor(() => expect(state()).toBe("habits"));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("says thin data plainly and shows the examples with no habits", async () => {
    m.walk.mockResolvedValue(thin);
    wrap(<FirmWalkthrough tag={WORKSHOP} profileId="p1" />);
    open();
    await waitFor(() => expect(state()).toBe("thin"));
    expect(document.querySelector("[data-walk-thin]")!.textContent).toBe(FIRM_WALK_COPY.thin(2));
    expect(document.querySelectorAll("[data-walk-habit]")).toHaveLength(0);
    expect(screen.queryByText(FIRM_WALK_COPY.habitsTitle, { selector: "h4" })).toBeNull();
    expect(document.querySelectorAll("[data-walk-example]")).toHaveLength(2);
  });

  it("says so when no habit could be backed, and still shows the examples", async () => {
    m.walk.mockResolvedValue(none);
    wrap(<FirmWalkthrough tag={WORKSHOP} profileId="p1" />);
    open();
    await waitFor(() => expect(state()).toBe("none"));
    expect(document.querySelector("[data-walk-none]")!.textContent).toBe(FIRM_WALK_COPY.none);
    expect(document.querySelectorAll("[data-walk-example]")).toHaveLength(2);
  });

  it("says there is nothing to read when nothing shared carries the tag", async () => {
    m.walk.mockResolvedValue({ ...thin, engagements: 0, examples: [] });
    wrap(<FirmWalkthrough tag={WORKSHOP} profileId="p1" />);
    open();
    await waitFor(() => expect(state()).toBe("thin"));
    expect(document.querySelector("[data-walk-thin]")!.textContent).toBe(FIRM_WALK_COPY.thin(0));
    expect(screen.getByText(FIRM_WALK_COPY.noExamples)).toBeTruthy();
  });

  it("shows a plain line when the load fails, keeps the button, and works on the next press", async () => {
    m.walk.mockRejectedValueOnce(new Error("network"));
    wrap(<FirmWalkthrough tag={WORKSHOP} profileId="p1" />);
    open();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(FIRM_WALK_COPY.error));
    expect(state()).toBe("closed");
    expect((screen.getByTestId("firm-walkthrough-open") as HTMLButtonElement).disabled).toBe(false);
    m.walk.mockResolvedValue(habits);
    open();
    await waitFor(() => expect(state()).toBe("habits"));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps the last walk-through on screen when writing it again fails", async () => {
    m.walk.mockResolvedValueOnce(habits);
    wrap(<FirmWalkthrough tag={WORKSHOP} profileId="p1" />);
    open();
    await waitFor(() => expect(state()).toBe("habits"));
    expect(screen.getByRole("button", { name: FIRM_WALK_COPY.again })).toBeTruthy();
    m.walk.mockRejectedValueOnce(new Error("network"));
    open();
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(document.querySelectorAll("[data-walk-habit]")).toHaveLength(3);
  });

  it("asks the server again on every press: nothing is kept in the browser", async () => {
    m.walk.mockResolvedValueOnce(habits).mockResolvedValueOnce(thin);
    wrap(<FirmWalkthrough tag={WORKSHOP} profileId="p1" />);
    open();
    await waitFor(() => expect(state()).toBe("habits"));
    open();
    // Sharing was turned off in between: the second answer replaces the first outright.
    await waitFor(() => expect(state()).toBe("thin"));
    expect(m.walk).toHaveBeenCalledTimes(2);
    expect(document.querySelectorAll("[data-walk-habit]")).toHaveLength(0);
  });

  it("goes away when the server refuses", async () => {
    m.walk.mockRejectedValue(new Response("Forbidden", { status: 403 }));
    wrap(<FirmWalkthrough tag={WORKSHOP} profileId="p1" />);
    open();
    await waitFor(() => expect(screen.queryByTestId("firm-walkthrough")).toBeNull());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("ignores a reply that arrives after the person has left the point", async () => {
    let finish: (value: FirmWalkthroughResult) => void = () => {};
    m.walk.mockReturnValue(new Promise<FirmWalkthroughResult>((resolve) => (finish = resolve)));
    const errors = vi.spyOn(console, "error");
    const { unmount } = wrap(<FirmWalkthrough tag={WORKSHOP} profileId="p1" />);
    open();
    unmount();
    await act(async () => finish(habits));
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it("shows markup in a title or a habit as text, never as markup", async () => {
    m.walk.mockResolvedValue({
      ...habits,
      habits: [
        {
          text: "Keep it short & plain.",
          quotes: [
            {
              itemId: "i1",
              boardId: "b3",
              quote: '<img src=x onerror="alert(1)"> said the note',
              grade: "quoted",
            },
          ],
        },
      ],
      examples: [{ ...habits.examples[0]!, title: "<script>alert(1)</script> notes" }],
    });
    wrap(<FirmWalkthrough tag={WORKSHOP} profileId="p1" />);
    open();
    await waitFor(() => expect(state()).toBe("habits"));
    expect(document.querySelector("[data-testid=firm-walkthrough] img")).toBeNull();
    expect(document.querySelector("[data-testid=firm-walkthrough] script")).toBeNull();
    expect(document.querySelector("[data-walk-example]")!.textContent).toContain(
      "<script>alert(1)</script> notes",
    );
  });
});

describe("where the button shows in the reading panel", () => {
  const node = {
    id: "method:workshop",
    kind: "method" as const,
    label: "Co-design workshop",
    position: [0, 0, 0] as const,
    size: 5,
    threadIds: ["b3"],
  };
  const thread = {
    id: "b3",
    name: "Harborview College",
    title: "Advising redesign",
    client: "Harborview College",
    startedOn: "2025-01-06",
    situationLabel: "Changing how the organisation works",
    methodLabels: ["Co-design workshop"],
    hasLesson: false,
    hasDeck: false,
    nodeIds: [],
    path: [],
  };
  const reading = { kind: "node" as const, node, threads: [thread], related: [] };

  it("offers the walk-through on a pinned situation or method", () => {
    wrap(
      <FirmMapReading
        reading={reading}
        onFocus={() => {}}
        pinned="method:workshop"
        profileId="p1"
      />,
    );
    expect(screen.getByRole("button", { name: FIRM_WALK_COPY.open })).toBeTruthy();
  });

  it("does not offer it on a point that is only under the mouse, or when another point is pinned", () => {
    const { rerender } = wrap(
      <FirmMapReading reading={reading} onFocus={() => {}} profileId="p1" />,
    );
    expect(screen.queryByTestId("firm-walkthrough")).toBeNull();
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <FirmMapReading
          reading={reading}
          onFocus={() => {}}
          pinned="method:survey"
          profileId="p1"
        />
      </QueryClientProvider>,
    );
    expect(screen.queryByTestId("firm-walkthrough")).toBeNull();
  });

  it("does not offer it on Other, an engagement, the overview or an answer's trace", () => {
    const other = { ...reading, node: { ...node, id: "method:other", label: "Other" } };
    const cases: [MapReading, string | null][] = [
      [other, "method:other"],
      [{ kind: "thread", thread }, "thread:b3"],
      [
        { kind: "overview", totals: { engagements: 1, situations: 1, methods: 1, lessons: 0 } },
        null,
      ],
      [{ kind: "trace", threads: [thread] }, null],
    ];
    for (const [next, pinned] of cases) {
      wrap(<FirmMapReading reading={next} onFocus={() => {}} pinned={pinned} profileId="p1" />);
      expect(screen.queryByTestId("firm-walkthrough"), next.kind).toBeNull();
      cleanup();
    }
  });

  it("starts empty on a new point, so one point's habits never sit under another's name", async () => {
    m.walk.mockResolvedValue(habits);
    const { rerender } = wrap(
      <FirmMapReading
        reading={reading}
        onFocus={() => {}}
        pinned="method:workshop"
        profileId="p1"
      />,
    );
    open();
    await waitFor(() => expect(state()).toBe("habits"));
    const survey = { ...reading, node: { ...node, id: "method:survey", label: "Survey" } };
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <FirmMapReading reading={survey} onFocus={() => {}} pinned="method:survey" profileId="p1" />
      </QueryClientProvider>,
    );
    expect(state()).toBe("closed");
    expect(document.querySelectorAll("[data-walk-habit]")).toHaveLength(0);
  });
});

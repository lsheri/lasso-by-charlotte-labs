// @vitest-environment jsdom
// 18 Nov: Firm Brain Build Spec, step 7. The junior tools on Home: "How we do this" (the analyst's way in to a
// walk-through) and "Prepare me" by role. Who sees them, what the pickers offer, the happy paths, a failed load, a
// refusal, a double press, a role changed mid-request and a reply that arrives after the person left.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { JUNIOR_COPY, type FirmPrepareResult, type JuniorTags } from "@/lib/firm-junior-shared";
import { FIRM_WALK_COPY, type FirmWalkthroughResult } from "@/lib/firm-walkthrough-shared";

const m = vi.hoisted(() => ({
  flag: true,
  tags: vi.fn(),
  prepare: vi.fn(),
  walk: vi.fn(),
  preview: vi.fn(),
  cite: vi.fn(),
}));

vi.mock("@/hooks/use-feature-flag", () => ({ useFeatureFlag: () => m.flag }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/firm-junior.functions", () => ({
  getFirmJuniorTags: (...a: unknown[]) => m.tags(...a),
  getFirmPrepare: (...a: unknown[]) => m.prepare(...a),
}));
vi.mock("@/lib/firm-walkthrough.functions", () => ({
  getFirmWalkthrough: (...a: unknown[]) => m.walk(...a),
}));
vi.mock("@/lib/firm-ask.functions", () => ({
  askTheFirm: vi.fn(),
  previewFirmSource: (...a: unknown[]) => m.preview(...a),
  keepOutOfFirmAnswers: vi.fn(),
}));
vi.mock("@/lib/firm-cite.functions", () => ({ citeFirmLine: (...a: unknown[]) => m.cite(...a) }));
vi.mock("@/hooks/use-work-items", () => ({
  useWorkItems: () => ({ data: { items: [] }, isLoading: false, isError: false }),
}));

import { HowWeDoThis } from "@/components/firm-brain/HowWeDoThis";
import { JuniorTools } from "@/components/firm-brain/JuniorTools";
import { PrepareMe } from "@/components/firm-brain/PrepareMe";

const analyst = { id: "p-yilmaz", role: "em", has_firm_view: true, org_type: "company" };

const TAGS: JuniorTags = {
  situations: [
    { tag: "new_offering", engagements: 5 },
    { tag: "pricing", engagements: 1 },
  ],
  methods: [
    { tag: "stakeholder_interviews", engagements: 21 },
    { tag: "workshop", engagements: 4 },
  ],
  roles: [
    { tag: "chief_medical_officer", engagements: 2 },
    { tag: "hr_leader", engagements: 3 },
  ],
};

const walk: FirmWalkthroughResult = {
  status: "thin",
  kind: "method",
  tag: "workshop",
  label: "Co-design workshop",
  engagements: 2,
  habits: [],
  examples: [],
  sources: {},
  coverage: "Read 26 engagements shared with the firm. Some engagements are not shared.",
};

const questions: FirmPrepareResult = {
  status: "questions",
  role: "chief_medical_officer",
  label: "Chief Medical Officer",
  calls: 2,
  entries: [
    {
      itemId: "i-b7",
      boardId: "b7",
      engagement: "Willowmere Community Health",
      date: "2026-11-05",
      grade: "covered",
      lines: ["There is no front door and nobody owns the cardiometabolic patient."],
    },
    {
      itemId: "i-b5",
      boardId: "b5",
      engagement: "St. Brigid Health",
      date: "2025-03-18",
      grade: "asked",
      lines: ["Where does obesity care break down today?", "What worries you about prescribing?"],
    },
  ],
  fallback: { kind: "method", tag: "stakeholder_interviews", label: "Stakeholder interviews" },
  coverage: "Read 26 engagements shared with the firm. Some engagements are not shared.",
};
const none: FirmPrepareResult = {
  ...questions,
  status: "none",
  role: "chief_nursing_officer",
  label: "Chief Nursing Officer",
  calls: 0,
  entries: [],
};

function wrap(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

const optionValues = (testId: string) =>
  [...screen.getByTestId(testId).querySelectorAll("option")].map((option) => option.value);
const pickRole = (role: string) =>
  fireEvent.change(screen.getByTestId("prepare-me-role"), { target: { value: role } });
const submit = () => fireEvent.click(screen.getByTestId("prepare-me-submit"));
const prepareState = () => screen.getByTestId("prepare-me").getAttribute("data-prepare");

beforeEach(() => {
  m.flag = true;
  for (const fn of [m.tags, m.prepare, m.walk, m.preview, m.cite]) fn.mockReset();
  m.tags.mockResolvedValue(TAGS);
});
afterEach(cleanup);

describe("who sees the junior tools on Home", () => {
  it("shows both tools to an analyst in a company workspace with the flag on, and asks for the list as them", async () => {
    wrap(<JuniorTools profile={analyst} />);
    expect(screen.getByTestId("how-we-do-this")).toBeTruthy();
    expect(screen.getByTestId("prepare-me")).toBeTruthy();
    await waitFor(() => expect(m.tags).toHaveBeenCalledTimes(1));
    expect(m.tags).toHaveBeenCalledWith({ data: { profile_id: "p-yilmaz" } });
  });

  it.each([
    ["an admin", { ...analyst, role: "admin" }],
    ["a lead", { ...analyst, role: "lead" }],
    ["a manager", { ...analyst, id: "p-quinn" }],
  ])("shows them to %s as well", (_name, profile) => {
    wrap(<JuniorTools profile={profile} />);
    expect(screen.getByTestId("junior-tools")).toBeTruthy();
  });

  it("shows nothing, and asks the server nothing, with the flag off", () => {
    m.flag = false;
    wrap(<JuniorTools profile={analyst} />);
    expect(screen.queryByTestId("junior-tools")).toBeNull();
    expect(m.tags).not.toHaveBeenCalled();
  });

  it.each([
    ["a coach", { ...analyst, role: "coach" }],
    ["a personal workspace", { ...analyst, has_firm_view: false, org_type: "solo" }],
    ["no profile", null],
  ])("shows nothing to %s", (_name, profile) => {
    wrap(<JuniorTools profile={profile} />);
    expect(screen.queryByTestId("junior-tools")).toBeNull();
    expect(m.tags).not.toHaveBeenCalled();
  });

  it("goes away when the server refuses, as it does for a guest", async () => {
    m.tags.mockRejectedValue(new Response("Forbidden", { status: 403 }));
    wrap(<JuniorTools profile={analyst} />);
    await waitFor(() => expect(screen.queryByTestId("junior-tools")).toBeNull());
  });

  it("says so plainly when the list fails to load, keeps the tools on screen and lets the person try again", async () => {
    m.tags.mockRejectedValueOnce(new Error("network"));
    wrap(<JuniorTools profile={analyst} />);
    await waitFor(() => expect(screen.getAllByRole("alert").length).toBeGreaterThan(0));
    expect(screen.getAllByText(JUNIOR_COPY.tagsError).length).toBe(2);
    expect(screen.queryByTestId("how-we-do-this-pick")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: JUNIOR_COPY.retry }));
    await waitFor(() => expect(screen.getByTestId("how-we-do-this-pick")).toBeTruthy());
    expect(m.tags).toHaveBeenCalledTimes(2);
  });
});

describe("How we do this", () => {
  const view = (tags: JuniorTags | null = TAGS, loading = false) =>
    wrap(<HowWeDoThis tags={tags} loading={loading} failed={false} profileId="p-yilmaz" />);

  it("offers only the situations and methods the firm has shared work for, from the fixed lists", () => {
    view();
    expect(optionValues("how-we-do-this-pick")).toEqual([
      "",
      "situation:new_offering",
      "situation:pricing",
      "method:stakeholder_interviews",
      "method:workshop",
    ]);
    const labels = [...screen.getByTestId("how-we-do-this-pick").querySelectorAll("option")].map(
      (option) => option.textContent,
    );
    expect(labels).toContain("Launching a new service or program");
    expect(labels).toContain("Co-design workshop");
  });

  it("uses the design system select, not a raw one or a hand-built pill", () => {
    view();
    const select = screen.getByTestId("how-we-do-this-pick");
    expect(select.tagName).toBe("SELECT");
    expect(select.className).toContain("rounded-[var(--radius-control)]");
  });

  it("opens the walk-through in place when a tag is picked, sending only the kind and the tag", async () => {
    m.walk.mockResolvedValue(walk);
    view();
    expect(screen.queryByTestId("firm-walkthrough")).toBeNull();
    fireEvent.change(screen.getByTestId("how-we-do-this-pick"), { target: { value: "method:workshop" } });
    await waitFor(() => expect(screen.getByTestId("firm-walkthrough").getAttribute("data-walk")).toBe("thin"));
    expect(m.walk).toHaveBeenCalledTimes(1);
    expect(m.walk).toHaveBeenCalledWith({ data: { kind: "method", tag: "workshop", profile_id: "p-yilmaz" } });
    expect(screen.getByText(FIRM_WALK_COPY.thin(2))).toBeTruthy();
  });

  it("starts again for a new pick and ignores the reply for the old one", async () => {
    let finishFirst: (value: FirmWalkthroughResult) => void = () => {};
    m.walk
      .mockImplementationOnce(() => new Promise((resolve) => (finishFirst = resolve)))
      .mockResolvedValueOnce({ ...walk, status: "none", tag: "new_offering", kind: "situation" });
    view();
    const select = screen.getByTestId("how-we-do-this-pick");
    fireEvent.change(select, { target: { value: "method:workshop" } });
    fireEvent.change(select, { target: { value: "situation:new_offering" } });
    await waitFor(() => expect(screen.getByTestId("firm-walkthrough").getAttribute("data-walk")).toBe("none"));
    await act(async () => finishFirst(walk));
    expect(screen.getByTestId("firm-walkthrough").getAttribute("data-walk")).toBe("none");
  });

  it("closes the walk-through when the pick is cleared, and ignores a value that is not in the lists", () => {
    m.walk.mockResolvedValue(walk);
    view();
    const select = screen.getByTestId("how-we-do-this-pick");
    fireEvent.change(select, { target: { value: "method:workshop" } });
    expect(screen.getByTestId("firm-walkthrough")).toBeTruthy();
    fireEvent.change(select, { target: { value: "" } });
    expect(screen.queryByTestId("firm-walkthrough")).toBeNull();
    expect(m.walk).toHaveBeenCalledTimes(1);
  });

  it("keeps the picker locked until the list has arrived", () => {
    view(null, true);
    expect((screen.getByTestId("how-we-do-this-pick") as HTMLSelectElement).disabled).toBe(true);
  });

  it("says so when no shared work carries a tag yet", () => {
    view({ situations: [], methods: [], roles: [] });
    expect(screen.getByText(JUNIOR_COPY.noTags)).toBeTruthy();
    expect(screen.queryByTestId("how-we-do-this-pick")).toBeNull();
  });
});

describe("Prepare me", () => {
  const view = (tags: JuniorTags | null = TAGS, loading = false) =>
    wrap(<PrepareMe tags={tags} loading={loading} failed={false} profileId="p-yilmaz" />);

  it("lists every role in the fixed list except Other, with the roles that have past calls first", () => {
    view();
    const values = optionValues("prepare-me-role");
    expect(values.slice(0, 3)).toEqual(["", "chief_medical_officer", "hr_leader"]);
    expect(values).toContain("chief_nursing_officer");
    expect(values).not.toContain("other");
    const groups = [...screen.getByTestId("prepare-me-role").querySelectorAll("optgroup")].map((group) => group.label);
    expect(groups).toEqual([JUNIOR_COPY.withCalls, JUNIOR_COPY.withoutCalls]);
  });

  it("does nothing until a role is picked", () => {
    view();
    expect((screen.getByTestId("prepare-me-submit") as HTMLButtonElement).disabled).toBe(true);
    submit();
    expect(m.prepare).not.toHaveBeenCalled();
  });

  it("returns past questions asked of the role, each entry with its engagement, its date and a way to its source", async () => {
    m.prepare.mockResolvedValue(questions);
    view();
    pickRole("chief_medical_officer");
    submit();
    await waitFor(() => expect(prepareState()).toBe("questions"));
    expect(m.prepare).toHaveBeenCalledWith({ data: { role: "chief_medical_officer", profile_id: "p-yilmaz" } });

    const entries = document.querySelectorAll<HTMLElement>("[data-prepare-entry]");
    expect(entries).toHaveLength(2);
    expect(entries[1]!.getAttribute("data-prepare-entry")).toBe("asked");
    expect(within(entries[1]!).getByText("St. Brigid Health")).toBeTruthy();
    expect(within(entries[1]!).getByText("18 Mar 2025")).toBeTruthy();
    expect(within(entries[1]!).getByText("Where does obesity care break down today?").tagName).toBe("BLOCKQUOTE");
    expect(within(entries[1]!).getByText(JUNIOR_COPY.asked)).toBeTruthy();
    expect(entries[1]!.querySelector("[data-prepare-source='i-b5']")).toBeTruthy();
  });

  it("shows a call from another board as what was covered, not as a quote, and says where it came from", async () => {
    m.prepare.mockResolvedValue(questions);
    view();
    pickRole("chief_medical_officer");
    submit();
    await waitFor(() => expect(prepareState()).toBe("questions"));
    const covered = document.querySelector<HTMLElement>("[data-prepare-entry='covered']")!;
    expect(within(covered).getByText(JUNIOR_COPY.covered)).toBeTruthy();
    expect(within(covered).getByText(JUNIOR_COPY.coveredNote)).toBeTruthy();
    expect(covered.querySelector("blockquote")).toBeNull();
    expect(covered.querySelector("[data-prepare-line='covered']")!.tagName).toBe("P");
  });

  it("opens an entry's source through the same preview as an Ask the firm citation", async () => {
    m.prepare.mockResolvedValue(questions);
    m.preview.mockResolvedValue({
      itemId: "i-b5",
      title: "Interview: Chief Medical Officer",
      boardTitle: "Weight management service line",
      type: "call",
      date: "2025-03-18",
      grade: "full",
      text: "Where does obesity care break down today?",
      shownOn: null,
      canKeepOut: false,
    });
    view();
    pickRole("chief_medical_officer");
    submit();
    await waitFor(() => expect(prepareState()).toBe("questions"));
    fireEvent.click(document.querySelector("[data-prepare-source='i-b5']")!);
    await waitFor(() => expect(document.querySelector("[data-firm-preview-text]")).toBeTruthy());
    expect(m.preview).toHaveBeenCalledWith({ data: { item_id: "i-b5", profile_id: "p-yilmaz" } });
  });

  it("offers Cite this on every line, for the entry's own source", async () => {
    m.prepare.mockResolvedValue(questions);
    view();
    pickRole("chief_medical_officer");
    submit();
    await waitFor(() => expect(prepareState()).toBe("questions"));
    expect(document.querySelectorAll("[data-cite-this]")).toHaveLength(3);
  });

  it("says so for a role with no past calls and offers the general walk-through, naming it", async () => {
    m.prepare.mockResolvedValue(none);
    m.walk.mockResolvedValue({ ...walk, tag: "stakeholder_interviews", label: "Stakeholder interviews" });
    view();
    pickRole("chief_nursing_officer");
    submit();
    await waitFor(() => expect(prepareState()).toBe("none"));
    expect(screen.getByText("No past call with a Chief Nursing Officer is shared with the firm.")).toBeTruthy();
    expect(screen.getByText(JUNIOR_COPY.fallback("Stakeholder interviews"))).toBeTruthy();
    expect(document.querySelectorAll("[data-prepare-entry]")).toHaveLength(0);
    // The walk-through is offered, not opened: no model call until the person asks for it.
    expect(m.walk).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("firm-walkthrough-open"));
    await waitFor(() =>
      expect(m.walk).toHaveBeenCalledWith({
        data: { kind: "method", tag: "stakeholder_interviews", profile_id: "p-yilmaz" },
      }),
    );
  });

  it("says so when the role has calls but nothing in them may be shown, and offers the same walk-through", async () => {
    m.prepare.mockResolvedValue({ ...none, status: "empty", calls: 2 });
    view();
    pickRole("chief_nursing_officer");
    submit();
    await waitFor(() => expect(prepareState()).toBe("empty"));
    expect(screen.getByText(JUNIOR_COPY.empty("Chief Nursing Officer"))).toBeTruthy();
    expect(screen.getByTestId("firm-walkthrough-open")).toBeTruthy();
  });

  it("says so plainly when it fails, stays on screen and works on the next try", async () => {
    m.prepare.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(questions);
    view();
    pickRole("chief_medical_officer");
    submit();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(JUNIOR_COPY.prepareError));
    expect(prepareState()).toBe("closed");
    submit();
    await waitFor(() => expect(prepareState()).toBe("questions"));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("goes away when the server refuses, as it does for a guest or a coach calling it directly", async () => {
    m.prepare.mockRejectedValue(new Response("Forbidden", { status: 403 }));
    view();
    pickRole("chief_medical_officer");
    submit();
    await waitFor(() => expect(screen.queryByTestId("prepare-me")).toBeNull());
  });

  it("asks once when the button is pressed twice", async () => {
    let finish: (value: FirmPrepareResult) => void = () => {};
    m.prepare.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    view();
    pickRole("chief_medical_officer");
    submit();
    submit();
    expect(m.prepare).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status").textContent).toContain(JUNIOR_COPY.preparePending);
    await act(async () => finish(questions));
    expect(prepareState()).toBe("questions");
  });

  it("ignores the reply for a role the person has already moved on from", async () => {
    let finishFirst: (value: FirmPrepareResult) => void = () => {};
    m.prepare
      .mockImplementationOnce(() => new Promise((resolve) => (finishFirst = resolve)))
      .mockResolvedValueOnce(none);
    view();
    pickRole("chief_medical_officer");
    submit();
    pickRole("chief_nursing_officer");
    submit();
    await waitFor(() => expect(prepareState()).toBe("none"));
    await act(async () => finishFirst(questions));
    expect(prepareState()).toBe("none");
    expect(document.querySelectorAll("[data-prepare-entry]")).toHaveLength(0);
  });

  it("clears the last answer when the role changes, so one role's questions never sit under another's name", async () => {
    m.prepare.mockResolvedValue(questions);
    view();
    pickRole("chief_medical_officer");
    submit();
    await waitFor(() => expect(prepareState()).toBe("questions"));
    pickRole("hr_leader");
    expect(prepareState()).toBe("closed");
    expect(document.querySelectorAll("[data-prepare-entry]")).toHaveLength(0);
  });

  it("does nothing with a reply that arrives after the person has left Home", async () => {
    let finish: (value: FirmPrepareResult) => void = () => {};
    m.prepare.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { unmount } = view();
    pickRole("chief_medical_officer");
    submit();
    unmount();
    await act(async () => finish(questions));
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it("keeps the role picker locked until the list has arrived, and says so when the list failed", () => {
    view(null, true);
    expect((screen.getByTestId("prepare-me-role") as HTMLSelectElement).disabled).toBe(true);
    cleanup();
    wrap(<PrepareMe tags={null} loading={false} failed profileId="p-yilmaz" />);
    expect(screen.getByRole("alert").textContent).toBe(JUNIOR_COPY.tagsError);
    expect(screen.queryByTestId("prepare-me-role")).toBeNull();
  });

  it("renders hostile text in a line as text", async () => {
    m.prepare.mockResolvedValue({
      ...questions,
      entries: [{ ...questions.entries[1]!, engagement: "<b>Bold & Co</b>", lines: ["Is <img src=x onerror=alert(1)> safe to show here?"] }],
    });
    view();
    pickRole("chief_medical_officer");
    submit();
    await waitFor(() => expect(prepareState()).toBe("questions"));
    expect(document.querySelector("[data-prepare-entry] img")).toBeNull();
    expect(document.querySelector("[data-prepare-entry] b")).toBeNull();
    expect(screen.getByText("<b>Bold & Co</b>")).toBeTruthy();
  });
});

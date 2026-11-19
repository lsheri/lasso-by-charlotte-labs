// @vitest-environment jsdom
// 19 Nov, Firm Brain Build Spec step 9: the "Value so far" line on a proposal board, the firm's "Proposals: value so
// far" card, "Mark questions as sent" in the draft view, and the Shown to client signal. Server functions are mocked.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProposalDraft } from "@/lib/proposal-draft-shared";
import { LEDGER_COPY, valueSoFar, type BoardValueSoFar, type FirmValueSoFar, type LedgerKind, type LedgerRow, type LedgerValueRow } from "@/lib/proposal-ledger-shared";

const m = vi.hoisted(() => ({ board: vi.fn(), firm: vi.fn(), record: vi.fn(), remove: vi.fn(), value: vi.fn(), shown: vi.fn(), confirm: vi.fn(), rpc: vi.fn(), logEvent: vi.fn(), flag: true }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/hooks/use-feature-flag", () => ({ useFeatureFlag: () => m.flag }));
vi.mock("@/lib/proposal-ledger.functions", () => ({
  boardValueSoFar: (...a: unknown[]) => m.board(...a),
  firmValueSoFar: (...a: unknown[]) => m.firm(...a),
  recordProposalStep: (...a: unknown[]) => m.record(...a),
  removeProposalStep: (...a: unknown[]) => m.remove(...a),
  setProposalValue: (...a: unknown[]) => m.value(...a),
  noteProposalShown: (...a: unknown[]) => m.shown(...a),
}));
vi.mock("@/lib/proposal.functions", () => ({ confirmProposalSection: (...a: unknown[]) => m.confirm(...a) }));
vi.mock("@/lib/telemetry", () => ({ logEvent: (...a: unknown[]) => m.logEvent(...a) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...a: unknown[]) => m.rpc(...a),
    from: () => ({ select: () => ({ eq: async () => ({ data: [], error: null }) }) }),
  },
}));

import { FirmProposalsCard } from "@/components/firm/FirmProposalsCard";
import { ProposalDraftView } from "@/components/firm-brain/ProposalDraftView";
import { ProposalValueLine } from "@/components/firm-brain/ProposalValueLine";
import { useClientShowings } from "@/hooks/use-client-showings";

const BOARD = "0000000b-0000-4000-8000-000000000001";
const OTHER = "0000000b-0000-4000-8000-000000000002";
const DRAFT = "0000000d-0000-4000-8000-000000000001";
const DECK = "0000000d-0000-4000-8000-000000000002";
let n = 0;
const row = (kind: LedgerKind, day: string, over: Partial<LedgerRow> = {}): LedgerRow => {
  n += 1;
  return { id: `r${n}`, engagement_id: BOARD, kind, occurred_at: `${day}T12:00:00.000Z`, source_ref: null, sections_total: null, sections_sourced: null, questions_prepared: null, claims_unsupported: null, ...over };
};

function board(over: Partial<BoardValueSoFar> = {}, values: LedgerValueRow[] | null = null): BoardValueSoFar {
  const rows = over.rows ?? [
    row("brief_received", "2026-11-02"),
    row("draft_completed", "2026-11-04", { id: "draft-row", source_ref: DRAFT, sections_total: 9, sections_sourced: 7, questions_prepared: 5 }),
    row("red_pen_run", "2026-11-05", { id: "run-row", source_ref: "run-1", claims_unsupported: 3 }),
  ];
  return {
    scope: "board",
    access: "owner",
    canEdit: true,
    canSeeValue: false,
    canSetValue: false,
    shared: false,
    finished: false,
    figures: valueSoFar(rows, values),
    rows,
    sources: { "draft-row": { itemId: DRAFT, title: "Proposal draft: Marrowfield", as: "draft" }, "run-row": { itemId: DECK, title: "Proposal draft: Marrowfield", as: "red_pen" } },
    ...over,
  };
}

const line = () => screen.getByTestId("proposal-value-line");
const renderLine = (props: Partial<Parameters<typeof ProposalValueLine>[0]> = {}) => render(<ProposalValueLine engagementId={BOARD} profileId="p1" {...props} />);
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

beforeEach(() => {
  for (const mock of Object.values(m)) if (typeof mock === "function") (mock as ReturnType<typeof vi.fn>).mockReset();
  m.flag = true;
  m.record.mockResolvedValue({ ok: true, row: { id: "new", kind: "questions_sent", occurred_at: "2026-11-10T12:00:00.000Z" } });
  m.remove.mockResolvedValue({ ok: true });
});
afterEach(cleanup);

describe("the board line, for the proposal's owner", () => {
  it("shows the dates as a timeline and the counts, and no value anywhere for an em owner", async () => {
    m.board.mockResolvedValue(board());
    renderLine();
    await waitFor(() => line());
    expect(m.board).toHaveBeenCalledWith({ data: { engagement_id: BOARD, profile_id: "p1" } });
    const steps = [...line().querySelectorAll("[data-ledger-step]")].map((step) => step.textContent);
    expect(steps[0]).toContain("Brief received2 Nov 2026");
    expect(steps[1]).toContain("First draft4 Nov 2026");
    expect(steps[2]).toContain("Questions sentNot recorded");
    expect(steps[5]).toContain("OutcomeNot decided");
    expect([...line().querySelectorAll("[data-ledger-figure]")].map((figure) => figure.textContent)).toEqual([
      "Brief to first draft: 2 days",
      "7 of 9 sections arrived with a source",
      "5 questions prepared for the lead",
      "3 unsupported claims flagged by Red pen, across 1 run",
    ]);
    expect(line().querySelector("[data-ledger-value]")).toBeNull();
    expect(line().textContent).not.toMatch(/Value:|USD|Set value|median/i);
    expect(line().querySelector("[data-ledger-unshared]")?.textContent).toBe(LEDGER_COPY.unsharedNote);
    // The first draft is the machine's row: no way to change its date by hand.
    expect(screen.queryByRole("button", { name: "Change: First draft" })).toBeNull();
  });

  it("says so plainly when nothing is recorded", async () => {
    m.board.mockResolvedValue(board({ rows: [] }));
    renderLine();
    await waitFor(() => expect(line().querySelector("[data-ledger-empty]")?.textContent).toBe(LEDGER_COPY.empty));
    expect(line().querySelectorAll("[data-ledger-figure]")).toHaveLength(0);
  });

  it("opens a figure to the rows behind it, with a link to the draft and to Red pen", async () => {
    m.board.mockResolvedValue(board());
    const onOpenSource = vi.fn();
    renderLine({ onOpenSource });
    await waitFor(() => line());
    fireEvent.click(screen.getByRole("button", { name: "7 of 9 sections arrived with a source" }));
    const trace = line().querySelector('[data-ledger-trace="sourced"]') as HTMLElement;
    expect(trace.textContent).toContain("4 Nov 2026 · First draft · 7 of 9 sections sourced · 5 questions");
    expect(trace.querySelectorAll("[data-ledger-row]")).toHaveLength(1);
    fireEvent.click(within(trace).getByRole("button", { name: LEDGER_COPY.openDraft }));
    expect(onOpenSource).toHaveBeenCalledWith({ itemId: DRAFT, title: "Proposal draft: Marrowfield", as: "draft" });
    fireEvent.click(screen.getByRole("button", { name: /unsupported claims flagged/ }));
    expect(line().querySelector('[data-ledger-trace="sourced"]')).toBeNull();
    const runs = line().querySelector('[data-ledger-trace="claimsCaught"]') as HTMLElement;
    expect(runs.textContent).toContain("5 Nov 2026 · Red pen run · 3 unsupported claims");
    fireEvent.click(within(runs).getByRole("button", { name: LEDGER_COPY.openRedPen }));
    expect(onOpenSource).toHaveBeenLastCalledWith(expect.objectContaining({ as: "red_pen", itemId: DECK }));
    // The timing figure names both rows it was computed from.
    fireEvent.click(screen.getByRole("button", { name: "Brief to first draft: 2 days" }));
    expect(line().querySelectorAll('[data-ledger-trace="briefToDraft"] [data-ledger-row]')).toHaveLength(2);
  });

  it("sets a date, then reads the line again", async () => {
    m.board.mockResolvedValue(board());
    renderLine();
    await waitFor(() => line());
    fireEvent.click(screen.getByRole("button", { name: "Set date: Questions sent" }));
    fireEvent.change(screen.getByLabelText("Questions sent: date"), { target: { value: "2026-11-10" } });
    fireEvent.click(screen.getByRole("button", { name: LEDGER_COPY.save }));
    await waitFor(() => expect(m.board).toHaveBeenCalledTimes(2));
    expect(m.record).toHaveBeenCalledWith({ data: { engagement_id: BOARD, profile_id: "p1", kind: "questions_sent", date: "2026-11-10" } });
    expect(screen.queryByLabelText("Questions sent: date")).toBeNull();
  });

  it("corrects the brief date from the one it has, and can remove a step", async () => {
    m.board.mockResolvedValue(board());
    renderLine();
    await waitFor(() => line());
    fireEvent.click(screen.getByRole("button", { name: "Change: Brief received" }));
    expect((screen.getByLabelText("Brief received: date") as HTMLInputElement).value).toBe("2026-11-02");
    fireEvent.change(screen.getByLabelText("Brief received: date"), { target: { value: "2026-10-28" } });
    fireEvent.click(screen.getByRole("button", { name: LEDGER_COPY.save }));
    await waitFor(() => expect(m.record).toHaveBeenCalledWith({ data: { engagement_id: BOARD, profile_id: "p1", kind: "brief_received", date: "2026-10-28" } }));
    await waitFor(() => expect(screen.queryByLabelText("Brief received: date")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Change: Brief received" }));
    fireEvent.click(screen.getByRole("button", { name: LEDGER_COPY.remove }));
    await waitFor(() => expect(m.remove).toHaveBeenCalledWith({ data: { engagement_id: BOARD, profile_id: "p1", kind: "brief_received" } }));
  });

  it("refuses a future date before any request", async () => {
    m.board.mockResolvedValue(board());
    renderLine();
    await waitFor(() => line());
    fireEvent.click(screen.getByRole("button", { name: "Set date: Sent to client" }));
    fireEvent.change(screen.getByLabelText("Sent to client: date"), { target: { value: "2099-01-01" } });
    fireEvent.click(screen.getByRole("button", { name: LEDGER_COPY.save }));
    expect(screen.getByRole("alert").textContent).toBe(LEDGER_COPY.futureDate);
    fireEvent.change(screen.getByLabelText("Sent to client: date"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: LEDGER_COPY.save }));
    expect(screen.getByRole("alert").textContent).toBe(LEDGER_COPY.badDate);
    expect(m.record).not.toHaveBeenCalled();
  });

  it("marks the outcome, and shows a second outcome's refusal in the server's plain words with the form still open", async () => {
    m.board.mockResolvedValue(board());
    m.record.mockResolvedValue({ ok: false, problem: LEDGER_COPY.secondOutcome("won", "lost") });
    renderLine();
    await waitFor(() => line());
    fireEvent.click(screen.getByRole("button", { name: LEDGER_COPY.markLost }));
    fireEvent.change(screen.getByLabelText("Lost: date"), { target: { value: "2026-11-12" } });
    fireEvent.click(screen.getByRole("button", { name: LEDGER_COPY.save }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("This proposal is already marked won. Remove that before marking it lost."));
    expect(m.record).toHaveBeenCalledWith({ data: { engagement_id: BOARD, profile_id: "p1", kind: "lost", date: "2026-11-12" } });
    expect(screen.getByLabelText("Lost: date")).toBeTruthy();
    expect(m.board).toHaveBeenCalledTimes(1);
  });

  it("shows a recorded outcome with its date and a way to change it, and no second set of buttons", async () => {
    m.board.mockResolvedValue(board({ rows: [row("brief_received", "2026-11-02"), row("won", "2026-11-14")] }));
    renderLine();
    await waitFor(() => line());
    expect(line().querySelector('[data-ledger-step="outcome"]')?.textContent).toContain("Won, 14 Nov 2026");
    expect(screen.queryByRole("button", { name: LEDGER_COPY.markWon })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Change: Outcome" }));
    expect((screen.getByLabelText("Won: date") as HTMLInputElement).value).toBe("2026-11-14");
  });

  it("keeps the form open with a plain line when the write is refused or fails", async () => {
    m.board.mockResolvedValue(board());
    m.record.mockRejectedValue(new Response("Forbidden", { status: 403 }));
    renderLine();
    await waitFor(() => line());
    fireEvent.click(screen.getByRole("button", { name: "Set date: Answers back" }));
    fireEvent.click(screen.getByRole("button", { name: LEDGER_COPY.save }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(LEDGER_COPY.refused));
    expect(screen.getByLabelText("Answers back: date")).toBeTruthy();
    expect((screen.getByRole("button", { name: LEDGER_COPY.save }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("sends one request for a double click", async () => {
    m.board.mockResolvedValue(board());
    const pending = deferred<unknown>();
    m.record.mockReturnValue(pending.promise);
    renderLine();
    await waitFor(() => line());
    fireEvent.click(screen.getByRole("button", { name: "Set date: Questions sent" }));
    const form = line().querySelector('[data-ledger-step-form="questions_sent"]') as HTMLFormElement;
    fireEvent.submit(form);
    fireEvent.submit(form);
    fireEvent.click(screen.getByRole("button", { name: LEDGER_COPY.save }));
    expect(m.record).toHaveBeenCalledTimes(1);
    expect((screen.getByRole("button", { name: LEDGER_COPY.save }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: LEDGER_COPY.cancel }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => pending.resolve({ ok: true, row: { id: "x", kind: "questions_sent", occurred_at: "" } }));
  });

  it("changes nothing when the panel closes before the request returns", async () => {
    m.board.mockResolvedValue(board());
    const pending = deferred<unknown>();
    m.record.mockReturnValue(pending.promise);
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const view = renderLine();
    await waitFor(() => line());
    fireEvent.click(screen.getByRole("button", { name: "Set date: Questions sent" }));
    fireEvent.click(screen.getByRole("button", { name: LEDGER_COPY.save }));
    view.unmount();
    await act(async () => pending.resolve({ ok: false, problem: "late" }));
    expect(m.board).toHaveBeenCalledTimes(1);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it("ignores a slow first load that arrives after a newer one", async () => {
    const slow = deferred<BoardValueSoFar>();
    m.board.mockReturnValueOnce(slow.promise).mockResolvedValueOnce(board({ rows: [row("brief_received", "2026-11-09")] }));
    const view = renderLine({ refreshKey: 0 });
    view.rerender(<ProposalValueLine engagementId={BOARD} profileId="p1" refreshKey={1} />);
    await waitFor(() => expect(line().textContent).toContain("9 Nov 2026"));
    await act(async () => slow.resolve(board({ rows: [] })));
    expect(line().textContent).toContain("9 Nov 2026");
  });

  it("says the load failed and tries again", async () => {
    m.board.mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce(board());
    renderLine();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(LEDGER_COPY.loadFailed));
    fireEvent.click(screen.getByRole("button", { name: LEDGER_COPY.retry }));
    await waitFor(() => expect(line().querySelectorAll("[data-ledger-figure]")).toHaveLength(4));
  });

  it("offers nothing to change to someone who cannot edit the board, and points out a finished engagement to someone who can", async () => {
    m.board.mockResolvedValue(board({ access: "partner", canEdit: false, shared: true, finished: true }));
    renderLine();
    await waitFor(() => line());
    expect(within(line()).queryAllByRole("button").map((button) => button.textContent)).toEqual(["Brief to first draft: 2 days", "7 of 9 sections arrived with a source", "5 questions prepared for the lead", "3 unsupported claims flagged by Red pen, across 1 run"]);
    expect(line().querySelector("[data-ledger-finished-hint]")).toBeNull();
    expect(line().querySelector("[data-ledger-unshared]")).toBeNull();
    cleanup();
    m.board.mockResolvedValue(board({ finished: true }));
    renderLine();
    await waitFor(() => expect(line().querySelector("[data-ledger-finished-hint]")?.textContent).toBe(LEDGER_COPY.finishedHint));
  });

  it("renders nothing for someone the database shows nothing", async () => {
    m.board.mockResolvedValue(board({ access: "none", canEdit: false, rows: [], sources: {} }));
    const view = renderLine();
    await waitFor(() => expect(m.board).toHaveBeenCalled());
    await act(async () => {});
    expect(view.container.innerHTML).toBe("");
  });
});

describe("the value, for admins and leads", () => {
  const partner = (over: Partial<BoardValueSoFar> = {}) => board({ access: "partner", canSeeValue: true, canSetValue: true, shared: true, value: { amount: 380_000, currency: "USD" }, ...over });

  it("shows the value by its code and lets it be changed", async () => {
    m.board.mockResolvedValue(partner());
    m.value.mockResolvedValue({ ok: true, value: { amount: 410_000, currency: "GBP" } });
    renderLine();
    await waitFor(() => expect(line().querySelector("[data-ledger-value]")?.textContent).toContain("USD 380,000"));
    fireEvent.click(within(line().querySelector("[data-ledger-value]") as HTMLElement).getByRole("button", { name: LEDGER_COPY.change }));
    expect((screen.getByLabelText(LEDGER_COPY.amountLabel) as HTMLInputElement).value).toBe("380000");
    fireEvent.change(screen.getByLabelText(LEDGER_COPY.amountLabel), { target: { value: "£410,000" } });
    fireEvent.change(screen.getByLabelText(LEDGER_COPY.currencyLabel), { target: { value: "GBP" } });
    fireEvent.click(screen.getByRole("button", { name: LEDGER_COPY.save }));
    await waitFor(() => expect(m.value).toHaveBeenCalledWith({ data: { engagement_id: BOARD, profile_id: "p1", amount_text: "£410,000", currency: "GBP" } }));
    await waitFor(() => expect(m.board).toHaveBeenCalledTimes(2));
  });

  it.each([
    ["-5000", LEDGER_COPY.badAmount],
    ["", LEDGER_COPY.needAmount],
    ["$300k to $350k", LEDGER_COPY.badAmount],
    ["£380k", "The amount says pounds but the currency is USD. Make them match."],
    ["$45k per month", LEDGER_COPY.monthlyAmount],
  ])("refuses %s before any request", async (text, problem) => {
    m.board.mockResolvedValue(partner({ value: null }));
    renderLine();
    await waitFor(() => line());
    fireEvent.click(screen.getByRole("button", { name: LEDGER_COPY.setValue }));
    fireEvent.change(screen.getByLabelText(LEDGER_COPY.amountLabel), { target: { value: text } });
    fireEvent.click(screen.getByRole("button", { name: LEDGER_COPY.save }));
    expect(screen.getByRole("alert").textContent).toBe(problem);
    expect(m.value).not.toHaveBeenCalled();
  });

  it("offers only the listed currencies", async () => {
    m.board.mockResolvedValue(partner({ value: null }));
    renderLine();
    await waitFor(() => line());
    fireEvent.click(screen.getByRole("button", { name: LEDGER_COPY.setValue }));
    expect([...(screen.getByLabelText(LEDGER_COPY.currencyLabel) as HTMLSelectElement).options].map((option) => option.value)).toEqual(["USD", "GBP", "EUR", "AUD", "CAD", "NZD", "CHF", "SGD"]);
  });

  it("keeps the form open when the server refuses, in its words or with a plain line", async () => {
    m.board.mockResolvedValue(partner({ value: null }));
    m.value.mockResolvedValueOnce({ ok: false, problem: LEDGER_COPY.notProposal }).mockRejectedValueOnce(new Response("Forbidden", { status: 403 }));
    renderLine();
    await waitFor(() => line());
    fireEvent.click(screen.getByRole("button", { name: LEDGER_COPY.setValue }));
    fireEvent.change(screen.getByLabelText(LEDGER_COPY.amountLabel), { target: { value: "380k" } });
    fireEvent.click(screen.getByRole("button", { name: LEDGER_COPY.save }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(LEDGER_COPY.notProposal));
    fireEvent.click(screen.getByRole("button", { name: LEDGER_COPY.save }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(LEDGER_COPY.valueRefused));
    expect(screen.getByLabelText(LEDGER_COPY.amountLabel)).toBeTruthy();
  });

  it("removes a value", async () => {
    m.board.mockResolvedValue(partner());
    m.value.mockResolvedValue({ ok: true, value: null });
    renderLine();
    await waitFor(() => line());
    fireEvent.click(within(line().querySelector("[data-ledger-value]") as HTMLElement).getByRole("button", { name: LEDGER_COPY.change }));
    fireEvent.click(screen.getByRole("button", { name: LEDGER_COPY.removeValue }));
    await waitFor(() => expect(m.value).toHaveBeenCalledWith({ data: { engagement_id: BOARD, profile_id: "p1", clear: true } }));
  });

  it("lets a partner on a board the database does not show them set the value, and says who will see it", async () => {
    m.board.mockResolvedValue(board({ access: "none", canEdit: true, canSetValue: true, rows: [], sources: {} }));
    m.value.mockResolvedValue({ ok: true, value: { amount: 380_000, currency: "USD" } });
    renderLine();
    await waitFor(() => expect(line().getAttribute("data-ledger-access")).toBe("none"));
    expect(line().textContent).toContain(LEDGER_COPY.valueWriteOnly);
    expect(line().querySelector("[data-ledger-timeline]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: LEDGER_COPY.setValue }));
    fireEvent.change(screen.getByLabelText(LEDGER_COPY.amountLabel), { target: { value: "380k" } });
    fireEvent.click(screen.getByRole("button", { name: LEDGER_COPY.save }));
    await waitFor(() => expect(line().querySelector("[data-ledger-value-saved]")?.textContent).toBe("Saved: USD 380,000."));
  });
});

describe("the firm card, for admins and leads", () => {
  const wrap = ({ children }: { children: ReactNode }) => <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;
  function firmView(): FirmValueSoFar {
    const rows = [
      row("brief_received", "2026-11-02"),
      row("draft_completed", "2026-11-04", { source_ref: DRAFT, sections_total: 9, sections_sourced: 7, questions_prepared: 5 }),
      row("won", "2026-11-14"),
      row("brief_received", "2026-11-03", { engagement_id: OTHER }),
      row("draft_completed", "2026-11-09", { engagement_id: OTHER, source_ref: DECK, sections_total: 9, sections_sourced: 4, questions_prepared: 6 }),
      row("lost", "2026-11-16", { engagement_id: OTHER }),
    ];
    return { scope: "firm", rows, figures: valueSoFar(rows, [{ engagement_id: BOARD, amount: 380_000, currency: "USD" }]) };
  }
  const card = () => screen.getByTestId("firm-proposals-card");

  it("shows the figures across shared proposals, each opening to its rows, and says unshared proposals are not counted", async () => {
    m.firm.mockResolvedValue(firmView());
    render(<FirmProposalsCard profileId="p1" />, { wrapper: wrap });
    await waitFor(() => expect(card().querySelectorAll("[data-ledger-figure]").length).toBeGreaterThan(0));
    expect(m.firm).toHaveBeenCalledWith({ data: { profile_id: "p1" } });
    expect([...card().querySelectorAll("[data-ledger-figure]")].map((figure) => figure.textContent)).toEqual([
      "2 proposals started",
      "Median from brief to first draft: 4 days, across 2 proposals",
      "11 of 18 sections arrived with a source (61%)",
      "11 questions prepared for the lead",
      "1 won",
      "1 lost",
      "Value won: USD 380,000",
    ]);
    expect(card().textContent).toContain(LEDGER_COPY.firmUnshared);
    expect(card().textContent).toContain("never per person");
    for (const figure of card().querySelectorAll("[data-ledger-figure] > button")) {
      fireEvent.click(figure);
      expect(card().querySelectorAll("[data-ledger-trace] [data-ledger-row]").length, figure.textContent ?? "").toBeGreaterThan(0);
    }
    // No link out of the firm trace, and no board or person named.
    expect(within(card().querySelector("[data-ledger-trace]") as HTMLElement).queryByRole("button")).toBeNull();
    expect(card().textContent).not.toMatch(/Marrowfield|Harper|owner/i);
  });

  it("says so plainly when no shared proposal has anything recorded", async () => {
    m.firm.mockResolvedValue({ scope: "firm", rows: [], figures: valueSoFar([], []) });
    render(<FirmProposalsCard profileId="p1" />, { wrapper: wrap });
    await waitFor(() => expect(card().querySelector("[data-ledger-empty]")?.textContent).toBe(LEDGER_COPY.firmEmpty));
    expect(card().textContent).toContain(LEDGER_COPY.firmUnshared);
  });

  it("says the load failed and tries again", async () => {
    m.firm.mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce(firmView());
    render(<FirmProposalsCard profileId="p1" />, { wrapper: wrap });
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain(LEDGER_COPY.loadFailed));
    fireEvent.click(screen.getByRole("button", { name: LEDGER_COPY.retry }));
    await waitFor(() => expect(card().querySelectorAll("[data-ledger-figure]").length).toBe(7));
  });

  it("is hidden, and asks the server nothing, with the flag off or no profile", () => {
    m.flag = false;
    const off = render(<FirmProposalsCard profileId="p1" />, { wrapper: wrap });
    expect(off.container.innerHTML).toBe("");
    m.flag = true;
    const nobody = render(<FirmProposalsCard profileId={undefined} />, { wrapper: wrap });
    expect(nobody.container.innerHTML).toBe("");
    expect(m.firm).not.toHaveBeenCalled();
  });
});

describe("questions copied can be marked as sent", () => {
  const draft: ProposalDraft = {
    sections: [{ key: "context", heading: "Context", body: "Body.", status: "draft", sources: [], flags: [] }],
    questions: [{ text: "Interview count?", fallback: "20 to 25" }],
    checks: { names: "passed", blocked: 0, figuresRemoved: 0, newFacts: 0 },
    precedentIds: [],
    createdAt: "2026-11-10T09:00:00.000Z",
  };
  const copy = async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
    fireEvent.click(screen.getByRole("button", { name: /copy/i }));
    await waitFor(() => screen.getByRole("button", { name: LEDGER_COPY.markQuestionsSent }));
  };

  it("offers it only after the copy, records today once, and tells the line to read again", async () => {
    const onLedgerChanged = vi.fn();
    render(<ProposalDraftView itemId={DRAFT} draft={draft} profileId="p1" orgId="o1" onOpen={() => {}} engagementId={BOARD} onLedgerChanged={onLedgerChanged} />);
    expect(screen.queryByRole("button", { name: LEDGER_COPY.markQuestionsSent })).toBeNull();
    await copy();
    const button = screen.getByRole("button", { name: LEDGER_COPY.markQuestionsSent });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByText(LEDGER_COPY.questionsMarked)).toBeTruthy());
    expect(m.record).toHaveBeenCalledTimes(1);
    expect(m.record.mock.calls[0]![0]).toMatchObject({ data: { engagement_id: BOARD, profile_id: "p1", kind: "questions_sent" } });
    expect(m.record.mock.calls[0]![0].data.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(onLedgerChanged).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: LEDGER_COPY.markQuestionsSent })).toBeNull();
  });

  it("says so when it could not be marked, in the server's words or a plain line, and can be tried again", async () => {
    m.record.mockResolvedValueOnce({ ok: false, problem: LEDGER_COPY.needBrief }).mockRejectedValueOnce(new Error("down"));
    render(<ProposalDraftView itemId={DRAFT} draft={draft} profileId="p1" orgId="o1" onOpen={() => {}} engagementId={BOARD} />);
    await copy();
    fireEvent.click(screen.getByRole("button", { name: LEDGER_COPY.markQuestionsSent }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(LEDGER_COPY.needBrief));
    fireEvent.click(screen.getByRole("button", { name: LEDGER_COPY.markQuestionsSent }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(LEDGER_COPY.questionsMarkFailed));
  });

  it("is not offered where the draft view has no board", async () => {
    render(<ProposalDraftView itemId={DRAFT} draft={draft} profileId="p1" orgId="o1" onOpen={() => {}} />);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
    fireEvent.click(screen.getByRole("button", { name: /copy/i }));
    await act(async () => {});
    expect(screen.queryByRole("button", { name: LEDGER_COPY.markQuestionsSent })).toBeNull();
  });
});

describe("Shown to client is the one place the sent date is entered", () => {
  const wrap = ({ children }: { children: ReactNode }) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
  const profile = { id: "p1", org_id: "o1", org_type: "company", has_firm_view: true };

  it("tells the server after the mark is saved, sending no date of its own", async () => {
    m.rpc.mockResolvedValue({ error: null });
    m.shown.mockResolvedValue({ recorded: true });
    const { result } = renderHook(() => useClientShowings({ engagementId: BOARD, profile, canEdit: true }), { wrapper: wrap });
    await act(async () => result.current.mark({ itemId: DRAFT, itemType: "document", shownOn: "2026-11-12", occasion: "" }));
    await waitFor(() => expect(m.shown).toHaveBeenCalledWith({ data: { engagement_id: BOARD, item_id: DRAFT, profile_id: "p1" } }));
    expect(m.rpc).toHaveBeenCalledWith("mark_client_showing", expect.objectContaining({ p_item: DRAFT, p_shown_on: "2026-11-12" }));
  });

  it("the mark still succeeds when the ledger call fails, and nothing is sent when the mark is refused", async () => {
    m.rpc.mockResolvedValueOnce({ error: null });
    m.shown.mockRejectedValue(new Error("ledger down"));
    const { result } = renderHook(() => useClientShowings({ engagementId: BOARD, profile, canEdit: true }), { wrapper: wrap });
    await act(async () => {
      await expect(result.current.mark({ itemId: DRAFT, itemType: "document", shownOn: "2026-11-12", occasion: "" })).resolves.toBeUndefined();
    });
    await waitFor(() => expect(m.shown).toHaveBeenCalledTimes(1));
    m.rpc.mockResolvedValueOnce({ error: { message: "refused" } });
    await act(async () => {
      await expect(result.current.mark({ itemId: DRAFT, itemType: "document", shownOn: "2026-11-12", occasion: "" })).rejects.toBeTruthy();
    });
    expect(m.shown).toHaveBeenCalledTimes(1);
  });
});

// @vitest-environment jsdom
// 17 Nov, firm brain PR 5: the Start a proposal panel. Notes become a brief the owner corrects; precedents show close
// or loose with their lesson; past fees appear only for admins and leads, as a list; a swap needs no new request.
// PR 7: the Draft button comes after the precedents; the draft opens as sections, none confirmed, with no accept-all,
// the fee for partner decision, and the questions for the lead to copy. The saved card goes to the board.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProposalDraft } from "@/lib/proposal-draft-shared";
import type { PrecedentsResult } from "@/lib/proposal.functions";

const m = vi.hoisted(() => ({ brief: vi.fn(), find: vi.fn(), draft: vi.fn(), latest: vi.fn(), confirm: vi.fn(), logEvent: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/proposal.functions", () => ({
  draftProposalBrief: (...a: unknown[]) => m.brief(...a),
  findProposalPrecedents: (...a: unknown[]) => m.find(...a),
  draftProposal: (...a: unknown[]) => m.draft(...a),
  latestProposalDraft: (...a: unknown[]) => m.latest(...a),
  confirmProposalSection: (...a: unknown[]) => m.confirm(...a),
}));
vi.mock("@/lib/firm-ask.functions", () => ({ previewFirmSource: vi.fn(), keepOutOfFirmAnswers: vi.fn() }));
vi.mock("@/lib/telemetry", () => ({ logEvent: (...a: unknown[]) => m.logEvent(...a) }));

import { ProposalStartPanel } from "@/components/firm-brain/ProposalStartPanel";

const view = (boardId: string, title: string, closeness: "close" | "loose", lesson: string | null) => ({
  boardId,
  title,
  client: null,
  closeness,
  why: closeness === "close" ? "Same kind of service line" : "",
  scope: "Scope.",
  weeks: 14,
  active: false,
  ranToPlan: false,
  extended: true,
  lesson,
  sowItemId: `sow-${boardId}`,
});

const found = (canSeeFees: boolean): PrecedentsResult => ({
  precedents: [view("b5", "Weight management service line", "close", "CFO time two weeks sooner."), view("b6", "Behavioral health service line", "close", "Start payer conversations alongside the diagnostic.")],
  options: [view("b7", "Cardiometabolic opportunity", "loose", null)],
  good: [{ itemId: "prop5", title: "Proposal: St. Brigid", boardTitle: "Weight management service line", shownOn: "2025-02-18" }],
  fees: canSeeFees
    ? {
        fixed: [
          { boardId: "b5", title: "Weight management service line", fee: "$380k", basis: "fixed", weeks: 16, startedOn: "2025-03-03", ranToPlan: true, extended: true, sowItemId: "sow-b5" },
          { boardId: "b7", title: "Cardiometabolic opportunity", fee: "$90k", basis: "fixed", weeks: 4, startedOn: "2026-11-02", ranToPlan: null, extended: null, sowItemId: "sow-b7" },
        ],
        monthly: [],
      }
    : { fixed: [], monthly: [] },
  canSeeFees,
  coverage: "Read 26 engagements shared with the firm. Some engagements are not shared.",
});

const draft: ProposalDraft = {
  sections: [
    { key: "context", heading: "Context", body: "The client wants a service line by April.", status: "draft", sources: [{ kind: "fact", itemId: "own1", itemTitle: "Intake call", quote: "a service line by April" }], flags: [] },
    { key: "approach", heading: "Approach", body: "Phase 1: Diagnostic", status: "draft", sources: [{ kind: "structure", boardId: "b5", boardTitle: "Weight management service line" }], flags: [] },
    { key: "deliverables", heading: "Deliverables", body: "Gap: nothing supports this yet.", status: "gap", sources: [], flags: [] },
    { key: "fee", heading: "Fees", body: "Fee: for partner decision.", status: "draft", sources: [], flags: [] },
  ],
  questions: [
    { text: "Interview count?", fallback: "20 to 25, as on a past engagement" },
    { text: "Add CFO time in week 2?", fallback: "Yes" },
    { text: "Phase count?", fallback: "Two" },
  ],
  checks: { names: "passed", blocked: 0, figuresRemoved: 0, newFacts: 0 },
  precedentIds: ["b5", "b6"],
  createdAt: "2026-11-17T12:00:00Z",
};

function open(onDraftSaved?: (itemId: string) => void) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ProposalStartPanel engagementId="00000000-0000-0000-0000-000000000031" profileId="p1" orgId="org" onClose={() => {}} onDraftSaved={onDraftSaved} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  m.brief.mockReset();
  m.find.mockReset();
  m.logEvent.mockReset();
  m.draft.mockReset();
  m.latest.mockReset();
  m.confirm.mockReset();
  m.latest.mockResolvedValue(null);
  m.brief.mockResolvedValue({ client: "regional health system", problem: "Diabetes prevention service line", deadline: "April board", decider: "Chief Strategy Officer", size: "", outOfScope: "" });
});
afterEach(cleanup);

describe("Start a proposal", () => {
  it("reads the notes into a brief the owner can correct, then finds precedents with their lessons", async () => {
    m.find.mockResolvedValue(found(false));
    open();
    fireEvent.click(screen.getByRole("button", { name: "Read the notes" }));
    await waitFor(() => expect((screen.getByDisplayValue("Diabetes prevention service line") as HTMLInputElement).value).toBeTruthy());
    fireEvent.change(screen.getByDisplayValue("April board"), { target: { value: "April 2027 board" } });
    fireEvent.click(screen.getByRole("button", { name: "Find precedents" }));
    await waitFor(() => expect(document.querySelectorAll("[data-precedent]")).toHaveLength(2));
    expect(m.find.mock.calls[0]![0].data.brief.deadline).toBe("April 2027 board");
    expect(screen.getByText("2 close matches.")).toBeTruthy();
    expect([...document.querySelectorAll("[data-precedent-lesson]")].map((node) => node.textContent)).toContain("Last time: Start payer conversations alongside the diagnostic.");
    expect(screen.getByText("Proposal: St. Brigid")).toBeTruthy();
    expect(document.querySelector("[data-proposal-coverage]")!.textContent).toContain("Some engagements are not shared.");
  });

  it("shows no fees to someone without fee access", async () => {
    m.find.mockResolvedValue(found(false));
    open();
    fireEvent.change(screen.getAllByRole("textbox")[1]!, { target: { value: "Diabetes prevention" } });
    fireEvent.click(screen.getByRole("button", { name: "Find precedents" }));
    await waitFor(() => expect(document.querySelectorAll("[data-precedent]")).toHaveLength(2));
    expect(document.querySelector("[data-past-fees]")).toBeNull();
    expect(document.body.textContent).not.toMatch(/\$\d/);
  });

  it("lists past fees for admins and leads, only for the chosen precedents, and follows a swap", async () => {
    m.find.mockResolvedValue(found(true));
    open();
    fireEvent.change(screen.getAllByRole("textbox")[1]!, { target: { value: "Diabetes prevention" } });
    fireEvent.click(screen.getByRole("button", { name: "Find precedents" }));
    await waitFor(() => expect(document.querySelector("[data-past-fees]")).not.toBeNull());
    expect([...document.querySelectorAll("[data-past-fee]")].map((node) => node.textContent)).toEqual([expect.stringContaining("$380k")]);
    fireEvent.change(screen.getByLabelText("Swap for Behavioral health service line"), { target: { value: "b7" } });
    expect([...document.querySelectorAll("[data-precedent]")].map((node) => node.textContent)).toEqual([expect.stringContaining("Weight management"), expect.stringContaining("Cardiometabolic opportunity")]);
    expect([...document.querySelectorAll("[data-past-fee] > span:first-child")].map((node) => node.textContent)).toEqual(["$380k", "$90k"]);
    await waitFor(() => expect(m.logEvent).toHaveBeenCalledWith("proposal_draft.precedent_swapped", "org", {}));
  });

  it("says plainly when nothing is close", async () => {
    m.find.mockResolvedValue({ ...found(false), precedents: [] });
    open();
    fireEvent.change(screen.getAllByRole("textbox")[1]!, { target: { value: "Aerospace" } });
    fireEvent.click(screen.getByRole("button", { name: "Find precedents" }));
    await waitFor(() => expect(screen.getByText("No past engagement shared with the firm is close to this brief.")).toBeTruthy());
  });

  it("drafts after the precedents, opens every section unconfirmed with no accept-all, and puts the card on the board", async () => {
    m.find.mockResolvedValue(found(false));
    m.draft.mockResolvedValue({ itemId: "doc1", title: "Proposal draft: Pursuit", draft });
    const placed = vi.fn();
    open(placed);
    expect(screen.queryByRole("button", { name: "Draft the proposal" })).toBeNull();
    fireEvent.change(screen.getAllByRole("textbox")[1]!, { target: { value: "Diabetes prevention" } });
    fireEvent.click(screen.getByRole("button", { name: "Find precedents" }));
    fireEvent.click(await screen.findByRole("button", { name: "Draft the proposal" }));
    await waitFor(() => expect(document.querySelectorAll("[data-draft-section]")).toHaveLength(4));
    expect(m.draft.mock.calls[0]![0].data.precedent_ids).toEqual(["b5", "b6"]);
    expect(placed).toHaveBeenCalledWith("doc1");
    expect([...document.querySelectorAll("[data-draft-section]")].every((node) => node.getAttribute("data-draft-status") !== "confirmed")).toBe(true);
    expect(screen.queryByRole("button", { name: /accept all/i })).toBeNull();
    expect(document.querySelector("[data-draft-status-strip]")!.textContent).toContain("4 sections not yet confirmed");
    expect(document.querySelector("[data-draft-status-strip]")!.textContent).toContain("Fee not set");
    expect(screen.getByText("Fee: for partner decision.")).toBeTruthy();
    expect(screen.getByText("Name check passed. No other client's name appears.")).toBeTruthy();
    expect(document.querySelector('[data-draft-source="structure"]')!.textContent).toBe("Structure from a past engagement: Weight management service line");
    expect(document.querySelector('[data-draft-source="fact"]')!.textContent).toContain("a service line by April");
  });

  it("confirms one section at a time and copies the questions without sending anything", async () => {
    m.latest.mockResolvedValue({ itemId: "doc1", title: "Proposal draft: Pursuit", draft });
    m.confirm.mockResolvedValue({ ...draft, sections: draft.sections.map((section) => (section.key === "context" ? { ...section, status: "confirmed" } : section)) });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    open();
    await screen.findByText("Last draft on this board");
    fireEvent.click(screen.getAllByRole("button", { name: "Confirm section" })[0]!);
    await waitFor(() => expect(document.querySelector('[data-draft-section="context"]')!.getAttribute("data-draft-status")).toBe("confirmed"));
    expect(m.confirm).toHaveBeenCalledWith({ data: { item_id: "doc1", section: "context", profile_id: "p1" } });
    expect(document.querySelector("[data-draft-status-strip]")!.textContent).toContain("3 sections not yet confirmed");
    fireEvent.click(screen.getByRole("button", { name: "Copy questions" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining("1. Interview count? (Default: 20 to 25, as on a past engagement)")));
    await waitFor(() => expect(m.logEvent).toHaveBeenCalledWith("proposal_draft.questions_copied", "org", {}));
  });
});

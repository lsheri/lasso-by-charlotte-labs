// @vitest-environment jsdom
// 17 Nov, firm brain PR 5: the Start a proposal panel. Notes become a brief the owner corrects; precedents show close
// or loose with their lesson; past fees appear only for admins and leads, as a list; a swap needs no new request.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PrecedentsResult } from "@/lib/proposal.functions";

const m = vi.hoisted(() => ({ brief: vi.fn(), find: vi.fn(), logEvent: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/proposal.functions", () => ({
  draftProposalBrief: (...a: unknown[]) => m.brief(...a),
  findProposalPrecedents: (...a: unknown[]) => m.find(...a),
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

function open() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ProposalStartPanel engagementId="00000000-0000-0000-0000-000000000031" profileId="p1" orgId="org" onClose={() => {}} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  m.brief.mockReset();
  m.find.mockReset();
  m.logEvent.mockReset();
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
});

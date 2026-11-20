// @vitest-environment jsdom
// 20 Nov 2026, chat pill Phase 0 (Liam, D-97): while texts have not started, a real workspace records the lead's
// answer by hand instead of asking by text, and a demo workspace keeps its practice ask. The rows and the won strip.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BoardWinLines } from "@/components/proposals/BoardWinStrip";
import { ProposalDesk } from "@/components/proposals/ProposalDesk";
import { ASK_COPY, type AskView } from "@/lib/lead-ask-shared";
import type { DeskList, DeskProposal } from "@/lib/proposal-desk-shared";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>,
}));

afterEach(cleanup);

const NOW = new Date("2026-11-20T12:00:00Z");
const proposal = (over: Partial<DeskProposal> = {}): DeskProposal => ({
  id: "p",
  title: "Workforce plan",
  clientName: "Larkspur Senior Living",
  ownerName: "Maren Hollis",
  mine: true,
  status: "open",
  receivedAt: "2026-11-20T02:00:00Z",
  sentAt: null,
  decidedAt: null,
  engagementId: null,
  contextCount: 0,
  canAct: true,
  canClose: true,
  canArchive: false,
  leadContactId: "lead-1",
  leadName: "Christy Johnson",
  ask: null,
  ...over,
});
const data = (texts: DeskList["texts"], p: DeskProposal = proposal()): DeskList => ({
  goalHours: 72,
  canSetGoal: true,
  canPickLead: true,
  canAddClient: true,
  texts,
  proposals: [p],
});

function desk(texts: DeskList["texts"], p?: DeskProposal) {
  const recordAnswer = vi.fn(async () => ({ ok: true as const }));
  const practiceReply = vi.fn(async () => ({ ok: true as const }));
  const ask = { preview: vi.fn(), send: vi.fn(), practiceReply, recordAnswer };
  render(<ProposalDesk now={NOW} data={data(texts, p)} roster={[]} onLead={vi.fn()} ask={ask} />);
  return {
    recordAnswer,
    practiceReply,
    row: document.querySelector('[data-proposal-row="p"]') as HTMLElement,
  };
}

describe("a real workspace whose texts have not started", () => {
  it("offers to record the lead's answer, and no ask by text that could only send nothing", async () => {
    const { recordAnswer, row } = desk({ demo: false, connected: false });
    expect(within(row).getByText(ASK_COPY.recordPrompt)).toBeTruthy();
    expect(
      within(row).queryByRole("button", { name: ASK_COPY.open("Christy Johnson") }),
    ).toBeNull();
    fireEvent.click(within(row).getByRole("button", { name: ASK_COPY.recordYes }));
    await waitFor(() => expect(recordAnswer).toHaveBeenCalledWith("p", "yes"));
    // YES and NO only: STOP is a reply to a text, and nobody records it for someone else.
    expect(within(row).queryByRole("button", { name: /stop/i })).toBeNull();
  });

  it("says what went wrong when the answer is not recorded, and keeps the buttons", async () => {
    const { recordAnswer, row } = desk({ demo: false, connected: false });
    recordAnswer.mockResolvedValueOnce({
      ok: false,
      problem: ASK_COPY.alreadyAnswered("Christy Johnson"),
    } as never);
    fireEvent.click(within(row).getByRole("button", { name: ASK_COPY.recordNo }));
    expect(await within(row).findByRole("alert")).toBeTruthy();
    expect(within(row).getByRole("alert").textContent).toBe(
      ASK_COPY.alreadyAnswered("Christy Johnson"),
    );
  });

  it("shows a recorded answer as the lead's, tagged Recorded, with nothing left to record", () => {
    const recorded: AskView = {
      name: "Christy Johnson",
      status: "practice",
      reply: "yes",
      practice: false,
      recorded: true,
      recordedBy: "Maren Hollis",
      waiting: false,
    };
    const { row } = desk({ demo: false, connected: false }, proposal({ ask: recorded }));
    expect(within(row).getByText("Christy Johnson said yes")).toBeTruthy();
    // QA L1 of PR 287: who recorded it, by name.
    expect(within(row).getByText("Recorded by Maren Hollis")).toBeTruthy();
    expect(within(row).queryByText(ASK_COPY.recordPrompt)).toBeNull();
    expect(within(row).queryByText(ASK_COPY.practiceTag)).toBeNull();
  });

  it("after today's refused texts, the line says the text did not arrive and the answer can still be recorded", () => {
    const refused: AskView = {
      name: "Christy Johnson",
      status: "rejected",
      reply: null,
      practice: false,
      recorded: false,
      waiting: false,
    };
    const { row } = desk({ demo: false, connected: false }, proposal({ ask: refused }));
    expect(within(row).getByText(ASK_COPY.notArrived)).toBeTruthy();
    expect(within(row).getByText(ASK_COPY.recordPrompt)).toBeTruthy();
  });

  it("offers nothing to record before a lead is picked", () => {
    const { row } = desk(
      { demo: false, connected: false },
      proposal({ leadContactId: null, leadName: null }),
    );
    expect(within(row).queryByText(ASK_COPY.recordPrompt)).toBeNull();
  });
});

describe("once texts have started, or in a demo workspace", () => {
  it("a real workspace asks by text again and records nothing by hand", () => {
    const { row } = desk({ demo: false, connected: true });
    expect(within(row).queryByText(ASK_COPY.recordPrompt)).toBeNull();
    expect(
      within(row).getByRole("button", { name: ASK_COPY.open("Christy Johnson") }),
    ).toBeTruthy();
  });

  it("a demo workspace keeps its practice ask and its practice answers", async () => {
    const waiting: AskView = {
      name: "",
      status: "practice",
      reply: null,
      practice: true,
      waiting: true,
    };
    const { practiceReply, recordAnswer, row } = desk(
      { demo: true, connected: false },
      proposal({ ask: waiting }),
    );
    expect(within(row).queryByText(ASK_COPY.recordPrompt)).toBeNull();
    expect(within(row).getByText(ASK_COPY.practiceWaiting)).toBeTruthy();
    fireEvent.click(within(row).getByRole("button", { name: ASK_COPY.practiceYes }));
    await waitFor(() => expect(practiceReply).toHaveBeenCalledWith("p", "yes"));
    expect(recordAnswer).not.toHaveBeenCalled();
  });
});

describe("the strip on a won board", () => {
  it("tags a recorded answer Recorded and names the lead", () => {
    render(
      <BoardWinLines
        win={{
          won: true,
          decidedAt: "2026-11-19T18:00:00Z",
          leadName: "Christy Johnson",
          ask: {
            name: "Christy Johnson",
            status: "practice",
            reply: "yes",
            practice: false,
            recorded: true,
            waiting: false,
          },
        }}
      />,
    );
    const strip = screen.getByTestId("board-win-strip");
    expect(within(strip).getByText("Christy Johnson said yes")).toBeTruthy();
    expect(within(strip).getByText(ASK_COPY.recordedTag)).toBeTruthy();
  });
});

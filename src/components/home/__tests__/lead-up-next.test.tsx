// @vitest-environment jsdom
// 21 Nov 2026, chat pill PR 4b (D-97): Up next for a proposal's Lead on Home and in the chat pill, and the owner's
// "Send Christy the documents" on their row.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LeadUpNextList } from "@/components/home/LeadUpNext";
import { PillUpNext } from "@/components/pill/PillUpNext";
import { SendDocsLine } from "@/components/proposals/SendDocsLine";
import { LEAD_VIEW_COPY, SEND_DOCS_COPY, type LedList, type LedProposal } from "@/lib/lead-view-shared";

afterEach(cleanup);

const NOW = new Date("2026-11-21T12:00:00Z");
const row = (over: Partial<LedProposal> = {}): LedProposal => ({
  id: "p1",
  title: "Care model review",
  clientName: "Larkspur Senior Living",
  ownerName: "Maren Hollis",
  receivedAt: "2026-11-20T12:00:00Z",
  sentAt: null,
  dueOn: "2026-11-28",
  brief: "Larkspur wants a care model review.",
  documents: null,
  documentCount: 2,
  pastWork: [{ boardId: "b1", title: "Larkspur 2025 review" }],
  ...over,
});
const list = (rows: LedProposal[]): LedList => ({ goalHours: 72, proposals: rows });

describe("Up next on Home", () => {
  it("shows the proposal closest to its goal first, with its clock, due date, brief, documents waiting and past work", () => {
    render(
      <LeadUpNextList
        data={list([row({ id: "fresh", clientName: "Pellham", receivedAt: "2026-11-21T11:00:00Z" }), row()])}
        now={NOW}
        onOpen={() => undefined}
      />,
    );
    const items = document.querySelectorAll("[data-led-proposal]");
    expect([...items].map((el) => el.getAttribute("data-led-proposal"))).toEqual(["p1", "fresh"]);
    expect(items[0]!.hasAttribute("data-up-next")).toBe(true);
    expect(screen.getAllByText("48 hours left of 72")).toHaveLength(1);
    expect(screen.getAllByText(LEAD_VIEW_COPY.notSent(2, "Maren Hollis"))).toHaveLength(2);
    expect(screen.getAllByText("Larkspur 2025 review")).toHaveLength(2);
    expect(screen.getAllByText("Larkspur wants a care model review.").length).toBeGreaterThan(0);
  });

  it("sent documents are buttons that open the reader", () => {
    const onOpen = vi.fn();
    render(<LeadUpNextList data={list([row({ documents: [{ id: "d1", title: "Larkspur RFP" }] })])} now={NOW} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: LEAD_VIEW_COPY.open("Larkspur RFP") }));
    expect(onOpen).toHaveBeenCalledWith({ proposalId: "p1", itemId: "d1", title: "Larkspur RFP" });
  });

  it("says plainly when there is no brief, no document and no past work", () => {
    render(<LeadUpNextList data={list([row({ brief: null, documentCount: 0, pastWork: [] })])} now={NOW} onOpen={() => undefined} />);
    expect(screen.getByText(LEAD_VIEW_COPY.noBrief)).toBeTruthy();
    expect(screen.getByText(LEAD_VIEW_COPY.noDocuments)).toBeTruthy();
    expect(screen.getByText(LEAD_VIEW_COPY.noPastWork)).toBeTruthy();
  });
});

describe("Up next in the chat pill", () => {
  it("one line for the proposal closest to its goal, and one press to Home", () => {
    const onOpen = vi.fn();
    render(<PillUpNext data={list([row()])} now={NOW} onOpen={onOpen} />);
    expect(screen.getByText(LEAD_VIEW_COPY.pill("Larkspur Senior Living", "48 hours left of 72"))).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: LEAD_VIEW_COPY.pillOpen }));
    expect(onOpen).toHaveBeenCalled();
  });

  it("nothing for someone who leads nothing, or before it loads", () => {
    const { container } = render(<PillUpNext data={list([])} onOpen={() => undefined} />);
    expect(container.textContent).toBe("");
    cleanup();
    expect(render(<PillUpNext data={undefined} onOpen={() => undefined} />).container.textContent).toBe("");
  });
});

describe("Send the lead the documents", () => {
  it("unsent: one press, saying first what it does", async () => {
    const onSend = vi.fn(async () => ({ ok: true as const }));
    render(<SendDocsLine state="unsent" leadName="Christy Johnson" hasDocs onSend={onSend} />);
    expect(screen.getByText(SEND_DOCS_COPY.what("Christy"))).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: SEND_DOCS_COPY.send("Christy") }));
    await waitFor(() => expect(onSend).toHaveBeenCalledWith(true));
  });

  it("sent: says so, with Stop sharing", async () => {
    const onSend = vi.fn(async () => ({ ok: true as const }));
    render(<SendDocsLine state="sent" leadName="Christy Johnson" hasDocs onSend={onSend} />);
    expect(screen.getByText(SEND_DOCS_COPY.sent("Christy"))).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: SEND_DOCS_COPY.stop }));
    await waitFor(() => expect(onSend).toHaveBeenCalledWith(false));
  });

  it("a refusal and a thrown call each leave a plain line", async () => {
    render(<SendDocsLine state="unsent" leadName="Christy" hasDocs onSend={async () => ({ ok: false, problem: SEND_DOCS_COPY.notReady })} />);
    fireEvent.click(screen.getByRole("button"));
    expect(await screen.findByText(SEND_DOCS_COPY.notReady)).toBeTruthy();
    cleanup();
    render(<SendDocsLine state="unsent" leadName="Christy" hasDocs onSend={() => Promise.reject(new Error("x"))} />);
    fireEvent.click(screen.getByRole("button"));
    expect(await screen.findByText(SEND_DOCS_COPY.failed)).toBeTruthy();
  });

  it("a double click sends once", async () => {
    let finish: () => void = () => undefined;
    const onSend = vi.fn(() => new Promise<{ ok: true }>((resolve) => (finish = () => resolve({ ok: true }))));
    render(<SendDocsLine state="unsent" leadName="Christy" hasDocs onSend={onSend} />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onSend).toHaveBeenCalledTimes(1);
    finish();
  });

  it("a lead with no login is told why; with no documents there is nothing to send", () => {
    render(<SendDocsLine state="no_login" leadName="Ben Stanton" hasDocs onSend={async () => ({ ok: true })} />);
    expect(screen.getByText(SEND_DOCS_COPY.noLogin("Ben"))).toBeTruthy();
    cleanup();
    expect(render(<SendDocsLine state="unsent" leadName="Christy" hasDocs={false} onSend={async () => ({ ok: true })} />).container.textContent).toBe("");
  });
});

// @vitest-environment jsdom
// 21 Nov 2026, chat pill Phase 5 (D-97): the approval loop on screen: the Lead's line, the admin's review, the
// admin's pill line and admin Home's "what changed".
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/home/LeadDocumentDialog", () => ({ LeadDocumentDialog: () => null }));

import { LeadApprovalLine } from "@/components/home/LeadApprovalLine";
import { PillApprovals, PILL_APPROVAL_COPY } from "@/components/pill/PillApprovals";
import { ApprovalReview } from "@/components/proposals/ApprovalReview";
import { buildAdminFeed } from "@/lib/admin-home-shared";
import { APPROVAL_COPY, type ApprovalView } from "@/lib/proposal-approval-shared";
import type { DeskList, DeskProposal } from "@/lib/proposal-desk-shared";

afterEach(cleanup);

const approval = (over: Partial<ApprovalView> = {}): ApprovalView => ({ id: "a1", state: "waiting", requestedBy: "Christy Johnson", requestedAt: "2026-11-21T10:00:00Z", decidedBy: null, decidedAt: null, note: null, finalItemId: "i1", finalTitle: "Final v3", stale: false, ...over });
const desk = (approvalView?: ApprovalView): DeskList => ({
  goalHours: 72, canSetGoal: true, canPickLead: true, canAddClient: true, clientsOff: false, texts: { demo: true, connected: false },
  proposals: [{ id: "p1", title: "Care model review", clientName: "Larkspur", ownerName: "Maren", mine: false, status: "open", receivedAt: "2026-11-20T12:00:00Z", sentAt: null, decidedAt: null, engagementId: null, contextCount: 1, canAct: true, canClose: true, canArchive: true, leadContactId: "c1", leadName: "Christy Johnson", ...(approvalView ? { approval: approvalView } : {}) } as DeskProposal],
});

describe("the Lead's line", () => {
  it("ready: Send for approval sends", async () => {
    const onAsk = vi.fn(async () => ({ ok: true as const }));
    render(<LeadApprovalLine stage="ready_to_send" approval={null} onAsk={onAsk} />);
    fireEvent.click(screen.getByRole("button", { name: APPROVAL_COPY.send }));
    await waitFor(() => expect(onAsk).toHaveBeenCalledWith(false));
  });
  it("waiting: says so, and Take it back withdraws", async () => {
    const onAsk = vi.fn(async () => ({ ok: true as const }));
    render(<LeadApprovalLine stage="awaiting_approval" approval={approval()} onAsk={onAsk} />);
    expect(screen.getByText(APPROVAL_COPY.waitingLead)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: APPROVAL_COPY.withdraw }));
    await waitFor(() => expect(onAsk).toHaveBeenCalledWith(true));
  });
  it("changes asked: the note, and Send for approval again", () => {
    render(<LeadApprovalLine stage="changes_asked" approval={approval({ state: "changes_asked", decidedBy: "Maren Hollis", note: "Tighten the scope" })} onAsk={async () => ({ ok: true })} />);
    expect(screen.getByText(APPROVAL_COPY.changesAsked("Maren Hollis", "Tighten the scope"))).toBeTruthy();
    expect(screen.getByRole("button", { name: APPROVAL_COPY.send })).toBeTruthy();
  });
  it("approved: waiting on the client; a refusal is said plainly", async () => {
    render(<LeadApprovalLine stage="client_review" approval={approval({ state: "approved" })} onAsk={async () => ({ ok: true })} />);
    expect(screen.getByText(APPROVAL_COPY.approvedLead)).toBeTruthy();
    cleanup();
    render(<LeadApprovalLine stage="ready_to_send" approval={null} onAsk={async () => ({ ok: false, problem: APPROVAL_COPY.notReady })} />);
    fireEvent.click(screen.getByRole("button", { name: APPROVAL_COPY.send }));
    expect(await screen.findByText(APPROVAL_COPY.notReady)).toBeTruthy();
  });
});

describe("the admin's review", () => {
  const tools = () => ({ decide: vi.fn(async () => ({ ok: true as const })), readFinal: vi.fn(async () => ({ ok: true as const, title: "Final v3", text: "words" })) });
  it("approve: says it waits on the client and that the text comes once texts are approved", async () => {
    const t = tools();
    render(<ApprovalReview approval={approval()} leadName="Christy Johnson" proposalId="p1" decide={t.decide} readFinal={t.readFinal} />);
    expect(screen.getByText(APPROVAL_COPY.request("Christy Johnson", "Final v3"))).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: APPROVAL_COPY.approve }));
    await waitFor(() => expect(t.decide).toHaveBeenCalledWith("approved", null));
    expect(await screen.findByText(APPROVAL_COPY.textLater("Christy Johnson"))).toBeTruthy();
  });
  it("ask for changes sends the note", async () => {
    const t = tools();
    render(<ApprovalReview approval={approval()} leadName="Christy Johnson" proposalId="p1" decide={t.decide} readFinal={t.readFinal} />);
    fireEvent.click(screen.getByRole("button", { name: APPROVAL_COPY.askChanges }));
    fireEvent.change(screen.getByLabelText(APPROVAL_COPY.note), { target: { value: "Tighten the scope" } });
    fireEvent.click(screen.getByRole("button", { name: APPROVAL_COPY.sendNote }));
    await waitFor(() => expect(t.decide).toHaveBeenCalledWith("changes_asked", "Tighten the scope"));
  });
  it("a stale request cannot be approved here and says why; a refusal from the server shows", async () => {
    const t = tools();
    render(<ApprovalReview approval={approval({ stale: true })} leadName="Christy Johnson" proposalId="p1" decide={t.decide} readFinal={t.readFinal} />);
    expect(screen.getByText(APPROVAL_COPY.stale("Christy Johnson"))).toBeTruthy();
    expect((screen.getByRole("button", { name: APPROVAL_COPY.approve }) as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    render(<ApprovalReview approval={approval()} leadName="Christy" proposalId="p1" decide={async () => ({ ok: false, problem: APPROVAL_COPY.ownRequest })} readFinal={t.readFinal} />);
    fireEvent.click(screen.getByRole("button", { name: APPROVAL_COPY.approve }));
    expect(await screen.findByText(APPROVAL_COPY.ownRequest)).toBeTruthy();
  });
});

describe("the admin's pill and Home", () => {
  it("the pill names a waiting request and opens its row; nothing when none waits or for a non-admin", () => {
    const onOpen = vi.fn();
    render(<PillApprovals desk={desk(approval())} onOpen={onOpen} />);
    expect(screen.getByText(PILL_APPROVAL_COPY.one("Christy Johnson", "Larkspur"), { exact: false })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: PILL_APPROVAL_COPY.open }));
    expect(onOpen).toHaveBeenCalledWith("p1");
    cleanup();
    expect(render(<PillApprovals desk={desk()} onOpen={onOpen} />).container.textContent).toBe("");
    cleanup();
    expect(render(<PillApprovals desk={{ ...desk(approval()), canSetGoal: false }} onOpen={onOpen} />).container.textContent).toBe("");
  });
  it("admin Home puts the request first under what waits on you", () => {
    const feed = buildAdminFeed({ desk: desk(approval()), roster: [], notifications: [], now: new Date("2026-11-21T12:00:00Z") });
    expect(feed.waiting[0]).toMatchObject({ id: "approval:p1", kind: "approval", title: "Christy Johnson sent the final for approval", detail: "Larkspur: Care model review" });
  });
});

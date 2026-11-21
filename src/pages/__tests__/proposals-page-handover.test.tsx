// @vitest-environment jsdom
// 21 Nov 2026: the real ProposalsPage hand-over from New proposal to the lead sheet, with stubbed server calls. Since
// the click path cards (21 Nov), both live in one step card.
// Started as QA's scratch case for #275 (M1: a failed re-read after Start proposal).
import { within, act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SHEET_COPY } from "@/lib/lead-ask-shared";
import { PROPOSAL_CARD_COPY } from "@/lib/pill-proposal-shared";
import { afterCreate, DESK_COPY, LEAD_COPY, type DeskList, type DeskProposal } from "@/lib/proposal-desk-shared";
import { FLOW_COPY } from "@/lib/proposal-flow-shared";
import { STEP_CARD_COPY } from "@/lib/step-card-shared";

const h = vi.hoisted(() => ({
  role: "admin" as string,
  rows: [] as unknown[],
  listFails: false,
  listCalls: 0,
  createCalls: 0,
  setLead: vi.fn(),
  askLead: vi.fn(),
  rosterAllowed: true,
  createDelay: 0,
  refuse: "" as string,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
  useNavigate: () => vi.fn(),
}));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ data: { id: "22222222-2222-4222-8222-222222222222", role: h.role, org_name: "QA Firm", is_guest: false } }),
}));
vi.mock("@/lib/workspace-capabilities", () => ({ profileHasFirmView: () => true }));
vi.mock("@/components/work/use-capture-files", () => ({ useCaptureFiles: () => ({ captureWithResult: vi.fn(async () => ({ ids: [], failures: [] })) }) }));
vi.mock("@/components/skin/use-skin", async (orig) => ({ ...(await orig<object>()), useBrandCopy: () => (t: string) => t }));
vi.mock("@/components/roster/RosterPanel", () => ({ RosterPanel: () => null }));
vi.mock("@/components/proposals/DemoTextNumberCard", () => ({ DemoTextNumberCard: () => null }));
vi.mock("@/lib/brief-read.functions", () => ({ readBriefFn: vi.fn(), briefAdminsFn: vi.fn(async () => ({ name: null, count: 1 })), passBriefFn: vi.fn() }));
vi.mock("@/lib/lead-view.functions", () => ({ sendLeadDocsFn: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/lib/work-remove.functions", () => ({ deleteWorkItem: vi.fn(async () => undefined) }));
vi.mock("@/lib/lead-ask.functions", () => ({
  askLeadFn: (...a: unknown[]) => h.askLead(...a),
  askPreviewFn: vi.fn(async () => ({ ok: true, words: "Lasso for QA Firm: lead it? Reply STOP to opt out.", name: "Christy Johnson", mode: "practice", warning: null })),
  practiceReplyFn: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/roster.functions", () => ({
  listRosterFn: vi.fn(async () =>
    h.rosterAllowed
      ? { allowed: true, contacts: [{ id: "c1", name: "Christy Johnson", role: null, affiliation: "independent", firm: null, texts: "agreed", agreedOn: "2026-11-19", stoppedOn: null, confirmed: false, changeUntil: null, phoneMasked: null, email: null, linkedin: null, needsDetails: false, numberDiffers: false, invitedOn: null, linkPath: "/texts" }] }
      : { allowed: false },
  ),
}));
vi.mock("@/lib/proposal-desk.functions", () => ({
  listProposalsFn: vi.fn(async (): Promise<DeskList> => {
    h.listCalls += 1;
    if (h.listFails) throw new Error("read failed");
    const pickers = h.role === "admin" || h.role === "lead";
    return { goalHours: 72, canSetGoal: h.role === "admin", canPickLead: pickers, canAddClient: true, texts: { demo: true, connected: false }, proposals: h.rows as DeskProposal[] };
  }),
  createProposalFn: vi.fn(async ({ data }: { data: { title: string } }) => {
    if (h.refuse) return { ok: false, problem: h.refuse };
    h.createCalls += 1;
    if (h.createDelay) await new Promise((r) => setTimeout(r, h.createDelay));
    const id = `p${h.createCalls}`;
    h.rows = [{ id, title: data.title, clientName: "Marrowfield", ownerName: "QA", mine: true, status: "open", receivedAt: new Date().toISOString(), sentAt: null, decidedAt: null, engagementId: null, contextCount: 0, canAct: true, canClose: true, canArchive: true, leadContactId: null, leadName: null, ask: null }, ...h.rows];
    return { ok: true, id };
  }),
  listProposalClientsFn: vi.fn(async () => [{ id: "44444444-4444-4444-8444-444444444444", name: "Marrowfield" }]),
  setProposalLeadFn: (...a: unknown[]) => h.setLead(...a),
  setProposalSentFn: vi.fn(),
  closeProposalFn: vi.fn(),
  winProposalFn: vi.fn(),
}));

import { ProposalsPage } from "@/pages/ProposalsPage";

beforeEach(() => {
  Object.assign(h, { role: "admin", rows: [], listFails: false, listCalls: 0, createCalls: 0, rosterAllowed: true, createDelay: 0, refuse: "" });
  h.setLead.mockReset().mockResolvedValue({ ok: true });
  h.askLead.mockReset();
});
afterEach(() => cleanup());

async function page() {
  const client = new QueryClient();
  render(<QueryClientProvider client={client}><ProposalsPage /></QueryClientProvider>);
  await waitFor(() => expect(h.listCalls).toBeGreaterThan(0));
  await screen.findByTestId("proposals-page");
  return client;
}
async function start(title = "QA network redesign") {
  fireEvent.click(screen.getByRole("button", { name: /new proposal/i }));
  const card = await screen.findByTestId("proposal-flow");
  const client = within(card).getByLabelText(PROPOSAL_CARD_COPY.client) as HTMLInputElement;
  // Lock until loaded: the fields open once the card has read the clients.
  await waitFor(() => expect(client.disabled).toBe(false));
  fireEvent.change(client, { target: { value: "Marrowfield" } });
  fireEvent.change(within(card).getByLabelText(FLOW_COPY.start.askLabel), { target: { value: title } });
  return card;
}
// The step showing now, not the one sliding out.
const marker = () => screen.getByTestId("proposal-flow").querySelector(".step-card__pane:not([data-leaving]) [data-step-marker]");
const primary = (name: string | RegExp) => within(screen.getByTestId("proposal-flow")).getByRole("button", { name });

// 21 Nov 2026, click path cards: New proposal opens the proposal step card. Start, then the lead sheet inside the same
// card, then the last word; nothing opens the chat.
describe("the Proposals page: New proposal on the step card", () => {
  it("admin: Start becomes Pick the lead in the same card; Pick later leaves no lead, sends nothing", async () => {
    await page();
    await start();
    expect(marker()?.textContent).toBe(STEP_CARD_COPY.stepOf(1, 3));
    fireEvent.click(primary(FLOW_COPY.start.next));
    const sheet = await screen.findByTestId("pick-lead");
    expect(screen.getByTestId("proposal-flow").contains(sheet)).toBe(true);
    expect(marker()?.textContent).toBe(STEP_CARD_COPY.stepOf(2, 3));
    fireEvent.click(within(sheet).getByRole("button", { name: SHEET_COPY.pickLater }));
    expect(await screen.findByText(FLOW_COPY.done.title("Marrowfield"))).toBeTruthy();
    expect(h.setLead).not.toHaveBeenCalled();
    expect(h.askLead).not.toHaveBeenCalled();
    expect(h.createCalls).toBe(1);
    fireEvent.click(primary(FLOW_COPY.done.close));
    await waitFor(() => expect(screen.queryByTestId("proposal-flow")).toBeNull());
    expect(screen.getByText("QA network redesign")).toBeTruthy();
  });

  it("lead role behaves as admin", async () => {
    h.role = "lead";
    await page();
    await start();
    fireEvent.click(primary(FLOW_COPY.start.next));
    expect(await screen.findByTestId("pick-lead")).toBeTruthy();
  });

  it("manager (em) and analyst start it and land on the last word, with no lead step", async () => {
    for (const role of ["em", "analyst"]) {
      h.role = role; h.rows = []; h.createCalls = 0;
      await page();
      await start();
      expect(marker()).toBeNull();
      fireEvent.click(primary(FLOW_COPY.start.start));
      expect(await screen.findByText(FLOW_COPY.done.title("Marrowfield"))).toBeTruthy();
      expect(screen.queryByTestId("pick-lead")).toBeNull();
      expect(h.createCalls).toBe(1);
      cleanup();
    }
  });

  it("closing by mistake keeps what was typed, on the same step", async () => {
    await page();
    await start("Kept words");
    fireEvent.keyDown(screen.getByTestId("proposal-flow"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("proposal-flow")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: /new proposal/i }));
    const card = await screen.findByTestId("proposal-flow");
    expect((within(card).getByLabelText(FLOW_COPY.start.askLabel) as HTMLInputElement).value).toBe("Kept words");
    expect((within(card).getByLabelText(PROPOSAL_CARD_COPY.client) as HTMLInputElement).value).toBe("Marrowfield");
    expect(h.createCalls).toBe(0);
  });

  it("double press on Next makes one proposal, and the card cannot be closed while it starts", async () => {
    h.createDelay = 200;
    await page();
    await start();
    const button = primary(FLOW_COPY.start.next);
    fireEvent.click(button); fireEvent.click(button);
    fireEvent.keyDown(screen.getByTestId("proposal-flow"), { key: "Escape" });
    expect(screen.getByTestId("proposal-flow")).toBeTruthy();
    await screen.findByTestId("pick-lead");
    expect(h.createCalls).toBe(1);
  });

  it("a failed lead save keeps the sheet open in the card, says so, proposal kept", async () => {
    h.setLead.mockResolvedValue({ ok: false, problem: "That could not be saved. Try again." });
    await page();
    await start();
    fireEvent.click(primary(FLOW_COPY.start.next));
    const sheet = await screen.findByTestId("pick-lead");
    fireEvent.click(await within(sheet).findByText("Christy Johnson"));
    fireEvent.click(screen.getByRole("button", { name: LEAD_COPY.save }));
    await waitFor(() => expect(h.setLead).toHaveBeenCalled());
    expect(await screen.findByText(/could not be saved/)).toBeTruthy();
    expect(screen.getByTestId("pick-lead")).toBeTruthy();
    expect(h.askLead).not.toHaveBeenCalled();
  });

  it("a refused start keeps the card on Start with the server's plain line, and nothing moves on", async () => {
    await page();
    await start();
    fireEvent.change(within(screen.getByTestId("proposal-flow")).getByLabelText(PROPOSAL_CARD_COPY.client), { target: { value: "A brand new client" } });
    h.refuse = "An admin adds new clients. Choose an existing client, or ask an admin to add this one first.";
    fireEvent.click(primary(FLOW_COPY.start.next));
    expect(await screen.findByText(h.refuse)).toBeTruthy();
    expect(screen.queryByTestId("pick-lead")).toBeNull();
    expect(h.createCalls).toBe(0);
  });

  it("QA M1: a failed re-read says the proposal was started, and the row shows once the list reads again", async () => {
    const client = await page();
    await start();
    h.listFails = true;
    fireEvent.click(primary(FLOW_COPY.start.next));
    // The lead sheet cannot read the list, so the card goes straight to its last word.
    expect(await screen.findByText(FLOW_COPY.done.title("Marrowfield"), undefined, { timeout: 3000 })).toBeTruthy();
    fireEvent.click(primary(FLOW_COPY.done.close));
    await waitFor(() => expect(screen.queryByTestId("proposal-flow")).toBeNull());
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain(DESK_COPY.startedNotRefreshed);
    expect(alert.textContent).not.toContain(DESK_COPY.loadFailed);
    expect(h.createCalls).toBe(1);
    h.listFails = false;
    await act(async () => { await client.invalidateQueries({ queryKey: ["proposal-desk"] }); });
    await screen.findByText("QA network redesign");
    expect(screen.queryByRole("alert")).toBeNull();
    // The next New proposal starts fresh, once the finished card has played its way out.
    await act(async () => { await new Promise((r) => setTimeout(r, 600)); });
    fireEvent.click(screen.getByRole("button", { name: /new proposal/i }));
    const again = await screen.findByTestId("proposal-flow");
    expect((within(again).getByLabelText(FLOW_COPY.start.askLabel) as HTMLInputElement).value).toBe("");
  });

  it("people list refused (roster allowed false): the card goes on to its last word with no sheet", async () => {
    h.rosterAllowed = false;
    await page();
    await start();
    fireEvent.click(primary(FLOW_COPY.start.next));
    expect(await screen.findByText(FLOW_COPY.done.title("Marrowfield"))).toBeTruthy();
    expect(screen.queryByTestId("pick-lead")).toBeNull();
  });
});

describe("afterCreate", () => {
  const list = (proposals: Partial<DeskProposal>[]): DeskList => ({ goalHours: 72, canSetGoal: false, canPickLead: true, canAddClient: true, texts: { demo: false, connected: false }, proposals: proposals as DeskProposal[] });
  it("opens the sheet only when the new open proposal is in the list and the person may pick", () => {
    expect(afterCreate(list([{ id: "n", status: "open" }]), "n", true)).toBe("sheet");
    expect(afterCreate(list([{ id: "n", status: "open" }]), "n", false)).toBe("rows");
  });
  it("says it was started when the list is missing, failed, or has not caught up", () => {
    expect(afterCreate(undefined, "n", true)).toBe("notRefreshed");
    expect(afterCreate(list([{ id: "old", status: "open" }]), "n", true)).toBe("notRefreshed");
    expect(afterCreate(list([{ id: "n", status: "won" }]), "n", true)).toBe("notRefreshed");
  });
});

describe("21 Nov (D-82): links from an admin's Home", () => {
  const ID = "55555555-5555-4555-8555-555555555555";
  const open = { id: ID, title: "Network redesign", clientName: "Pellham", ownerName: "QA", mine: false, status: "open", receivedAt: new Date().toISOString(), sentAt: null, decidedAt: null, engagementId: null, contextCount: 0, canAct: true, canClose: true, canArchive: true, leadContactId: null, leadName: null, ask: null };
  const at = (search: string) => window.history.replaceState(null, "", `/proposals${search}`);
  afterEach(() => at(""));

  it("opens the lead sheet on the linked proposal, without saying it was just started", async () => {
    h.rows = [open];
    at(`?lead=${ID}`);
    await page();
    const sheet = await screen.findByTestId("pick-lead");
    expect(sheet.hasAttribute("data-lead-fresh")).toBe(false);
    expect(sheet.textContent).not.toContain(SHEET_COPY.started);
    fireEvent.click(within(sheet).getByRole("button", { name: LEAD_COPY.cancel }));
    await waitFor(() => expect(screen.queryByTestId("pick-lead")).toBeNull());
    expect(h.setLead).not.toHaveBeenCalled();
  });

  it("opens no sheet for a member, or for a proposal that is not open", async () => {
    h.rows = [{ ...open, status: "won", decidedAt: new Date().toISOString() }];
    at(`?lead=${ID}`);
    await page();
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    expect(screen.queryByTestId("pick-lead")).toBeNull();
    cleanup();
    h.role = "analyst";
    h.rows = [open];
    await page();
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    expect(screen.queryByTestId("pick-lead")).toBeNull();
  });

  it("opens on the People tab for an admin, and on Proposals for anyone who has no People tab", async () => {
    at("?tab=people");
    await page();
    expect(screen.getByRole("tab", { name: DESK_COPY.tabs.people }).getAttribute("aria-selected")).toBe("true");
    cleanup();
    h.role = "analyst";
    await page();
    expect(screen.queryByRole("tab", { name: DESK_COPY.tabs.people })).toBeNull();
    expect(screen.getByRole("tab", { name: DESK_COPY.tabs.proposals }).getAttribute("aria-selected")).toBe("true");
  });

  it("brings the linked proposal into view and marks it for a moment", async () => {
    h.rows = [open];
    at(`?proposal=${ID}`);
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    await page();
    await waitFor(() => expect(document.querySelector(`[data-proposal-row="${ID}"]`)?.getAttribute("data-linked")).toBe("true"));
    expect(scrolled).toHaveBeenCalledTimes(1);
  });
});

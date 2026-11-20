// @vitest-environment jsdom
// 21 Nov 2026: the real ProposalsPage hand-over from New proposal to the lead sheet, with stubbed server calls.
// Started as QA's scratch case for #275 (M1: a failed re-read after Start proposal).
import { within, act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SHEET_COPY } from "@/lib/lead-ask-shared";
import { afterCreate, DESK_COPY, INTAKE_COPY, LEAD_COPY, type DeskList, type DeskProposal } from "@/lib/proposal-desk-shared";

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
  Object.assign(h, { role: "admin", rows: [], listFails: false, listCalls: 0, createCalls: 0, rosterAllowed: true, createDelay: 0 });
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
async function start() {
  fireEvent.click(screen.getByRole("button", { name: /new proposal/i }));
  const pick = await screen.findByLabelText(INTAKE_COPY.pickClient);
  await waitFor(() => expect((pick as HTMLSelectElement).options.length).toBeGreaterThan(1));
  fireEvent.change(pick, { target: { value: "44444444-4444-4444-8444-444444444444" } });
  fireEvent.change(screen.getByLabelText(INTAKE_COPY.titleLabel), { target: { value: "QA network redesign" } });
}

describe("the Proposals page: from New proposal to picking the lead", () => {
  it("admin: form becomes the fresh sheet; Pick later leaves no lead, sends nothing", async () => {
    await page();
    await start();
    fireEvent.click(screen.getByRole("button", { name: INTAKE_COPY.create }));
    const sheet = await screen.findByTestId("pick-lead");
    expect(sheet.hasAttribute("data-lead-fresh")).toBe(true);
    expect(screen.queryByTestId("new-proposal")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: SHEET_COPY.pickLater }));
    await waitFor(() => expect(screen.queryByTestId("pick-lead")).toBeNull());
    expect(h.setLead).not.toHaveBeenCalled();
    expect(h.askLead).not.toHaveBeenCalled();
    expect(h.createCalls).toBe(1);
  });

  it("lead role behaves as admin", async () => {
    h.role = "lead";
    await page();
    await start();
    fireEvent.click(screen.getByRole("button", { name: INTAKE_COPY.create }));
    expect((await screen.findByTestId("pick-lead")).hasAttribute("data-lead-fresh")).toBe(true);
  });

  it("manager (em) and analyst land on the rows", async () => {
    for (const role of ["em", "analyst"]) {
      h.role = role; h.rows = []; h.createCalls = 0;
      await page();
      await start();
      fireEvent.click(screen.getByRole("button", { name: INTAKE_COPY.create }));
      await waitFor(() => expect(screen.queryByTestId("new-proposal")).toBeNull());
      expect(screen.queryByTestId("pick-lead")).toBeNull();
      expect(screen.getByText("QA network redesign")).toBeTruthy();
      cleanup();
    }
  });

  it("double press on Start proposal makes one proposal", async () => {
    h.createDelay = 200;
    await page();
    await start();
    const button = screen.getByRole("button", { name: INTAKE_COPY.create });
    fireEvent.click(button); fireEvent.click(button);
    fireEvent.submit(button.closest("form") as HTMLFormElement);
    await screen.findByTestId("pick-lead");
    expect(h.createCalls).toBe(1);
  });

  it("a failed lead save keeps the sheet open, says so, proposal kept", async () => {
    h.setLead.mockResolvedValue({ ok: false, problem: "That could not be saved. Try again." });
    await page();
    await start();
    fireEvent.click(screen.getByRole("button", { name: INTAKE_COPY.create }));
    const sheet = await screen.findByTestId("pick-lead");
    fireEvent.click(await within(sheet).findByText("Christy Johnson"));
    fireEvent.click(screen.getByRole("button", { name: LEAD_COPY.save }));
    await waitFor(() => expect(h.setLead).toHaveBeenCalled());
    expect(await screen.findByText(/could not be saved/)).toBeTruthy();
    expect(screen.getByTestId("pick-lead")).toBeTruthy();
    expect(h.askLead).not.toHaveBeenCalled();
  });

  it("QA M1: a failed re-read says the proposal was started, opens nothing later, and a second press is warned", async () => {
    const client = await page();
    await start();
    h.listFails = true;
    fireEvent.click(screen.getByRole("button", { name: INTAKE_COPY.create }));
    await waitFor(() => expect(screen.queryByTestId("new-proposal")).toBeNull(), { timeout: 3000 });
    // Says plainly that it was started, not that the list failed.
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain(DESK_COPY.startedNotRefreshed);
    expect(alert.textContent).not.toContain(DESK_COPY.loadFailed);
    expect(screen.queryByTestId("pick-lead")).toBeNull();
    expect(h.createCalls).toBe(1);
    // A second press on New proposal says the first one is saved, so a duplicate is never silent.
    fireEvent.click(screen.getByRole("button", { name: /new proposal/i }));
    const form = await screen.findByTestId("new-proposal");
    expect(within(form).getByRole("status").textContent).toBe(INTAKE_COPY.justStarted("QA network redesign"));
    fireEvent.keyDown(form, { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("new-proposal")).toBeNull());
    // The list recovers later (Try again, or coming back to the tab): the row shows, the line goes, no sheet pops up.
    h.listFails = false;
    await act(async () => { await client.invalidateQueries({ queryKey: ["proposal-desk"] }); });
    await screen.findByText("QA network redesign");
    expect(screen.queryByTestId("pick-lead")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    // And the form no longer warns.
    fireEvent.click(screen.getByRole("button", { name: /new proposal/i }));
    const again = await screen.findByTestId("new-proposal");
    expect(again.querySelector("[data-new-proposal-recent]")).toBeNull();
  });

  it("QA M1: Try again on the started line reads the list again and shows the row, with no sheet", async () => {
    await page();
    await start();
    h.listFails = true;
    fireEvent.click(screen.getByRole("button", { name: INTAKE_COPY.create }));
    const alert = await screen.findByRole("alert");
    h.listFails = false;
    fireEvent.click(within(alert).getByRole("button", { name: DESK_COPY.retry }));
    await screen.findByText("QA network redesign");
    expect(screen.queryByTestId("pick-lead")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("people list refused (roster allowed false): admin lands on rows", async () => {
    h.rosterAllowed = false;
    await page();
    await start();
    fireEvent.click(screen.getByRole("button", { name: INTAKE_COPY.create }));
    await waitFor(() => expect(screen.queryByTestId("new-proposal")).toBeNull());
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

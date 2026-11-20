// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NewProposalDialog } from "@/components/proposals/NewProposalDialog";
import { AskDialog } from "@/components/proposals/AskLead";
import { BoardWinLines } from "@/components/proposals/BoardWinStrip";
import { ProposalDesk } from "@/components/proposals/ProposalDesk";
import { ASK_COPY, type AskView } from "@/lib/lead-ask-shared";
import { ProposalGoalForm } from "@/components/settings/ProposalGoalCard";
import { BOARD_WIN_COPY, CLOSE_COPY, DESK_COPY, GOAL_COPY, INTAKE_COPY, LEAD_COPY, SENT_COPY, WIN_COPY, type DeskList, type DeskProposal } from "@/lib/proposal-desk-shared";
import { ROSTER_COPY, type RosterContact } from "@/lib/roster-shared";
import { MESSAGE_EXAMPLES_COPY } from "@/lib/won-text-shared";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, params }: { children: ReactNode; params?: { id?: string } }) => <a href={`/engagements/${params?.id}/canvas-lab`}>{children}</a>,
}));

afterEach(cleanup);

const NOW = new Date("2026-11-20T12:00:00Z");
const hoursAgo = (n: number) => new Date(NOW.getTime() - n * 3_600_000).toISOString();
const proposal = (over: Partial<DeskProposal>): DeskProposal => ({
  id: "p", title: "Network redesign", clientName: "Marrowfield", ownerName: "Maren Hollis", mine: false, status: "open",
  receivedAt: hoursAgo(10), sentAt: null, decidedAt: null, engagementId: null, contextCount: 0, canAct: false, canClose: false, canArchive: false, ...over,
});
const list = (proposals: DeskProposal[], goalHours = 72): DeskList => ({ goalHours, canSetGoal: false, canPickLead: false, canAddClient: true, texts: { demo: false, connected: false }, proposals });

describe("the Proposals dashboard", () => {
  it("shows open proposals with the time left against the workspace's own goal", () => {
    render(<ProposalDesk now={NOW} data={list([proposal({ id: "a", mine: true, contextCount: 2, contextTitles: ["Call notes", "RFP.pdf"] }), proposal({ id: "b", receivedAt: hoursAgo(30), contextCount: 1 })], 24)} />);
    const mine = document.querySelector('[data-proposal-row="a"]') as HTMLElement;
    expect(within(mine).getByText("14 hours left of 24")).toBeTruthy();
    expect(within(mine).getByText("Yours")).toBeTruthy();
    expect(within(mine).getByText("2 documents")).toBeTruthy();
    expect(within(mine).getByText("Call notes")).toBeTruthy();
    // Said once above the list, not on every row.
    expect(screen.getAllByText(DESK_COPY.noBoardYet)).toHaveLength(1);
    const theirs = document.querySelector('[data-proposal-row="b"]') as HTMLElement;
    expect(within(theirs).getByText("Over the 24 hour goal by 6 hours")).toBeTruthy();
    expect(within(theirs).getByText("Started by Maren Hollis")).toBeTruthy();
    expect(within(theirs).getByText("1 document")).toBeTruthy();
    expect(theirs.querySelector("[data-proposal-context-titles]")).toBeNull();
    expect(document.body.textContent).not.toContain("72");
  });

  it("switches between All open, Needs me and Won, each with its count", () => {
    render(<ProposalDesk now={NOW} data={list([proposal({ id: "a" }), proposal({ id: "b", mine: true }), proposal({ id: "w", mine: true, status: "won", decidedAt: "2026-11-20T09:00:00Z", engagementId: "board-1" })])} />);
    expect(screen.getByRole("button", { name: "All open 2" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Needs me 1" }));
    expect(document.querySelectorAll("[data-proposal-row]")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Won 1" }));
    expect(screen.getByText("Won Fri 20 Nov")).toBeTruthy();
    expect(screen.getByRole("link", { name: DESK_COPY.openBoard }).getAttribute("href")).toBe("/engagements/board-1/canvas-lab");
  });

  it("says so plainly when a view is empty", () => {
    render(<ProposalDesk now={NOW} data={list([])} />);
    expect(screen.getByText(DESK_COPY.empty.open)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Needs me 0" }));
    expect(screen.getByText(DESK_COPY.empty.mine)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Won 0" }));
    expect(screen.getByText(DESK_COPY.empty.won)).toBeTruthy();
  });

  it("draws a title with markup in it as plain text", () => {
    render(<ProposalDesk now={NOW} data={list([proposal({ title: '<img src=x onerror="alert(1)">' })])} />);
    expect(document.querySelector("img")).toBeNull();
  });
});

const CLIENTS = [{ id: "44444444-4444-4444-8444-444444444444", name: "Marrowfield" }];
const PROFILE = "22222222-2222-4222-8222-222222222222";
const ITEM = "55555555-5555-4555-8555-555555555555";

function openDialog(over: Partial<Parameters<typeof NewProposalDialog>[0]> = {}) {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    clients: CLIENTS,
    clientsLoading: false,
    profileId: PROFILE,
    capture: vi.fn(async (files: File[]) => ({ ids: files.map(() => ITEM), failures: [] })),
    create: vi.fn(async () => ({ ok: true as const, id: "new" })),
    onCreated: vi.fn(),
    ...over,
  };
  render(<NewProposalDialog {...props} />);
  return props;
}
const file = (name: string) => new File(["x"], name, { type: "text/plain" });

describe("Mark as sent", () => {
  it("offers it only where the person may act, and only when the page can save it", () => {
    const rows = [proposal({ id: "a", canAct: true }), proposal({ id: "b" }), proposal({ id: "c", canAct: true, sentAt: hoursAgo(1) })];
    const { unmount } = render(<ProposalDesk now={NOW} data={list(rows)} onSent={async () => ({ ok: true })} />);
    expect(within(document.querySelector('[data-proposal-row="a"]') as HTMLElement).getByRole("button", { name: SENT_COPY.mark })).toBeTruthy();
    expect(within(document.querySelector('[data-proposal-row="b"]') as HTMLElement).queryByRole("button")).toBeNull();
    expect(within(document.querySelector('[data-proposal-row="c"]') as HTMLElement).getByRole("button", { name: SENT_COPY.undo })).toBeTruthy();
    unmount();
    render(<ProposalDesk now={NOW} data={list(rows)} />);
    expect(screen.queryByRole("button", { name: SENT_COPY.mark })).toBeNull();
  });

  it("saves once on a double press, and shows a refusal or a failure on the row", async () => {
    let finish: (value: { ok: false; problem: string }) => void = () => {};
    const onSent = vi.fn(() => new Promise<{ ok: false; problem: string }>((resolve) => { finish = resolve; }));
    render(<ProposalDesk now={NOW} data={list([proposal({ id: "a", canAct: true })])} onSent={onSent} />);
    const button = screen.getByRole("button", { name: SENT_COPY.mark });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onSent).toHaveBeenCalledTimes(1);
    expect(onSent).toHaveBeenCalledWith("a", true);
    finish({ ok: false, problem: SENT_COPY.closed });
    expect((await screen.findByRole("alert")).textContent).toBe(SENT_COPY.closed);
    onSent.mockImplementationOnce(() => Promise.reject(new Error("offline")));
    fireEvent.click(screen.getByRole("button", { name: SENT_COPY.mark }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(SENT_COPY.failed));
  });
});

describe("Record the win", () => {
  const mine = proposal({ id: "a", mine: true, canAct: true, contextCount: 2 });

  it("is offered only on the person's own open proposals", () => {
    render(<ProposalDesk now={NOW} data={list([mine, proposal({ id: "b", canAct: true })])} onWin={async () => ({ ok: true, engagementId: "e" })} />);
    expect(within(document.querySelector('[data-proposal-row="a"]') as HTMLElement).getByRole("button", { name: WIN_COPY.record })).toBeTruthy();
    expect(within(document.querySelector('[data-proposal-row="b"]') as HTMLElement).queryByRole("button", { name: WIN_COPY.record })).toBeNull();
  });

  it("says what it will do first, and does nothing on Not yet", () => {
    const onWin = vi.fn(async () => ({ ok: true as const, engagementId: "e" }));
    render(<ProposalDesk now={NOW} data={list([mine])} onWin={onWin} />);
    fireEvent.click(screen.getByRole("button", { name: WIN_COPY.record }));
    const dialog = screen.getByTestId("win-proposal");
    expect(within(dialog).getByText(WIN_COPY.body(2))).toBeTruthy();
    expect(within(dialog).getByText(WIN_COPY.sharing)).toBeTruthy();
    expect(within(dialog).getByText("Marrowfield: Network redesign")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: WIN_COPY.cancel }));
    expect(onWin).not.toHaveBeenCalled();
    expect(screen.queryByTestId("win-proposal")).toBeNull();
  });

  it("makes the board once on a double press and closes", async () => {
    let finish: (value: { ok: true; engagementId: string }) => void = () => {};
    const onWin = vi.fn(() => new Promise<{ ok: true; engagementId: string }>((resolve) => { finish = resolve; }));
    render(<ProposalDesk now={NOW} data={list([mine])} onWin={onWin} />);
    fireEvent.click(screen.getByRole("button", { name: WIN_COPY.record }));
    const confirm = screen.getByRole("button", { name: WIN_COPY.confirm });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onWin).toHaveBeenCalledTimes(1);
    expect(onWin).toHaveBeenCalledWith("a");
    finish({ ok: true, engagementId: "e" });
    await waitFor(() => expect(screen.queryByTestId("win-proposal")).toBeNull());
  });

  it("stays open with a plain line when the board could not be made", async () => {
    const onWin = vi.fn().mockResolvedValueOnce({ ok: false, problem: WIN_COPY.failed }).mockRejectedValueOnce(new Error("offline"));
    render(<ProposalDesk now={NOW} data={list([mine])} onWin={onWin} />);
    fireEvent.click(screen.getByRole("button", { name: WIN_COPY.record }));
    for (let i = 0; i < 2; i++) {
      fireEvent.click(screen.getByRole("button", { name: WIN_COPY.confirm }));
      await waitFor(() => expect(within(screen.getByTestId("win-proposal")).getByRole("alert").textContent).toBe(WIN_COPY.failed));
    }
    expect(onWin).toHaveBeenCalledTimes(2);
  });

  it("links a won proposal to its board only for the person whose board it is", () => {
    const won = { status: "won" as const, decidedAt: hoursAgo(2), engagementId: "e1" };
    render(<ProposalDesk now={NOW} data={list([proposal({ id: "a", mine: true, ...won }), proposal({ id: "b", ...won, engagementId: "e2" })])} />);
    fireEvent.click(document.querySelector('[data-desk-view="won"]') as HTMLElement);
    expect(within(document.querySelector('[data-proposal-row="a"]') as HTMLElement).getByRole("link", { name: DESK_COPY.openBoard })).toBeTruthy();
    expect(within(document.querySelector('[data-proposal-row="b"]') as HTMLElement).queryByRole("link")).toBeNull();
  });
});

describe("the turnaround goal in Settings", () => {
  it("stays locked until the saved goal has loaded, then saves the pick", async () => {
    const onSave = vi.fn(async () => true);
    const { rerender } = render(<ProposalGoalForm saved={undefined} canEdit onSave={onSave} />);
    const select = screen.getByLabelText(GOAL_COPY.label) as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    rerender(<ProposalGoalForm saved={72} canEdit onSave={onSave} />);
    expect(select.disabled).toBe(false);
    expect(select.value).toBe("72");
    const save = screen.getByRole("button", { name: GOAL_COPY.save }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(select, { target: { value: "48" } });
    fireEvent.click(save);
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(48));
    expect((await screen.findByRole("status")).textContent).toBe(GOAL_COPY.saved);
  });

  it("says so when the save is refused or fails, and keeps an unusual saved goal on the list", async () => {
    const onSave = vi.fn().mockResolvedValueOnce(false).mockRejectedValueOnce(new Error("offline"));
    render(<ProposalGoalForm saved={36} canEdit onSave={onSave} />);
    const select = screen.getByLabelText(GOAL_COPY.label) as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toEqual(["24", "36", "48", "72", "96", "120", "168"]);
    for (const pick of ["96", "24"]) {
      fireEvent.change(select, { target: { value: pick } });
      fireEvent.click(screen.getByRole("button", { name: GOAL_COPY.save }));
      await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(GOAL_COPY.failed));
      fireEvent.change(select, { target: { value: "48" } });
    }
    expect(onSave).toHaveBeenCalledTimes(2);
  });

  it("only reads the goal out to someone who is not an admin", () => {
    render(<ProposalGoalForm saved={48} canEdit={false} onSave={async () => true} />);
    expect(screen.getByText(GOAL_COPY.readOnly(48))).toBeTruthy();
    expect(screen.queryByLabelText(GOAL_COPY.label)).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("New proposal", () => {
  it("starts a proposal for an existing client with a document and notes", async () => {
    const props = openDialog();
    fireEvent.change(screen.getByLabelText(INTAKE_COPY.pickClient), { target: { value: CLIENTS[0]!.id } });
    fireEvent.change(screen.getByLabelText(INTAKE_COPY.titleLabel), { target: { value: "Network redesign" } });
    fireEvent.change(screen.getByLabelText(INTAKE_COPY.addFiles), { target: { files: [file("call-notes.txt")] } });
    await screen.findByText("call-notes.txt");
    fireEvent.change(screen.getByLabelText(INTAKE_COPY.notes), { target: { value: "They want it by March" } });
    fireEvent.click(screen.getByRole("button", { name: INTAKE_COPY.create }));
    await waitFor(() => expect(props.onCreated).toHaveBeenCalledWith("new"));
    expect(props.create).toHaveBeenCalledWith({ profile_id: PROFILE, title: "Network redesign", client_id: CLIENTS[0]!.id, notes: "They want it by March", work_item_ids: [ITEM] });
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("takes a new client's name instead", async () => {
    const props = openDialog();
    fireEvent.click(screen.getByRole("button", { name: INTAKE_COPY.newClient }));
    fireEvent.change(screen.getByLabelText(INTAKE_COPY.clientName), { target: { value: "Quillbrook" } });
    fireEvent.change(screen.getByLabelText(INTAKE_COPY.titleLabel), { target: { value: "Audit" } });
    fireEvent.click(screen.getByRole("button", { name: INTAKE_COPY.create }));
    await waitFor(() => expect(props.create).toHaveBeenCalled());
    expect(props.create).toHaveBeenCalledWith({ profile_id: PROFILE, title: "Audit", new_client_name: "Quillbrook", notes: "", work_item_ids: [] });
  });

  it("goes straight to a new client when the workspace has none", () => {
    openDialog({ clients: [] });
    expect(screen.getByText(INTAKE_COPY.noClients)).toBeTruthy();
    expect(screen.getByLabelText(INTAKE_COPY.clientName)).toBeTruthy();
    expect(screen.queryByLabelText(INTAKE_COPY.pickClient)).toBeNull();
  });

  it("keeps the client list locked until it has loaded", () => {
    openDialog({ clients: undefined, clientsLoading: true });
    expect((screen.getByLabelText(INTAKE_COPY.pickClient) as HTMLSelectElement).disabled).toBe(true);
  });

  it("names what is missing and calls nothing", () => {
    const props = openDialog();
    fireEvent.click(screen.getByRole("button", { name: INTAKE_COPY.create }));
    expect(screen.getByRole("alert").textContent).toBe(INTAKE_COPY.problems.title);
    fireEvent.change(screen.getByLabelText(INTAKE_COPY.titleLabel), { target: { value: "Audit" } });
    fireEvent.click(screen.getByRole("button", { name: INTAKE_COPY.create }));
    expect(screen.getByRole("alert").textContent).toBe(INTAKE_COPY.problems.client);
    expect(props.create).not.toHaveBeenCalled();
  });

  it("stays open with a plain line when the server refuses or the call fails", async () => {
    const refused = openDialog({ create: vi.fn(async () => ({ ok: false as const, problem: INTAKE_COPY.problems.clientGone })) });
    fireEvent.change(screen.getByLabelText(INTAKE_COPY.pickClient), { target: { value: CLIENTS[0]!.id } });
    fireEvent.change(screen.getByLabelText(INTAKE_COPY.titleLabel), { target: { value: "Audit" } });
    fireEvent.click(screen.getByRole("button", { name: INTAKE_COPY.create }));
    expect((await screen.findByRole("alert")).textContent).toBe(INTAKE_COPY.problems.clientGone);
    expect(refused.onCreated).not.toHaveBeenCalled();
    expect(refused.onOpenChange).not.toHaveBeenCalledWith(false);
    cleanup();

    const broken = openDialog({ create: vi.fn(async () => { throw new Error("network"); }) });
    fireEvent.change(screen.getByLabelText(INTAKE_COPY.pickClient), { target: { value: CLIENTS[0]!.id } });
    fireEvent.change(screen.getByLabelText(INTAKE_COPY.titleLabel), { target: { value: "Audit" } });
    fireEvent.click(screen.getByRole("button", { name: INTAKE_COPY.create }));
    expect((await screen.findByRole("alert")).textContent).toBe(INTAKE_COPY.problems.failed);
    expect(broken.onCreated).not.toHaveBeenCalled();
    // The button is usable again, so the person can retry.
    expect((screen.getByRole("button", { name: INTAKE_COPY.create }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("says which document did not come in and keeps the ones that did", async () => {
    let call = 0;
    const capture = vi.fn(async () => (++call === 1 ? { ids: [ITEM], failures: [] } : { ids: [], failures: [{ name: "big.pdf", reason: "too large" }] }));
    openDialog({ capture });
    fireEvent.change(screen.getByLabelText(INTAKE_COPY.addFiles), { target: { files: [file("ok.txt"), file("big.pdf")] } });
    expect((await screen.findByRole("alert")).textContent).toBe(INTAKE_COPY.problems.upload("big.pdf", "too large"));
    expect(screen.getByText("ok.txt")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: INTAKE_COPY.remove("ok.txt") }));
    expect(screen.queryByText("ok.txt")).toBeNull();
  });

  it("does not send twice on a double press", async () => {
    let finish: (value: { ok: true; id: string }) => void = () => {};
    const create = vi.fn(() => new Promise<{ ok: true; id: string }>((resolve) => { finish = resolve; }));
    const props = openDialog({ create });
    fireEvent.change(screen.getByLabelText(INTAKE_COPY.pickClient), { target: { value: CLIENTS[0]!.id } });
    fireEvent.change(screen.getByLabelText(INTAKE_COPY.titleLabel), { target: { value: "Audit" } });
    const button = screen.getByRole("button", { name: INTAKE_COPY.create });
    fireEvent.click(button);
    fireEvent.submit(button.closest("form") as HTMLFormElement);
    expect(create).toHaveBeenCalledTimes(1);
    finish({ ok: true, id: "new" });
    await waitFor(() => expect(props.onCreated).toHaveBeenCalledTimes(1));
  });
});

describe("long words", () => {
  it("lets a title made of one very long word wrap in the row and in the win dialog", () => {
    const long = "W".repeat(200);
    render(<ProposalDesk now={NOW} data={list([proposal({ id: "a", mine: true, title: long })])} onWin={vi.fn()} />);
    expect(document.querySelector("[data-proposal-title]")?.className).toContain("[overflow-wrap:anywhere]");
    fireEvent.click(screen.getByRole("button", { name: WIN_COPY.record }));
    expect(within(screen.getByTestId("win-proposal")).getByText(long, { exact: false }).className).toContain("[overflow-wrap:anywhere]");
  });
});

describe("picking the lead", () => {
  const person = (over: Partial<RosterContact>): RosterContact => ({ id: "c1", name: "Tom Reyes", role: "Network lead", affiliation: "independent", firm: null, texts: "agreed", agreedOn: "2026-11-19", stoppedOn: null, confirmed: false, changeUntil: null, linkPath: "/texts?w=o&c=c1", ...over });
  const roster = [person({}), person({ id: "c2", name: "Mina Okafor", role: null, texts: "none", agreedOn: null }), person({ id: "c3", name: "Zoë D'Arcy-Núñez", texts: "unknown", agreedOn: null })];
  const WORDS = "Lasso for Kestrel Bay Advisory: good news. The proposal you helped with has been won, and the team board is ready for you. Reply STOP to opt out.";
  const pickers = (proposals: DeskProposal[]): DeskList => ({ ...list(proposals), canPickLead: true });

  it("shows nothing about a lead to someone who may not pick, even when a handler is passed", () => {
    render(<ProposalDesk now={NOW} data={list([proposal({ id: "a", mine: true })])} roster={roster} leadWords={WORDS} onLead={vi.fn()} />);
    expect(document.querySelector("[data-proposal-lead]")).toBeNull();
    expect(screen.queryByText(LEAD_COPY.pick)).toBeNull();
  });

  it("names the lead with their text agreement on open rows only", () => {
    render(<ProposalDesk now={NOW} data={pickers([proposal({ id: "a", leadContactId: "c1" }), proposal({ id: "b", leadContactId: null }), proposal({ id: "w", status: "won", decidedAt: hoursAgo(1), leadContactId: "c1" })])} roster={roster} leadWords={WORDS} onLead={vi.fn()} />);
    const a = document.querySelector('[data-proposal-row="a"]') as HTMLElement;
    expect(within(a).getByText(LEAD_COPY.lead("Tom Reyes"))).toBeTruthy();
    expect(within(a).getByText(ROSTER_COPY.texts.agreed)).toBeTruthy();
    expect(within(a).getByRole("button", { name: LEAD_COPY.change })).toBeTruthy();
    const b = document.querySelector('[data-proposal-row="b"]') as HTMLElement;
    expect(within(b).getByText(LEAD_COPY.none)).toBeTruthy();
    expect(within(b).getByRole("button", { name: LEAD_COPY.pick })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Won/ }));
    expect(document.querySelector("[data-proposal-lead]")).toBeNull();
  });

  it("says plainly whether the person agreed to texts, shows the three examples, and saves once", async () => {
    let finish: (value: { ok: true }) => void = () => {};
    const onLead = vi.fn(() => new Promise<{ ok: true }>((resolve) => { finish = resolve; }));
    render(<ProposalDesk now={NOW} data={pickers([proposal({ id: "b" })])} roster={roster} leadWords={WORDS} onLead={onLead} />);
    fireEvent.click(screen.getByRole("button", { name: LEAD_COPY.pick }));
    const dialog = await screen.findByTestId("pick-lead");
    const save = within(dialog).getByRole("button", { name: LEAD_COPY.save }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(within(dialog).getByText(WORDS)).toBeTruthy();
    // The page says where a text would go, before anyone presses anything.
    expect(within(dialog).getByText(LEAD_COPY.where(false))).toBeTruthy();
    expect(within(dialog).getByText(LEAD_COPY.intro).textContent).toContain("sends nothing");
    expect(`${LEAD_COPY.agreed("x")} ${LEAD_COPY.intro}`).not.toMatch(/they get|will get|hears when/);
    expect(dialog.querySelectorAll("[data-message-example]")).toHaveLength(3);
    expect(within(dialog).getByText(MESSAGE_EXAMPLES_COPY.rcsState)).toBeTruthy();
    const select = within(dialog).getByLabelText(LEAD_COPY.select);
    fireEvent.change(select, { target: { value: "c2" } });
    expect(within(dialog).getByText(LEAD_COPY.notAgreed("Mina Okafor"))).toBeTruthy();
    fireEvent.change(select, { target: { value: "c3" } });
    expect(within(dialog).getByText(LEAD_COPY.unknown("Zoë D'Arcy-Núñez"))).toBeTruthy();
    fireEvent.change(select, { target: { value: "c1" } });
    expect(within(dialog).getByText(LEAD_COPY.agreed("Tom Reyes"))).toBeTruthy();
    expect(dialog.textContent).not.toMatch(/\+?1?\d{10}/);
    fireEvent.click(save);
    fireEvent.click(save);
    expect(onLead).toHaveBeenCalledTimes(1);
    expect(onLead).toHaveBeenCalledWith("b", "c1");
    finish({ ok: true });
    await waitFor(() => expect(screen.queryByTestId("pick-lead")).toBeNull());
  });

  it("clears a lead, keeps the dialog open with the server's line on a refusal, and copes with an empty or unread list", async () => {
    const onLead = vi.fn().mockResolvedValueOnce({ ok: false, problem: LEAD_COPY.missing }).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ ok: true });
    const view = render(<ProposalDesk now={NOW} data={pickers([proposal({ id: "a", leadContactId: "c1" })])} roster={roster} leadWords={WORDS} onLead={onLead} />);
    fireEvent.click(screen.getByRole("button", { name: LEAD_COPY.change }));
    const dialog = await screen.findByTestId("pick-lead");
    fireEvent.click(within(dialog).getByRole("button", { name: LEAD_COPY.clear }));
    expect((await within(dialog).findByRole("alert")).textContent).toBe(LEAD_COPY.missing);
    fireEvent.click(within(dialog).getByRole("button", { name: LEAD_COPY.clear }));
    await waitFor(() => expect(within(dialog).getByRole("alert").textContent).toBe(LEAD_COPY.failed));
    fireEvent.click(within(dialog).getByRole("button", { name: LEAD_COPY.clear }));
    await waitFor(() => expect(screen.queryByTestId("pick-lead")).toBeNull());
    expect(onLead).toHaveBeenLastCalledWith("a", null);
    view.unmount();
    render(<ProposalDesk now={NOW} data={pickers([proposal({ id: "a" })])} roster={[]} leadWords={WORDS} onLead={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: LEAD_COPY.pick }));
    expect(within(await screen.findByTestId("pick-lead")).getByText(LEAD_COPY.noPeople)).toBeTruthy();
    cleanup();
    render(<ProposalDesk now={NOW} data={pickers([proposal({ id: "a", leadContactId: "gone" })])} roster={undefined} leadWords={WORDS} onLead={vi.fn()} />);
    expect(screen.getByText(LEAD_COPY.none)).toBeTruthy();
    expect(screen.getByRole("button", { name: LEAD_COPY.change })).toBeTruthy();
  });
});

describe("20 Nov: asking the lead, on the page", () => {
  const WORDS = "Lasso for Kestrel Bay Advisory: hi Christy, Maren would love you to lead a new proposal. Are you in? Reply YES or NO. Reply STOP to opt out.";
  const person: RosterContact = { id: "c1", name: "Christy Johnson", role: null, affiliation: "independent", firm: null, texts: "agreed", agreedOn: "2026-11-19", stoppedOn: null, confirmed: false, changeUntil: null, linkPath: "/texts?w=o&c=c1" };
  const pickers = (proposals: DeskProposal[]): DeskList => ({ ...list(proposals), canPickLead: true });
  const view = (over: Partial<AskView>): AskView => ({ name: "Christy Johnson", status: "accepted", reply: null, practice: false, waiting: true, ...over });
  const ask = () => ({ preview: vi.fn(async () => ({ ok: true as const, words: WORDS, name: "Christy Johnson", mode: "real" as const, warning: null })), send: vi.fn(async () => ({ ok: true as const, practice: false })), practiceReply: vi.fn(async () => ({ ok: true as const })) });
  const desk = (proposals: DeskProposal[], handlers = ask()) => {
    render(<ProposalDesk now={NOW} data={pickers(proposals)} roster={[person]} leadWords={WORDS} onLead={vi.fn()} ask={handlers} />);
    return handlers;
  };

  it("an admin or lead sees the exact words, presses Send once, and the dialog closes", async () => {
    const handlers = desk([proposal({ id: "a", leadContactId: "c1", leadName: "Christy Johnson" })]);
    fireEvent.click(screen.getByRole("button", { name: ASK_COPY.open("Christy Johnson") }));
    const dialog = await screen.findByTestId("ask-lead");
    expect(await within(dialog).findByText(WORDS)).toBeTruthy();
    const send = within(dialog).getByRole("button", { name: ASK_COPY.send });
    fireEvent.click(send);
    fireEvent.click(send);
    await waitFor(() => expect(screen.queryByTestId("ask-lead")).toBeNull());
    expect(handlers.send).toHaveBeenCalledTimes(1);
    expect(handlers.send.mock.calls[0]).toEqual(["a", expect.stringMatching(/^[0-9a-f-]{36}$/)]);
  });

  it("with no agreement the screen says so plainly and Send is not offered", async () => {
    const handlers = ask();
    handlers.preview.mockResolvedValue({ ok: true, words: WORDS, name: "Christy Johnson", mode: "real", warning: ASK_COPY.notAgreedYet("Christy Johnson") } as never);
    desk([proposal({ id: "a", leadContactId: "c1", leadName: "Christy Johnson" })], handlers);
    fireEvent.click(screen.getByRole("button", { name: ASK_COPY.open("Christy Johnson") }));
    const dialog = await screen.findByTestId("ask-lead");
    expect(await within(dialog).findByText(ASK_COPY.notAgreedYet("Christy Johnson"))).toBeTruthy();
    expect((within(dialog).getByRole("button", { name: ASK_COPY.send }) as HTMLButtonElement).disabled).toBe(true);
    expect(handlers.send).not.toHaveBeenCalled();
  });

  it("a refused send keeps the dialog open with the plain line", async () => {
    const handlers = ask();
    handlers.send.mockResolvedValue({ ok: false, problem: ASK_COPY.capped } as never);
    desk([proposal({ id: "a", leadContactId: "c1", leadName: "Christy Johnson" })], handlers);
    fireEvent.click(screen.getByRole("button", { name: ASK_COPY.open("Christy Johnson") }));
    const dialog = await screen.findByTestId("ask-lead");
    fireEvent.click(await within(dialog).findByRole("button", { name: ASK_COPY.send }));
    expect(await within(dialog).findByText(ASK_COPY.capped)).toBeTruthy();
  });

  it("a failed load of the words says so and offers no Send", async () => {
    render(<AskDialog proposal={proposal({ id: "a" })} load={async () => { throw new Error("down"); }} send={vi.fn()} onClose={vi.fn()} />);
    const dialog = await screen.findByTestId("ask-lead");
    expect(await within(dialog).findByText(ASK_COPY.failed)).toBeTruthy();
    expect((within(dialog).getByRole("button", { name: ASK_COPY.send }) as HTMLButtonElement).disabled).toBe(true);
  });

  it.each([
    [view({}), "Asked by text. Waiting for a reply", false],
    [view({ status: "delivered" }), "Delivered. Waiting for a reply", false],
    [view({ reply: "yes", waiting: false }), "Christy Johnson said yes", false],
    [view({ reply: "no", waiting: false }), "Christy Johnson said no", false],
    [view({ status: "undelivered", waiting: false }), "The text did not arrive", true],
    [view({ waiting: false }), "Asked by text. No reply", true],
  ] as [AskView, string, boolean][])("shows %j as its one line", (state, line, again) => {
    desk([proposal({ id: "a", leadContactId: "c1", leadName: "Christy Johnson", ask: state })]);
    const row = document.querySelector('[data-proposal-row="a"]') as HTMLElement;
    expect(within(row).getByText(line)).toBeTruthy();
    expect(within(row).queryByRole("button", { name: ASK_COPY.again }) !== null).toBe(again);
    expect(within(row).queryByRole("button", { name: ASK_COPY.open("Christy Johnson") })).toBeNull();
  });

  it("a practice ask is marked as practice and answered with YES, NO or STOP as the lead would", async () => {
    const handlers = desk([proposal({ id: "a", leadContactId: "c1", leadName: "Christy Johnson", ask: view({ name: "", status: "practice", practice: true }) })]);
    const row = document.querySelector('[data-proposal-row="a"]') as HTMLElement;
    expect(within(row).getByText(ASK_COPY.practiceWaiting)).toBeTruthy();
    expect(within(row).getByText(ASK_COPY.practiceTag)).toBeTruthy();
    fireEvent.click(within(row).getByRole("button", { name: "YES" }));
    await waitFor(() => expect(handlers.practiceReply).toHaveBeenCalledWith("a", "yes"));
    expect(within(row).getByRole("button", { name: "NO" })).toBeTruthy();
    expect(within(row).getByRole("button", { name: "STOP" })).toBeTruthy();
  });

  it("no practice buttons on a real ask, and no ask button without a lead", () => {
    desk([proposal({ id: "a", leadContactId: "c1", leadName: "Christy Johnson", ask: view({}) }), proposal({ id: "b" })]);
    expect(document.querySelector("[data-practice-reply]")).toBeNull();
    expect(within(document.querySelector('[data-proposal-row="b"]') as HTMLElement).queryByRole("button", { name: /Ask/ })).toBeNull();
  });

  it("the person who started a proposal sees the lead's name and answer, with no button to ask or pick", () => {
    render(<ProposalDesk now={NOW} data={list([proposal({ id: "a", mine: true, leadName: "Christy Johnson", ask: view({ reply: "yes", waiting: false }) })])} />);
    const row = document.querySelector('[data-proposal-row="a"]') as HTMLElement;
    expect(within(row).getByText(LEAD_COPY.lead("Christy Johnson"))).toBeTruthy();
    expect(within(row).getByText("Christy Johnson said yes")).toBeTruthy();
    expect(within(row).queryByRole("button", { name: /Ask|Pick|Change/ })).toBeNull();
  });

  it("the pick dialog says where a text goes, for a real and a demo workspace", async () => {
    render(<ProposalDesk now={NOW} data={{ ...pickers([proposal({ id: "a" })]), texts: { demo: true, connected: false } }} roster={[person]} leadWords={WORDS} onLead={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: LEAD_COPY.pick }));
    expect(within(await screen.findByTestId("pick-lead")).getByText(LEAD_COPY.where(true))).toBeTruthy();
    expect(LEAD_COPY.where(false)).toContain("only once they have agreed");
  });
});

describe("20 Nov: closing as lost and archiving, on the page", () => {
  it("offers each only where the server allows it, says what it does, and does it once", async () => {
    const onClose = vi.fn(async () => ({ ok: true as const }));
    render(<ProposalDesk now={NOW} data={list([proposal({ id: "a", mine: true, canClose: true, canArchive: true }), proposal({ id: "b", canClose: true }), proposal({ id: "c" })])} onClose={onClose} />);
    const row = (id: string) => document.querySelector(`[data-proposal-row="${id}"]`) as HTMLElement;
    expect(within(row("b")).queryByRole("button", { name: CLOSE_COPY.archive })).toBeNull();
    expect(within(row("c")).queryByRole("button", { name: CLOSE_COPY.lost })).toBeNull();
    fireEvent.click(within(row("a")).getByRole("button", { name: CLOSE_COPY.lost }));
    const dialog = await screen.findByTestId("close-proposal");
    expect(within(dialog).getByText(CLOSE_COPY.lostBody)).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    const confirm = within(dialog).getByRole("button", { name: CLOSE_COPY.confirmLost });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(screen.queryByTestId("close-proposal")).toBeNull());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith("a", "lost");
  });

  it("archive says nothing is deleted, and a refusal keeps the dialog open with the plain line", async () => {
    const onClose = vi.fn(async () => ({ ok: false as const, problem: CLOSE_COPY.adminOnly }));
    render(<ProposalDesk now={NOW} data={list([proposal({ id: "a", canArchive: true })])} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: CLOSE_COPY.archive }));
    const dialog = await screen.findByTestId("close-proposal");
    expect(within(dialog).getByText(CLOSE_COPY.archiveBody).textContent).toContain("Nothing is deleted");
    fireEvent.click(within(dialog).getByRole("button", { name: CLOSE_COPY.confirmArchive }));
    expect(await within(dialog).findByText(CLOSE_COPY.adminOnly)).toBeTruthy();
  });

  it("without a handler the rows offer neither, and lost proposals have their own view", () => {
    render(<ProposalDesk now={NOW} data={list([proposal({ id: "a", canClose: true, canArchive: true }), proposal({ id: "l", status: "lost", decidedAt: hoursAgo(3) })])} />);
    expect(screen.queryByRole("button", { name: CLOSE_COPY.lost })).toBeNull();
    fireEvent.click(document.querySelector('[data-desk-view="lost"]') as HTMLElement);
    expect(document.querySelector('[data-proposal-row="l"]')).toBeTruthy();
    expect(document.querySelector('[data-proposal-row="a"]')).toBeNull();
    expect(document.querySelector("[data-desk-no-board]")).toBeNull();
  });
});

describe("20 Nov: who adds a client, said before any upload", () => {
  it("a member is told an admin adds new clients, picks an existing one, and has no new-client field", () => {
    openDialog({ canAddClient: false });
    const form = screen.getByTestId("new-proposal");
    expect(within(form).getByText(INTAKE_COPY.adminAddsClients)).toBeTruthy();
    expect(within(form).queryByLabelText(/new client/i)).toBeNull();
  });

  it("with no clients at all a member cannot upload or start, and is told why", () => {
    openDialog({ canAddClient: false, clients: [] });
    const form = screen.getByTestId("new-proposal");
    expect(within(form).getByText(INTAKE_COPY.noClientsForMember)).toBeTruthy();
    expect((within(form).getByRole("button", { name: INTAKE_COPY.create }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("giving up removes what was uploaded here, and so does taking a document off the list", async () => {
    const discard = vi.fn(async () => undefined);
    const props = openDialog({ discard });
    const input = screen.getByTestId("new-proposal").querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file("brief.txt")] } });
    await screen.findByText("brief.txt");
    fireEvent.click(screen.getByRole("button", { name: INTAKE_COPY.remove("brief.txt") }));
    expect(discard).toHaveBeenCalledWith([ITEM]);
    fireEvent.change(input, { target: { files: [file("rfp.txt")] } });
    await screen.findByText("rfp.txt");
    fireEvent.click(screen.getByRole("button", { name: INTAKE_COPY.cancel }));
    expect(discard).toHaveBeenCalledTimes(2);
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("a proposal that is made keeps its documents", async () => {
    const discard = vi.fn(async () => undefined);
    const props = openDialog({ discard });
    const form = screen.getByTestId("new-proposal");
    fireEvent.change(form.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [file("brief.txt")] } });
    await screen.findByText("brief.txt");
    fireEvent.change(within(form).getByLabelText(INTAKE_COPY.titleLabel), { target: { value: "Network redesign" } });
    fireEvent.change(form.querySelector("select") as HTMLSelectElement, { target: { value: props.clients?.[0]?.id } });
    fireEvent.click(within(form).getByRole("button", { name: INTAKE_COPY.create }));
    await waitFor(() => expect(props.create).toHaveBeenCalled());
    await waitFor(() => expect(props.onCreated).toHaveBeenCalled());
    expect(discard).not.toHaveBeenCalled();
  });
});

describe("20 Nov: the strip at the top of a board made by a win", () => {
  it("says it was won and when, names the lead, and gives the lead's answer once there is one", () => {
    render(<BoardWinLines win={{ won: true, decidedAt: "2026-11-19T18:00:00Z", leadName: "Christy Johnson", ask: { name: "Christy Johnson", status: "delivered", reply: "yes", practice: false, waiting: false } }}><button type="button">Text the lead</button></BoardWinLines>);
    const strip = screen.getByTestId("board-win-strip");
    expect(strip.textContent).toContain(BOARD_WIN_COPY.won("Thu 19 Nov"));
    expect(within(strip).getByText("Lead: Christy Johnson")).toBeTruthy();
    expect(within(strip).getByText("Christy Johnson said yes")).toBeTruthy();
    expect(within(strip).getByRole("button", { name: "Text the lead" })).toBeTruthy();
  });

  it("no lead, nothing about a lead; not a won board, nothing at all", () => {
    const { rerender } = render(<BoardWinLines win={{ won: true, decidedAt: null, leadName: null, ask: null }} />);
    const strip = screen.getByTestId("board-win-strip");
    expect(strip.textContent).toBe("Proposal won");
    expect(strip.querySelector("[data-board-lead]")).toBeNull();
    rerender(<BoardWinLines win={{ won: false }} />);
    expect(screen.queryByTestId("board-win-strip")).toBeNull();
  });

  it("is its own component, mounted once on the signed-in board for the board's own workspace only", () => {
    const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
    expect(page.match(/<BoardWinStrip /g)).toHaveLength(1);
    expect(page).toContain('{firmBrainScope === "own" ? <BoardWinStrip engagementId={engagementId} profileId={profile?.id} /> : null}');
    for (const surface of ["src/components/proposals/BoardWinStrip.tsx"]) expect(readFileSync(surface, "utf8")).not.toMatch(/posthog|featureFlag|useFlag/i);
  });
});

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NewProposalDialog } from "@/components/proposals/NewProposalDialog";
import { ProposalDesk } from "@/components/proposals/ProposalDesk";
import { DESK_COPY, INTAKE_COPY, type DeskList, type DeskProposal } from "@/lib/proposal-desk-shared";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, params }: { children: ReactNode; params?: { id?: string } }) => <a href={`/engagements/${params?.id}/canvas-lab`}>{children}</a>,
}));

afterEach(cleanup);

const NOW = new Date("2026-11-20T12:00:00Z");
const hoursAgo = (n: number) => new Date(NOW.getTime() - n * 3_600_000).toISOString();
const proposal = (over: Partial<DeskProposal>): DeskProposal => ({
  id: "p", title: "Network redesign", clientName: "Marrowfield", ownerName: "Maren Hollis", mine: false, status: "open",
  receivedAt: hoursAgo(10), sentAt: null, decidedAt: null, engagementId: null, contextCount: 0, ...over,
});
const list = (proposals: DeskProposal[], goalHours = 72): DeskList => ({ goalHours, canSetGoal: false, proposals });

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
    render(<ProposalDesk now={NOW} data={list([proposal({ id: "a" }), proposal({ id: "b", mine: true }), proposal({ id: "w", status: "won", decidedAt: "2026-11-20T09:00:00Z", engagementId: "board-1" })])} />);
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

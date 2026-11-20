// @vitest-environment jsdom
// 21 Nov 2026 (Liam: "after created it should automatically begin the lead picking process"): saving a new proposal
// opens the lead sheet on it at once, for people who may pick a lead. Picking sends nothing; closing leaves no lead.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NewProposalDialog } from "@/components/proposals/NewProposalDialog";
import { ProposalDesk } from "@/components/proposals/ProposalDesk";
import { SHEET_COPY } from "@/lib/lead-ask-shared";
import { INTAKE_COPY, LEAD_COPY, type DeskList, type DeskProposal } from "@/lib/proposal-desk-shared";
import type { RosterContact } from "@/lib/roster-shared";
import { morph, PROPOSAL_MORPH } from "@/lib/view-morph";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const WORDS = "Lasso for Kestrel Bay Advisory: hi Christy, Maren would love you to lead a new proposal. Are you in? Reply YES or NO. Reply STOP to opt out.";
const person: RosterContact = { id: "c1", name: "Christy Johnson", role: null, affiliation: "independent", firm: null, texts: "agreed", agreedOn: "2026-11-19", stoppedOn: null, confirmed: false, changeUntil: null, phoneMasked: null, email: null, linkedin: null, needsDetails: false, numberDiffers: false, invitedOn: null, linkPath: "/texts?w=o&c=c1" };
const made = (over: Partial<DeskProposal> = {}): DeskProposal => ({
  id: "new", title: "Network redesign", clientName: "Marrowfield", ownerName: "Maren Hollis", mine: true, status: "open",
  receivedAt: new Date().toISOString(), sentAt: null, decidedAt: null, engagementId: null, contextCount: 0, canAct: true, canClose: true, canArchive: true,
  leadContactId: null, leadName: null, ask: null, ...over,
} as DeskProposal);
const data = (proposals: DeskProposal[], canPickLead = true): DeskList => ({ goalHours: 72, canSetGoal: true, canPickLead, canAddClient: true, texts: { demo: true, connected: false }, proposals });
const ask = () => ({
  preview: vi.fn(async () => ({ ok: true as const, words: WORDS, name: "Christy Johnson", mode: "practice" as const, warning: null })),
  send: vi.fn(async () => ({ ok: true as const, practice: true })),
  practiceReply: vi.fn(async () => ({ ok: true as const })),
});

function desk(props: Partial<Parameters<typeof ProposalDesk>[0]> = {}) {
  const onLead = vi.fn(async () => ({ ok: true as const }));
  const onStartLeadDone = vi.fn();
  const all = { data: data([made()]), roster: [person], leadWords: WORDS, onLead, ask: ask(), startLead: "new", onStartLeadDone, ...props };
  const view = render(<ProposalDesk {...all} />);
  return { ...all, view };
}
const sheet = () => screen.queryByTestId("pick-lead");

describe("a new proposal opens the lead sheet at once", () => {
  it("opens on the list for the new proposal, says it was started, and offers Pick later in place of Cancel", () => {
    desk();
    const open = sheet() as HTMLElement;
    expect(open).not.toBeNull();
    expect(open.hasAttribute("data-lead-fresh")).toBe(true);
    expect(within(open).getByRole("heading").textContent).toBe(SHEET_COPY.title("Marrowfield"));
    expect(within(open).getByText(`${SHEET_COPY.started} ${LEAD_COPY.intro}`)).toBeTruthy();
    expect(within(open).getByRole("button", { name: SHEET_COPY.pickLater })).toBeTruthy();
    expect(within(open).queryByRole("button", { name: LEAD_COPY.cancel })).toBeNull();
    // It still says picking sends nothing.
    expect(open.textContent).toContain("Picking a lead sends nothing.");
  });

  it("Pick later closes it and leaves the proposal with no lead: nothing is saved or sent", async () => {
    const { onLead, onStartLeadDone, ask: handlers } = desk();
    fireEvent.click(screen.getByRole("button", { name: SHEET_COPY.pickLater }));
    expect(onStartLeadDone).toHaveBeenCalledTimes(1);
    expect(onLead).not.toHaveBeenCalled();
    expect(handlers!.send).not.toHaveBeenCalled();
  });

  it("closing with Escape or the X is the same as Pick later", () => {
    const { onLead, onStartLeadDone } = desk();
    fireEvent.keyDown(sheet() as HTMLElement, { key: "Escape" });
    expect(onStartLeadDone).toHaveBeenCalledTimes(1);
    expect(onLead).not.toHaveBeenCalled();
  });

  it("picking and saving saves only the lead, sends nothing, then closes", async () => {
    const { onLead, onStartLeadDone, ask: handlers } = desk();
    fireEvent.click(within(sheet() as HTMLElement).getByText("Christy Johnson"));
    fireEvent.click(screen.getByRole("button", { name: LEAD_COPY.save }));
    await waitFor(() => expect(onLead).toHaveBeenCalledWith("new", "c1"));
    await waitFor(() => expect(onStartLeadDone).toHaveBeenCalled());
    expect(handlers!.send).not.toHaveBeenCalled();
  });

  it("is not opened for someone who may not pick a lead: they land on the rows as today", () => {
    desk({ data: data([made()], false) });
    expect(sheet()).toBeNull();
    cleanup();
    desk({ ask: undefined });
    expect(sheet()).toBeNull();
    cleanup();
    desk({ onLead: undefined });
    expect(sheet()).toBeNull();
  });

  it("waits for the new row to arrive, then opens; a proposal that is no longer open never opens it", () => {
    const first = desk({ data: data([]) });
    expect(sheet()).toBeNull();
    first.view.rerender(<ProposalDesk {...first} data={data([made()])} />);
    expect(sheet()).not.toBeNull();
    cleanup();
    desk({ data: data([made({ status: "won" })]) });
    expect(sheet()).toBeNull();
  });

  it("from a row, the sheet is as before: Cancel, no started line", () => {
    desk({ startLead: null, data: data([made({ id: "a" })]) });
    expect(sheet()).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: LEAD_COPY.pick }));
    const open = sheet() as HTMLElement;
    expect(open.hasAttribute("data-lead-fresh")).toBe(false);
    expect(within(open).getByRole("button", { name: LEAD_COPY.cancel })).toBeTruthy();
    expect(open.textContent).not.toContain(SHEET_COPY.started);
  });

  it("the fresh sheet carries the morph name while it arrives, and never zooms in by itself", async () => {
    vi.useFakeTimers();
    try {
      desk();
      const box = sheet() as HTMLElement;
      expect(box.style.animation).toBe("none");
      expect((box.style as unknown as Record<string, string>)["viewTransitionName"]).toBe(PROPOSAL_MORPH);
      expect(box.hasAttribute("data-lead-arriving")).toBe(true);
      await act(async () => { vi.advanceTimersByTime(800); });
      // The name goes; the entrance stays off, so the zoom is never replayed while it is open.
      expect((box.style as unknown as Record<string, string>)["viewTransitionName"] ?? "").toBe("");
      expect(box.style.animation).toBe("none");
      expect(box.hasAttribute("data-lead-arriving")).toBe(false);
      expect(box.hasAttribute("data-lead-fresh")).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("the backdrop stays steady during the hand-over and the page behind does not cross-fade", () => {
    const css = readFileSync("src/components/proposals/proposal-morph.css", "utf8");
    expect(css).toContain("::view-transition-old(root),::view-transition-new(root){animation:none}");
    expect(css).toContain("[data-skin-overlay]:has(+ [data-proposal-handing]),[data-skin-overlay]:has(+ [data-lead-fresh]){animation:none}");
    expect(css).toContain("cubic-bezier(.45,0,.2,1)");
    // The dialog shell still renders its backdrop straight before its box, which the rule above relies on.
    const shell = readFileSync("src/components/ui/dialog.tsx", "utf8");
    expect(shell).toMatch(/<DialogOverlay \/>\s*<DialogPrimitive\.Content/);
  });
});

describe("the form waits for the hand-over, then leaves", () => {
  const CLIENTS = [{ id: "44444444-4444-4444-8444-444444444444", name: "Marrowfield" }];
  function form(onCreated: (id: string) => void | Promise<void>) {
    const props = {
      open: true, onOpenChange: vi.fn(), clients: CLIENTS, clientsLoading: false, profileId: "22222222-2222-4222-8222-222222222222",
      capture: vi.fn(async () => ({ ids: ["55555555-5555-4555-8555-555555555555"], failures: [] })),
      discard: vi.fn(async () => undefined),
      create: vi.fn(async () => ({ ok: true as const, id: "new" })), onCreated: vi.fn(onCreated),
    };
    render(<NewProposalDialog {...props} />);
    fireEvent.change(screen.getByLabelText(INTAKE_COPY.pickClient), { target: { value: CLIENTS[0]!.id } });
    fireEvent.change(screen.getByLabelText(INTAKE_COPY.titleLabel), { target: { value: "Network redesign" } });
    return props;
  }

  it("stays on Starting until the page has handed over, carries the morph name, then closes", async () => {
    let done: () => void = () => {};
    const props = form(() => new Promise<void>((resolve) => { done = resolve; }));
    fireEvent.click(screen.getByRole("button", { name: INTAKE_COPY.create }));
    await waitFor(() => expect(props.onCreated).toHaveBeenCalledWith("new"));
    expect(screen.getByRole("button", { name: INTAKE_COPY.creating })).toBeTruthy();
    const box = screen.getByTestId("new-proposal");
    expect((box.style as unknown as Record<string, string>)["viewTransitionName"]).toBe(PROPOSAL_MORPH);
    expect(box.hasAttribute("data-proposal-handing")).toBe(true);
    expect(props.onOpenChange).not.toHaveBeenCalled();
    await act(async () => done());
    await waitFor(() => expect(props.onOpenChange).toHaveBeenCalledWith(false));
    expect(props.discard).not.toHaveBeenCalled();
  });

  it("a hand-over that fails still closes quietly: the proposal was made, so nothing says it failed", async () => {
    const props = form(async () => { throw new Error("read failed"); });
    fireEvent.click(screen.getByRole("button", { name: INTAKE_COPY.create }));
    await waitFor(() => expect(props.onOpenChange).toHaveBeenCalledWith(false));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(props.create).toHaveBeenCalledTimes(1);
  });

  it("a page that hands nothing over closes the form as before", async () => {
    const props = form(() => undefined);
    fireEvent.click(screen.getByRole("button", { name: INTAKE_COPY.create }));
    await waitFor(() => expect(props.onOpenChange).toHaveBeenCalledWith(false));
  });
});

describe("the morph", () => {
  it("uses the browser's view transition when there is one, and resolves only once the change is made", async () => {
    let run: () => void = () => {};
    const start = vi.fn((callback: () => void) => { let done: () => void = () => {}; const updateCallbackDone = new Promise<void>((resolve) => { done = resolve; }); run = () => { callback(); done(); }; return { updateCallbackDone }; });
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    (document as unknown as { startViewTransition?: unknown }).startViewTransition = start;
    const update = vi.fn();
    let resolved = false;
    const promise = morph(update).then(() => { resolved = true; });
    expect(start).toHaveBeenCalledTimes(1);
    // The browser runs the change a frame later; until then nothing is changed and the caller keeps waiting.
    await Promise.resolve();
    expect(update).not.toHaveBeenCalled();
    expect(resolved).toBe(false);
    run();
    await promise;
    expect(update).toHaveBeenCalledTimes(1);
    expect(resolved).toBe(true);
    delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
  });

  it("changes at once with no animation under reduced motion or without view transitions", () => {
    const start = vi.fn();
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    (document as unknown as { startViewTransition?: unknown }).startViewTransition = start;
    const update = vi.fn();
    morph(update);
    expect(start).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
    delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    morph(update);
    expect(update).toHaveBeenCalledTimes(2);
  });
});

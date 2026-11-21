// @vitest-environment jsdom
// 21 Nov 2026, click path cards (Liam: "clicking through version not using chat should have buttons that pop open
// pleasant looking white background cards for steps ... it shouldnt open chat"). The step card itself, and the paths
// of the proposal step card that the Proposals page test does not walk: a brief read into the fields, a Member's
// pass to an admin, the documents step, the Lead's final and a sent document, and "Ask Lasso about this".
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LeadFinalCard } from "@/components/home/LeadFinalCard";
import { ProposalFlow, type ProposalFlowProps } from "@/components/proposals/ProposalFlow";
import { StepCard } from "@/components/ui/step-card";
import type { BriefReading } from "@/lib/brief-read-shared";
import { PILL_OPEN_EVENT, type PillCardContext } from "@/lib/chat-pill-shared";
import { FOCUS_BLUR_CSS } from "@/lib/focus-blur-shared";
import { SEND_DOCS_COPY } from "@/lib/lead-view-shared";
import { BRIEF_PASS_COPY, PROPOSAL_CARD_COPY } from "@/lib/pill-proposal-shared";
import type { DeskList, DeskProposal } from "@/lib/proposal-desk-shared";
import { APPROVAL_COPY } from "@/lib/proposal-approval-shared";
import { FINAL_CARD_COPY, FINAL_COPY } from "@/lib/proposal-final-shared";
import { FLOW_COPY } from "@/lib/proposal-flow-shared";
import { STEP_CARD_COPY } from "@/lib/step-card-shared";

const h = vi.hoisted(() => ({
  desk: null as unknown,
  refetch: vi.fn(),
}));

vi.mock("@/components/proposals/use-proposal-desk", () => ({
  useProposalDesk: (id: string | undefined) => ({ data: id ? h.desk : undefined, refetch: h.refetch }),
}));
vi.mock("@/components/pill/PillLeadStep", () => ({
  PillLeadStep: ({ onDone, onState }: { onDone: () => void; onState?: (s: { confirm: boolean; working: boolean }) => void }) => (
    <div data-testid="pick-lead">
      <button type="button" onClick={() => onState?.({ confirm: true, working: false })}>
        to the ask
      </button>
      <button type="button" onClick={onDone}>
        lead done
      </button>
      <button
        type="button"
        onClick={() => {
          onState?.({ confirm: true, working: true });
          onDone();
        }}
      >
        sent and closed
      </button>
    </div>
  ),
}));

const PROFILE = "33333333-3333-4333-8333-333333333333";
const MARROW = "44444444-4444-4444-8444-444444444444";
const PASTE = "Marrowfield Health wants a staffing model review, due Friday. Please send a proposal.";
const READING: BriefReading = {
  client: { name: "Marrowfield Health", id: MARROW },
  ask: "a staffing model review",
  due: { phrase: "Friday", date: "2099-11-27" },
  notes: PASTE,
  readBy: "model",
};
const row = (over: Partial<DeskProposal> = {}): DeskProposal =>
  ({
    id: "p-new",
    title: "a staffing model review",
    clientName: "Marrowfield Health",
    status: "open",
    contextCount: 2,
    contextTitles: ["Marrowfield RFP.pdf", "Last year's review.docx"],
    leadName: "Christy Johnson",
    leadDocs: "unsent",
    ...over,
  }) as DeskProposal;

function props(over: Partial<ProposalFlowProps> = {}): ProposalFlowProps {
  return {
    open: true,
    onOpenChange: vi.fn(),
    mayStart: true,
    tools: {
      profileId: PROFILE,
      goalHours: 72,
      read: vi.fn(async () => READING),
      clients: vi.fn(async () => [{ id: MARROW, name: "Marrowfield Health" }]),
      capture: vi.fn(async (files: File[]) => ({ ids: files.map((_, i) => `w${i}`), failures: [] })),
      discard: vi.fn(async () => undefined),
      create: vi.fn(async () => ({ ok: true as const, id: "p-new" })),
    },
    passTools: {
      admins: vi.fn(async () => ({ name: "Maren", count: 1 })),
      pass: vi.fn(async () => ({ ok: true as const, admins: 1 })),
    },
    firmName: "QA Firm",
    brandName: "Lasso",
    sendDocs: vi.fn(async () => ({ ok: true as const })),
    reduceMotion: true,
    ...over,
  };
}

const card = () => screen.getByTestId("proposal-flow");
const marker = () => card().querySelector(".step-card__pane:not([data-leaving]) [data-step-marker]")?.textContent ?? null;
const field = (label: string) => within(card()).getByLabelText(label) as HTMLInputElement;
async function ready() {
  await waitFor(() => expect(field(PROPOSAL_CARD_COPY.client).disabled).toBe(false));
}

beforeEach(() => {
  h.desk = { goalHours: 72, canPickLead: true, proposals: [row()] } as unknown as DeskList;
  h.refetch.mockReset().mockImplementation(async () => ({ data: h.desk }));
});
afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("the step card", () => {
  function Harness({ busy = false, onBack }: { busy?: boolean; onBack?: () => void }) {
    const [open, setOpen] = useState(true);
    const [step, setStep] = useState(1);
    return (
      <>
        <div data-pill-behind="" data-testid="page">
          page words
          <button type="button" onClick={() => setOpen(true)}>
            reopen
          </button>
        </div>
        <StepCard
          open={open}
          onOpenChange={setOpen}
          stepKey={String(step)}
          marker={STEP_CARD_COPY.stepOf(step, 2)}
          title={`Title ${step}`}
          intro="One plain line."
          onBack={onBack ?? (step > 1 ? () => setStep(1) : null)}
          busy={busy}
          aside={<button type="button">aside</button>}
          footer={
            <button type="button" onClick={() => setStep(2)}>
              Next
            </button>
          }
          testId="card"
        >
          <p>body {step}</p>
        </StepCard>
      </>
    );
  }

  it("softens the page behind with the shared focus blur while open, and gives it back on close", async () => {
    render(<Harness />);
    const page = screen.getByTestId("page");
    expect(page.style.filter).toBe(FOCUS_BLUR_CSS.filter);
    expect(page.style.opacity).toBe(String(FOCUS_BLUR_CSS.opacity));
    fireEvent.click(screen.getByRole("button", { name: STEP_CARD_COPY.close }));
    await waitFor(() => expect(screen.queryByTestId("card")).toBeNull());
    expect(page.style.filter).toBe("");
    expect(page.style.opacity).toBe("");
  });

  it("shows the marker above the title, one line under it, and moves to the next step in the same card", () => {
    render(<Harness />);
    const first = screen.getByTestId("card");
    expect(within(first).getByRole("heading", { name: "Title 1" })).toBeTruthy();
    expect(within(first).getByText(STEP_CARD_COPY.stepOf(1, 2))).toBeTruthy();
    expect(within(first).queryByRole("button", { name: STEP_CARD_COPY.back })).toBeNull();
    fireEvent.click(within(first).getByRole("button", { name: "Next" }));
    const second = screen.getByTestId("card");
    expect(second).toBe(first);
    expect(within(second).getByText("body 2")).toBeTruthy();
    fireEvent.click(within(second).getByRole("button", { name: STEP_CARD_COPY.back }));
    expect(within(screen.getByTestId("card")).getByText("body 1")).toBeTruthy();
  });

  it("H1: a card opened again measures its step afresh and never comes back 0px tall", async () => {
    const observers: Array<() => void> = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private fn: () => void) {
          observers.push(fn);
        }
        observe() {}
        disconnect() {}
      },
    );
    const height = vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
      return this.isConnected && this.classList.contains("step-card__pane") ? 320 : 0;
    });
    try {
      render(<Harness />);
      const viewport = () => screen.getByTestId("card").querySelector(".step-card__viewport") as HTMLElement;
      await waitFor(() => expect(viewport().style.getPropertyValue("--step-card-h")).toBe("320px"));
      fireEvent.click(screen.getByRole("button", { name: STEP_CARD_COPY.close }));
      await waitFor(() => expect(screen.queryByTestId("card")).toBeNull());
      act(() => observers.forEach((fn) => fn()));
      fireEvent.click(screen.getByRole("button", { name: "reopen" }));
      await waitFor(() => expect(viewport().style.getPropertyValue("--step-card-h")).toBe("320px"));
      expect(viewport().style.getPropertyValue("--step-card-h")).not.toBe("0px");
    } finally {
      height.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("M2: focus goes back to the button that opened the card", async () => {
    function Opener() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            open it
          </button>
          <StepCard open={open} onOpenChange={setOpen} stepKey="one" title="One" testId="card" />
        </>
      );
    }
    render(<Opener />);
    const button = screen.getByRole("button", { name: "open it" });
    button.focus();
    fireEvent.click(button);
    await screen.findByTestId("card");
    fireEvent.keyDown(screen.getByTestId("card"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("card")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(button));
  });

  it("M3: flags the root while open, so the Home orb rests under the blur", async () => {
    render(<Harness />);
    expect(document.documentElement.hasAttribute("data-step-card-open")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: STEP_CARD_COPY.close }));
    await waitFor(() => expect(screen.queryByTestId("card")).toBeNull());
    expect(document.documentElement.hasAttribute("data-step-card-open")).toBe(false);
  });

  it("L2: the step marker is read once", () => {
    render(<StepCard open onOpenChange={() => undefined} stepKey="s" title="T" hideTitle marker="Step 2 of 3" testId="card" />);
    const markers = [...screen.getByTestId("card").querySelectorAll("[data-step-marker]")];
    expect(markers.filter((m) => m.getAttribute("aria-hidden") !== "true" && !m.closest("[aria-hidden='true']"))).toHaveLength(1);
  });

  it("closes on Escape, but holds still while it saves", async () => {
    const { unmount } = render(<Harness busy />);
    fireEvent.keyDown(screen.getByTestId("card"), { key: "Escape" });
    expect(screen.getByTestId("card")).toBeTruthy();
    expect((screen.getByRole("button", { name: STEP_CARD_COPY.close }) as HTMLButtonElement).disabled).toBe(true);
    unmount();
    render(<Harness />);
    fireEvent.keyDown(screen.getByTestId("card"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("card")).toBeNull());
  });
});

describe("the proposal step card", () => {
  it("a pasted brief fills only the empty fields, says Lasso filled them, and nothing is saved until Next", async () => {
    const p = props();
    render(<ProposalFlow {...p} />);
    await ready();
    expect(marker()).toBe(STEP_CARD_COPY.stepOf(1, 3));
    fireEvent.change(field(FLOW_COPY.start.askLabel), { target: { value: "My own words" } });
    const brief = field(FLOW_COPY.start.brief);
    fireEvent.change(brief, { target: { value: PASTE } });
    fireEvent.paste(brief, { clipboardData: { getData: () => PASTE } });
    await waitFor(() => expect(p.tools.read).toHaveBeenCalledWith(PASTE));
    await waitFor(() => expect(field(PROPOSAL_CARD_COPY.client).value).toBe("Marrowfield Health"));
    expect(field(FLOW_COPY.start.askLabel).value).toBe("My own words");
    expect(field(PROPOSAL_CARD_COPY.due).value).toBe("2099-11-27");
    expect(within(card()).getByText(FLOW_COPY.start.filled("Lasso"))).toBeTruthy();
    expect(p.tools.create).not.toHaveBeenCalled();
    fireEvent.click(within(card()).getByRole("button", { name: FLOW_COPY.start.next }));
    await screen.findByTestId("pick-lead");
    expect(p.tools.create).toHaveBeenCalledTimes(1);
    expect((p.tools.create as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toMatchObject({ client_id: MARROW, title: "My own words", notes: PASTE });
    expect(marker()).toBe(STEP_CARD_COPY.stepOf(2, 3));
    // The lead sheet's ask is the Send step.
    fireEvent.click(screen.getByRole("button", { name: "to the ask" }));
    expect(marker()).toBe(STEP_CARD_COPY.stepOf(3, 3));
  });

  it("a brief that cannot be read leaves the fields open to type in, with the reason", async () => {
    const p = props();
    (p.tools.read as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("down"));
    render(<ProposalFlow {...p} />);
    await ready();
    fireEvent.change(field(FLOW_COPY.start.brief), { target: { value: PASTE } });
    fireEvent.click(within(card()).getByRole("button", { name: FLOW_COPY.start.fill }));
    expect(await within(card()).findByText(PROPOSAL_CARD_COPY.readFailed)).toBeTruthy();
    expect(field(PROPOSAL_CARD_COPY.client).disabled).toBe(false);
  });

  it("after the lead, shows exactly who and which documents, then Send shares them and says so", async () => {
    const p = props();
    render(<ProposalFlow {...p} />);
    await ready();
    fireEvent.change(field(PROPOSAL_CARD_COPY.client), { target: { value: "Marrowfield Health" } });
    fireEvent.change(field(FLOW_COPY.start.askLabel), { target: { value: "A review" } });
    fireEvent.click(within(card()).getByRole("button", { name: FLOW_COPY.start.next }));
    fireEvent.click(await screen.findByRole("button", { name: "lead done" }));
    expect(await within(card()).findByText(FLOW_COPY.send.title("Christy"))).toBeTruthy();
    expect(within(card()).getByText("Christy Johnson")).toBeTruthy();
    expect(within(card()).getByText("Marrowfield RFP.pdf")).toBeTruthy();
    expect(within(card()).getByText("Last year's review.docx")).toBeTruthy();
    fireEvent.click(within(card()).getByRole("button", { name: FLOW_COPY.send.send }));
    await waitFor(() => expect(p.sendDocs).toHaveBeenCalledWith("p-new", true));
    expect(await within(card()).findByText(FLOW_COPY.done.sent("Christy"))).toBeTruthy();
  });

  it("a lead sheet that closes while it said it was saving never leaves the card stuck open", async () => {
    const p = props();
    render(<ProposalFlow {...p} />);
    await ready();
    fireEvent.change(field(PROPOSAL_CARD_COPY.client), { target: { value: "Marrowfield Health" } });
    fireEvent.change(field(FLOW_COPY.start.askLabel), { target: { value: "A review" } });
    fireEvent.click(within(card()).getByRole("button", { name: FLOW_COPY.start.next }));
    fireEvent.click(await screen.findByRole("button", { name: "sent and closed" }));
    await within(card()).findByText(FLOW_COPY.send.title("Christy"));
    expect((within(card()).getByRole("button", { name: STEP_CARD_COPY.close }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("a refused send keeps the documents step with the plain line", async () => {
    const p = props({ sendDocs: vi.fn(async () => ({ ok: false as const, problem: SEND_DOCS_COPY.noLead })) });
    render(<ProposalFlow {...p} />);
    await ready();
    fireEvent.change(field(PROPOSAL_CARD_COPY.client), { target: { value: "Marrowfield Health" } });
    fireEvent.change(field(FLOW_COPY.start.askLabel), { target: { value: "A review" } });
    fireEvent.click(within(card()).getByRole("button", { name: FLOW_COPY.start.next }));
    fireEvent.click(await screen.findByRole("button", { name: "lead done" }));
    fireEvent.click(await within(card()).findByRole("button", { name: FLOW_COPY.send.send }));
    expect(await within(card()).findByText(SEND_DOCS_COPY.noLead)).toBeTruthy();
    expect(within(card()).getByText(FLOW_COPY.send.title("Christy"))).toBeTruthy();
  });

  it("with nothing to send, the lead step goes straight to the last word", async () => {
    h.desk = { goalHours: 72, canPickLead: true, proposals: [row({ leadDocs: "sent" })] };
    const p = props();
    render(<ProposalFlow {...p} />);
    await ready();
    fireEvent.change(field(PROPOSAL_CARD_COPY.client), { target: { value: "Marrowfield Health" } });
    fireEvent.change(field(FLOW_COPY.start.askLabel), { target: { value: "A review" } });
    fireEvent.click(within(card()).getByRole("button", { name: FLOW_COPY.start.next }));
    fireEvent.click(await screen.findByRole("button", { name: "lead done" }));
    expect(await within(card()).findByText(FLOW_COPY.done.title("Marrowfield Health"))).toBeTruthy();
    expect(p.sendDocs).not.toHaveBeenCalled();
  });

  it("a Member pastes the brief and passes it to an admin; nothing is started and no proposals are read", async () => {
    const p = props({ mayStart: false });
    render(<ProposalFlow {...p} />);
    expect(marker()).toBe(STEP_CARD_COPY.stepOf(1, 2));
    fireEvent.change(within(card()).getByLabelText(FLOW_COPY.brief.label), { target: { value: PASTE } });
    fireEvent.click(within(card()).getByRole("button", { name: FLOW_COPY.brief.next }));
    expect(card().querySelector(".step-card__pane:not([data-leaving]) .flow-quote")?.textContent).toBe(PASTE);
    const tell = await within(card()).findByRole("button", { name: BRIEF_PASS_COPY.tell("Maren") });
    fireEvent.click(tell);
    expect(await within(card()).findByText(BRIEF_PASS_COPY.told("Maren"))).toBeTruthy();
    expect(p.passTools.pass).toHaveBeenCalledWith(PASTE);
    expect(p.tools.create).not.toHaveBeenCalled();
    expect(p.tools.read).not.toHaveBeenCalled();
  });

  it("asks for nothing before it is opened", () => {
    const p = props({ open: false, woken: false, mayStart: false });
    render(<ProposalFlow {...p} />);
    expect(p.passTools.admins).not.toHaveBeenCalled();
    expect(screen.queryByTestId("proposal-flow")).toBeNull();
  });

  it("Ask Lasso about this closes the card keeping what was typed, opens the chat once with the step, and the way back restores it", async () => {
    function Owner() {
      const [open, setOpen] = useState(true);
      return <ProposalFlow {...props({ open, onOpenChange: setOpen })} />;
    }
    const heard: (PillCardContext | null)[] = [];
    const listen = (event: Event) => heard.push((event as CustomEvent<PillCardContext | null>).detail);
    window.addEventListener(PILL_OPEN_EVENT, listen);
    try {
      render(<Owner />);
      await ready();
      fireEvent.change(field(FLOW_COPY.start.askLabel), { target: { value: "Kept words" } });
      expect(heard).toHaveLength(0);
      fireEvent.click(within(card()).getByRole("button", { name: STEP_CARD_COPY.askAbout("Lasso") }));
      await waitFor(() => expect(screen.queryByTestId("proposal-flow")).toBeNull());
      expect(heard).toHaveLength(1);
      expect(heard[0]!.label).toBe(FLOW_COPY.start.title);
      act(() => heard[0]!.reopen());
      expect(await screen.findByTestId("proposal-flow")).toBeTruthy();
      expect(field(FLOW_COPY.start.askLabel).value).toBe("Kept words");
    } finally {
      window.removeEventListener(PILL_OPEN_EVENT, listen);
    }
  });

  it("copy names Lasso, never 'it', and the step card has no em dashes", async () => {
    render(<ProposalFlow {...props()} />);
    await ready();
    expect(card().textContent).not.toMatch(/—/);
    expect(card().textContent).toContain("Lasso fills in the rest");
  });
});

describe("the chat opens only when asked", () => {
  it("the open event is the only thing that opens the pill from a card", async () => {
    const { openChatPill } = await import("@/lib/chat-pill-shared");
    const heard = vi.fn();
    window.addEventListener(PILL_OPEN_EVENT, heard);
    openChatPill();
    expect(heard).toHaveBeenCalledTimes(1);
    window.removeEventListener(PILL_OPEN_EVENT, heard);
  });
});

describe("the Lead decides the final on a card", () => {
  it("the row says where it is; Decide the final opens the block on a card", async () => {
    const tools = { choose: vi.fn(), draft: vi.fn(), upload: vi.fn() };
    render(<LeadFinalCard proposalId="p1" client="Harbor Health" final={null} documents={[]} tools={tools as never} />);
    expect(screen.getByText(FINAL_CARD_COPY.notYet)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: FINAL_CARD_COPY.decide }));
    const final = await screen.findByTestId("lead-final-card");
    expect(within(final).getByRole("heading", { name: FINAL_CARD_COPY.title })).toBeTruthy();
    expect(within(final).getByRole("button", { name: FINAL_COPY.upload })).toBeTruthy();
    expect(within(final).getByRole("button", { name: FINAL_COPY.draft })).toBeTruthy();
    await act(async () => {
      fireEvent.click(within(final).getByRole("button", { name: FINAL_CARD_COPY.close }));
    });
    await waitFor(() => expect(screen.queryByTestId("lead-final-card")).toBeNull());
  });

  it("with a final chosen, the row's Send for approval opens the card on step 2, and Send there is PR 303's own call", async () => {
    const ask = vi.fn(async () => ({ ok: true as const }));
    const final = { itemId: "d1", title: "Harbor final v2", source: "document", chosenAt: "2026-11-21T10:00:00Z", gone: false } as never;
    render(
      <LeadFinalCard
        proposalId="p1"
        client="Harbor Health"
        final={final}
        documents={[]}
        tools={{ choose: vi.fn(), draft: vi.fn(), upload: vi.fn() } as never}
        approval={{ stage: "ready_to_send", view: null, ask }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: APPROVAL_COPY.send }));
    expect(ask).not.toHaveBeenCalled();
    const card = await screen.findByTestId("lead-final-card");
    expect(card.querySelector(".step-card__pane:not([data-leaving]) [data-step-marker]")?.textContent).toBe(STEP_CARD_COPY.stepOf(2, 2));
    expect(within(card).getByText("Harbor final v2")).toBeTruthy();
    fireEvent.click(within(card).getByRole("button", { name: APPROVAL_COPY.send }));
    await waitFor(() => expect(ask).toHaveBeenCalledWith(false));
  });

  it("with no final yet, step 1 cannot go on to send it", async () => {
    render(
      <LeadFinalCard
        proposalId="p1"
        client="Harbor Health"
        final={null}
        documents={[]}
        tools={{ choose: vi.fn(), draft: vi.fn(), upload: vi.fn() } as never}
        approval={{ stage: "final_needed", view: null, ask: vi.fn() }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: FINAL_CARD_COPY.decide }));
    const card = await screen.findByTestId("lead-final-card");
    expect((within(card).getByRole("button", { name: FINAL_CARD_COPY.next }) as HTMLButtonElement).disabled).toBe(true);
  });
});

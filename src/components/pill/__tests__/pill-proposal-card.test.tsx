// @vitest-environment jsdom
// 20 Nov 2026, chat pill PR 3b (D-111): the proposal card in the chat. It reads the paste, shows only what the brief
// says (asking for what it does not), takes documents, starts the proposal through New proposal's own call, becomes the
// lead sheet, and flies to Proposals. Nothing is saved before "Start the proposal"; abandoned uploads are removed.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChatPill } from "@/components/pill/ChatPill";
import {
  PillBriefPass,
  PillProposalCard,
  type PassTools,
  type ProposalCardTools,
} from "@/components/pill/PillProposalCard";
import type { BriefReading } from "@/lib/brief-read-shared";
import { PILL_COPY } from "@/lib/chat-pill-shared";
import { FIRM_BRAIN_LIMIT_COPY, FIRM_BRAIN_LIMIT_STATUS } from "@/lib/firm-brain-limit-shared";
import { BRIEF_PASS_COPY, PROPOSAL_CARD_COPY as COPY } from "@/lib/pill-proposal-shared";

vi.mock("@/components/layout/BrandLockup", () => ({ BrandMark: () => <i data-mark="" /> }));
vi.mock("sonner", () => ({ toast: vi.fn() }));

afterEach(cleanup);

const HARBOR = "22222222-2222-4222-8222-222222222222";
const PASTE = "Harbor Health wants a staffing model review, due Friday.";
const READING: BriefReading = {
  client: { name: "Harbor Health", id: HARBOR },
  ask: "a staffing model review",
  due: { phrase: "Friday", date: "2026-11-27" },
  notes: PASTE,
  readBy: "model",
};

function tools(over: Partial<ProposalCardTools> = {}) {
  const t: ProposalCardTools = {
    profileId: "33333333-3333-4333-8333-333333333333",
    goalHours: 72,
    read: vi.fn(async () => READING),
    clients: vi.fn(async () => [{ id: HARBOR, name: "Harbor Health" }]),
    capture: vi.fn(async (files: File[]) => ({
      ids: files.map((_, i) => `44444444-4444-4444-8444-44444444444${i}`),
      failures: [],
    })),
    discard: vi.fn(async () => {}),
    create: vi.fn(async () => ({ ok: true as const, id: "p-new" })),
    leadStep: (id, done) => (
      <button type="button" data-testid="lead-step" data-proposal={id} onClick={done}>
        picked
      </button>
    ),
    land: vi.fn(async () => {}),
    ...over,
  };
  return t;
}

const card = () => document.querySelector("[data-proposal-card]") as HTMLElement;
const start = () => screen.getByRole("button", { name: COPY.start });

describe("the proposal card", () => {
  it("reads the paste, then shows the client, the ask and the due date the brief gave, and saves nothing yet", async () => {
    const t = tools();
    render(<PillProposalCard text={PASTE} tools={t} reduceMotion />);
    expect(card().getAttribute("data-proposal-card")).toBe("reading");
    expect(screen.getByText(COPY.reading)).toBeTruthy();
    await waitFor(() => expect(card().getAttribute("data-proposal-card")).toBe("check"));
    expect(t.read).toHaveBeenCalledWith(PASTE);
    expect((screen.getByLabelText(COPY.client) as HTMLInputElement).value).toBe("Harbor Health");
    expect((screen.getByLabelText(COPY.ask) as HTMLInputElement).value).toBe(
      "a staffing model review",
    );
    expect((screen.getByLabelText(COPY.due) as HTMLInputElement).value).toBe("2026-11-27");
    expect(screen.getByText("“Friday” in the brief")).toBeTruthy();
    expect(screen.getByText(COPY.clockLine(72))).toBeTruthy();
    expect(t.create).not.toHaveBeenCalled();
  });

  it("asks for what the brief does not say, and will not start without a client and an ask", async () => {
    const t = tools({
      read: vi.fn(async () => ({ ...READING, client: null, ask: null, due: null })),
    });
    render(<PillProposalCard text={PASTE} tools={t} reduceMotion />);
    await waitFor(() => expect(screen.getByText(COPY.noClient)).toBeTruthy());
    expect(screen.getByText(COPY.noAsk)).toBeTruthy();
    expect(screen.getByText(COPY.noDue)).toBeTruthy();
    expect((start() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(COPY.client), { target: { value: "Harbor Health" } });
    expect((start() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(COPY.ask), { target: { value: "Staffing review" } });
    expect((start() as HTMLButtonElement).disabled).toBe(false);
  });

  it("takes dropped documents, starts the proposal once with them, becomes the lead sheet, then flies to Proposals", async () => {
    const t = tools();
    render(<PillProposalCard text={PASTE} tools={t} reduceMotion />);
    await waitFor(() => expect(card().getAttribute("data-proposal-card")).toBe("check"));
    const drop = card().querySelector(".chat-pill__drop") as HTMLElement;
    const rfp = new File(["x"], "Harbor Health RFP.pdf", { type: "application/pdf" });
    fireEvent.drop(drop, { dataTransfer: { files: [rfp] } });
    await waitFor(() => expect(screen.getByText("Harbor Health RFP.pdf")).toBeTruthy());
    const button = start();
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByTestId("lead-step")).toBeTruthy());
    expect(t.create).toHaveBeenCalledTimes(1);
    expect(t.create).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: HARBOR,
        title: "a staffing model review",
        client_due_on: "2026-11-27",
        notes: PASTE,
        work_item_ids: ["44444444-4444-4444-8444-444444444440"],
      }),
    );
    expect(screen.getByTestId("lead-step").getAttribute("data-proposal")).toBe("p-new");
    expect(screen.getByText(COPY.next)).toBeTruthy();
    fireEvent.click(screen.getByTestId("lead-step"));
    await waitFor(() =>
      expect(t.land).toHaveBeenCalledWith(expect.any(HTMLElement), "p-new", "Harbor Health"),
    );
    // A started proposal keeps its documents when the card goes away.
    cleanup();
    expect(t.discard).not.toHaveBeenCalled();
  });

  it("a refusal from the server keeps the card open with its words, and nothing moves on", async () => {
    const t = tools({
      create: vi.fn(async () => ({
        ok: false as const,
        problem: "Only an admin can add a new client.",
      })),
    });
    render(<PillProposalCard text={PASTE} tools={t} reduceMotion />);
    await waitFor(() => expect(card().getAttribute("data-proposal-card")).toBe("check"));
    fireEvent.click(start());
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe("Only an admin can add a new client."),
    );
    expect(card().getAttribute("data-proposal-card")).toBe("check");
    expect(t.land).not.toHaveBeenCalled();
  });

  it("uploads nothing until Start, so a card left behind leaves nothing in the person's work (QA M2 of PR 296)", async () => {
    const t = tools();
    const view = render(<PillProposalCard text={PASTE} tools={t} reduceMotion />);
    await waitFor(() => expect(card().getAttribute("data-proposal-card")).toBe("check"));
    fireEvent.drop(card().querySelector(".chat-pill__drop") as HTMLElement, {
      dataTransfer: { files: [new File(["x"], "a.pdf")] },
    });
    await waitFor(() => expect(screen.getByText("a.pdf")).toBeTruthy());
    expect(t.capture).not.toHaveBeenCalled();
    view.unmount();
    expect(t.capture).not.toHaveBeenCalled();
    expect(t.discard).not.toHaveBeenCalled();
  });

  it("a document that fails to upload on Start starts nothing and removes what did upload", async () => {
    const capture = vi
      .fn()
      .mockResolvedValueOnce({ ids: ["44444444-4444-4444-8444-444444444440"], failures: [] })
      .mockResolvedValueOnce({ ids: [], failures: [{ name: "b.pdf", reason: "too big" }] });
    const t = tools({ capture });
    render(<PillProposalCard text={PASTE} tools={t} reduceMotion />);
    await waitFor(() => expect(card().getAttribute("data-proposal-card")).toBe("check"));
    fireEvent.drop(card().querySelector(".chat-pill__drop") as HTMLElement, {
      dataTransfer: { files: [new File(["x"], "a.pdf"), new File(["y"], "b.pdf")] },
    });
    fireEvent.click(start());
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(COPY.docsFailed("b.pdf")),
    );
    expect(t.create).not.toHaveBeenCalled();
    expect(t.discard).toHaveBeenCalledWith(["44444444-4444-4444-8444-444444444440"]);
    expect(card().getAttribute("data-proposal-card")).toBe("check");
  });

  it("a refused start removes the documents it uploaded", async () => {
    const t = tools({ create: vi.fn(async () => ({ ok: false as const, problem: "No." })) });
    render(<PillProposalCard text={PASTE} tools={t} reduceMotion />);
    await waitFor(() => expect(card().getAttribute("data-proposal-card")).toBe("check"));
    fireEvent.drop(card().querySelector(".chat-pill__drop") as HTMLElement, {
      dataTransfer: { files: [new File(["x"], "a.pdf")] },
    });
    fireEvent.click(start());
    await waitFor(() =>
      expect(t.discard).toHaveBeenCalledWith(["44444444-4444-4444-8444-444444444440"]),
    );
  });

  it("offers to ask the firm instead, before anything is started", async () => {
    const onAskInstead = vi.fn();
    render(
      <PillProposalCard text={PASTE} tools={tools()} reduceMotion onAskInstead={onAskInstead} />,
    );
    await waitFor(() => expect(card().getAttribute("data-proposal-card")).toBe("check"));
    fireEvent.click(screen.getByRole("button", { name: COPY.askInstead }));
    expect(onAskInstead).toHaveBeenCalledTimes(1);
  });

  it("says the daily limit plainly when the brief cannot be read, and reads again on Try again", async () => {
    const read = vi
      .fn()
      .mockRejectedValueOnce(new Response("limit", { status: FIRM_BRAIN_LIMIT_STATUS }))
      .mockResolvedValueOnce(READING);
    render(<PillProposalCard text={PASTE} tools={tools({ read })} reduceMotion />);
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(FIRM_BRAIN_LIMIT_COPY.shown),
    );
    fireEvent.click(screen.getByRole("button", { name: COPY.tryAgain }));
    await waitFor(() => expect(card().getAttribute("data-proposal-card")).toBe("check"));
  });

  it("builds step by step at the prototype's pace, unless motion is reduced", async () => {
    vi.useFakeTimers();
    try {
      render(<PillProposalCard text={PASTE} tools={tools()} reduceMotion={false} />);
      expect(screen.getByText(COPY.reading)).toBeTruthy();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
      });
      expect(screen.getByText(COPY.askStep)).toBeTruthy();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
      });
      expect(screen.getByText(COPY.dueStep)).toBeTruthy();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
      expect(card().getAttribute("data-proposal-card")).toBe("check");
    } finally {
      vi.useRealTimers();
    }
  });

  it("with no one to pick the lead, goes straight to Proposals after starting", async () => {
    const t = tools({ leadStep: null });
    render(<PillProposalCard text={PASTE} tools={t} reduceMotion />);
    await waitFor(() => expect(card().getAttribute("data-proposal-card")).toBe("check"));
    fireEvent.click(start());
    await waitFor(() => expect(t.land).toHaveBeenCalledTimes(1));
  });
});

describe("a Member's paste", () => {
  function pass(over: Partial<PassTools> = {}) {
    return {
      admins: vi.fn(async () => ({ name: "Maren Hollis", count: 1 })),
      pass: vi.fn(async () => ({ ok: true as const, admins: 1 })),
      ...over,
    };
  }

  it("offers to tell the admin by name, and tells them only on the press", async () => {
    const t = pass();
    render(<PillBriefPass text={PASTE} tools={t} />);
    expect(screen.getByText(BRIEF_PASS_COPY.line(null))).toBeTruthy();
    const button = await screen.findByRole("button", {
      name: BRIEF_PASS_COPY.tell("Maren Hollis"),
    });
    expect(t.pass).not.toHaveBeenCalled();
    fireEvent.click(button);
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(BRIEF_PASS_COPY.told("Maren Hollis")),
    );
    expect(t.pass).toHaveBeenCalledWith(PASTE);
  });

  it("says plainly when it did not reach them, and can be pressed again", async () => {
    const t = pass({
      pass: vi.fn(async () => ({ ok: false as const, problem: BRIEF_PASS_COPY.tooMany })),
    });
    render(<PillBriefPass text={PASTE} tools={t} />);
    fireEvent.click(
      await screen.findByRole("button", { name: BRIEF_PASS_COPY.tell("Maren Hollis") }),
    );
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(BRIEF_PASS_COPY.tooMany),
    );
    expect(
      (
        screen.getByRole("button", {
          name: BRIEF_PASS_COPY.tell("Maren Hollis"),
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it("with no admin to tell, says so and offers nothing", async () => {
    render(
      <PillBriefPass
        text={PASTE}
        tools={pass({ admins: vi.fn(async () => ({ name: null, count: 0 })) })}
      />,
    );
    await waitFor(() => expect(screen.getByText(BRIEF_PASS_COPY.noAdmin)).toBeTruthy());
    expect(
      (screen.getByRole("button", { name: BRIEF_PASS_COPY.tell(null) }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});

describe("the pill tells a brief from a question", () => {
  function pill(withBrief: boolean) {
    const onAsk = vi.fn(() => new Promise<never>(() => {}));
    const render_ = vi.fn((text: string) => <div data-testid="brief-card">{text}</div>);
    render(
      <ChatPill
        brandName="Lasso"
        askLabel="Ask Lasso"
        firstName="Maren"
        place="home"
        canAsk
        questionMax={500}
        starters={[{ text: "Start a proposal: Harbor Health wants a review", starter: "similar" }]}
        onAsk={onAsk}
        onOpenOnCanvas={vi.fn()}
        onOpenSource={vi.fn()}
        reduceMotion
        initialMode="open"
        brief={withBrief ? { render: render_ } : null}
      />,
    );
    const box = screen.getByLabelText(PILL_COPY.label) as HTMLTextAreaElement;
    const send = (text: string) => {
      fireEvent.change(box, { target: { value: text } });
      fireEvent.keyDown(box, { key: "Enter" });
    };
    return { onAsk, render_, box, send };
  }

  it("draws a pasted brief as the card and never asks the firm with it", () => {
    const p = pill(true);
    expect(p.box.placeholder).toBe(PILL_COPY.placeholderBrief);
    p.send(PASTE);
    expect(screen.getByTestId("brief-card").textContent).toBe(PASTE);
    expect(p.onAsk).not.toHaveBeenCalled();
  });

  it("still asks the firm a question", async () => {
    const p = pill(true);
    p.send("What did teams learn on staffing reviews?");
    await waitFor(() => expect(p.onAsk).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("brief-card")).toBeNull();
  });

  it("a starter is always a question, whatever it says", async () => {
    const p = pill(true);
    fireEvent.click(
      screen.getByRole("button", { name: "Start a proposal: Harbor Health wants a review" }),
    );
    await waitFor(() => expect(p.onAsk).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("brief-card")).toBeNull();
  });

  it("without the brief card, a paste is asked of the firm as before", async () => {
    const p = pill(false);
    expect(p.box.placeholder).toBe(PILL_COPY.placeholder);
    p.send(PASTE);
    await waitFor(() => expect(p.onAsk).toHaveBeenCalledTimes(1));
  });
});

describe("asking the firm instead (QA M1 of PR 296)", () => {
  it("takes the card away and asks the same words of the firm", async () => {
    const onAsk = vi.fn(() => new Promise<never>(() => {}));
    render(
      <ChatPill
        brandName="Lasso"
        askLabel="Ask Lasso"
        firstName="Maren"
        place="home"
        canAsk
        questionMax={500}
        starters={[]}
        onAsk={onAsk}
        onOpenOnCanvas={vi.fn()}
        onOpenSource={vi.fn()}
        reduceMotion
        initialMode="open"
        brief={{
          render: (_text, context) => (
            <button type="button" onClick={context.askInstead}>
              instead
            </button>
          ),
        }}
      />,
    );
    const box = screen.getByLabelText(PILL_COPY.label) as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: PASTE } });
    fireEvent.keyDown(box, { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "instead" }));
    await waitFor(() => expect(onAsk).toHaveBeenCalledWith(PASTE, null));
    expect(screen.queryByRole("button", { name: "instead" })).toBeNull();
  });
});

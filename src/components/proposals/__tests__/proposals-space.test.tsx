// @vitest-environment jsdom
// 20 Nov 2026 (Liam, D-86, "the mix it starts on"): Up next with the page's one filled button, the clock with its
// goal mark, the lead as a chip, the rare changes under More, and a skeleton first load.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useRef } from "react";
import { useRowFlip } from "@/components/proposals/use-row-flip";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LeadChip } from "@/components/proposals/LeadChip";
import { ProposalDesk } from "@/components/proposals/ProposalDesk";
import { SkeletonFrame } from "@/components/ui/skeleton-frame";
import type { AskView } from "@/lib/lead-ask-shared";
import { askWord, DESK_COPY, LEAD_COPY, nextStep, pastWorkByLead, REVEAL_COPY, SENT_COPY, upNextId, WIN_COPY, type DeskList, type DeskProposal } from "@/lib/proposal-desk-shared";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/proposals">{children}</a>,
}));

afterEach(cleanup);

const NOW = new Date("2026-11-20T12:00:00Z");
const hoursAgo = (n: number) => new Date(NOW.getTime() - n * 3_600_000).toISOString();
const proposal = (over: Partial<DeskProposal>): DeskProposal => ({
  id: "p", title: "Community health needs assessment", clientName: "Pellham County Public Health", ownerName: "Harper Quinn", mine: false, status: "open",
  receivedAt: hoursAgo(10), sentAt: null, decidedAt: null, engagementId: null, contextCount: 0, canAct: false, canClose: false, canArchive: false, ...over,
});
const list = (proposals: DeskProposal[]): DeskList => ({ goalHours: 72, canSetGoal: false, canPickLead: false, canAddClient: true, texts: { demo: true, connected: false }, proposals });
const filled = () => screen.getAllByRole("button").filter((b) => /\bbg-ember\b/.test(b.className)).map((b) => b.textContent);
const order = () => Array.from(document.querySelectorAll("[data-proposal-row]")).map((row) => row.getAttribute("data-proposal-row"));
const ask = (over: Partial<AskView>): AskView => ({ name: "Christy Johnson", status: "sent", reply: null, practice: false, waiting: true, ...over });
const sent = async () => ({ ok: true as const });
const win = async () => ({ ok: true as const, engagementId: "e" });

describe("the next step rules", () => {
  it("send first, then the win, only for what this person can do, and nothing on a decided proposal", () => {
    const can = { send: true, win: true };
    expect(nextStep(proposal({ canAct: true }), can)).toBe("send");
    expect(nextStep(proposal({ canAct: true, mine: true, sentAt: hoursAgo(1) }), can)).toBe("win");
    expect(nextStep(proposal({ canAct: true, sentAt: hoursAgo(1) }), can)).toBeNull();
    expect(nextStep(proposal({ canAct: false, mine: false }), can)).toBeNull();
    expect(nextStep(proposal({ canAct: true }), { send: false, win: true })).toBeNull();
    expect(nextStep(proposal({ canAct: true, mine: true, status: "won" }), can)).toBeNull();
    expect(nextStep(proposal({ canAct: true, mine: true, status: "lost" }), can)).toBeNull();
  });

  it("Up next is the first row in reading order this person can move; none when nobody can move anything", () => {
    const rows = [proposal({ id: "theirs" }), proposal({ id: "a", canAct: true }), proposal({ id: "b", canAct: true })];
    expect(upNextId(rows, { send: true, win: true })).toBe("a");
    expect(upNextId(rows, { send: false, win: false })).toBeNull();
    expect(upNextId([], { send: true, win: true })).toBeNull();
  });

  it("the ask in a word follows the same order as its sentence", () => {
    expect(askWord(null)).toBeNull();
    expect(askWord(undefined)).toBeNull();
    expect(askWord(ask({}))).toBe("asked");
    expect(askWord(ask({ status: "delivered" }))).toBe("asked");
    expect(askWord(ask({ reply: "yes", waiting: false }))).toBe("yes");
    expect(askWord(ask({ reply: "no", waiting: false }))).toBe("no");
    expect(askWord(ask({ reply: "stop", waiting: false }))).toBe("stopped");
    expect(askWord(ask({ status: "opted_out", waiting: false }))).toBe("stopped");
    expect(askWord(ask({ status: "undelivered", waiting: false }))).toBe("notArrived");
    expect(askWord(ask({ status: "practice", practice: true }))).toBe("practice");
    expect(askWord(ask({ waiting: false }))).toBe("noReply");
    // QA M1: a practice answer is never a real yes or no on the chip.
    expect(askWord(ask({ status: "practice", practice: true, reply: "yes", waiting: false }))).toBe("practice");
    expect(askWord(ask({ status: "practice", practice: true, reply: "no", waiting: false }))).toBe("practice");
    // QA M2: a refused text was never sent.
    expect(askWord(ask({ status: "rejected", waiting: false }))).toBe("notSent");
    expect(askWord(ask({ status: "failed", waiting: false }))).toBe("notArrived");
    expect(askWord(ask({ status: "expired", waiting: false }))).toBe("notArrived");
  });
});

describe("Up next on the page", () => {
  it("rises to the top with the page's only filled button; the rows it passed keep their order", () => {
    render(
      <ProposalDesk
        now={NOW}
        data={list([
          proposal({ id: "oldest-theirs", receivedAt: hoursAgo(69) }),
          proposal({ id: "mine", receivedAt: hoursAgo(30), mine: true, canAct: true }),
          proposal({ id: "newest", receivedAt: hoursAgo(1), canAct: true }),
        ])}
        onSent={sent}
        onWin={win}
      />,
    );
    expect(order()).toEqual(["mine", "oldest-theirs", "newest"]);
    expect(document.querySelector('[data-proposal-row="mine"]')?.hasAttribute("data-up-next")).toBe(true);
    expect(within(document.querySelector('[data-proposal-row="mine"]') as HTMLElement).getByText("Up next")).toBeTruthy();
    expect(filled()).toEqual([SENT_COPY.mark]);
    expect(screen.getAllByText("Up next")).toHaveLength(1);
    // The others still offer their step, outlined.
    expect(within(document.querySelector('[data-proposal-row="newest"]') as HTMLElement).getByRole("button", { name: SENT_COPY.mark })).toBeTruthy();
  });

  it("once sent, the win becomes the filled step", () => {
    render(<ProposalDesk now={NOW} data={list([proposal({ id: "a", mine: true, canAct: true, sentAt: hoursAgo(2) })])} onSent={sent} onWin={win} />);
    expect(filled()).toEqual([WIN_COPY.record]);
  });

  it("read only, as on Home: no Up next and nothing filled", () => {
    render(<ProposalDesk now={NOW} data={list([proposal({ id: "a", mine: true, canAct: true })])} limit={3} />);
    expect(document.querySelector("[data-up-next]")).toBeNull();
    expect(screen.queryAllByRole("button").filter((b) => /\bbg-ember\b/.test(b.className))).toHaveLength(0);
  });

  it("never on Won or Lost", () => {
    render(<ProposalDesk now={NOW} data={list([proposal({ id: "a", mine: true, canAct: true }), proposal({ id: "w", mine: true, status: "won", decidedAt: hoursAgo(1) })])} onSent={sent} onWin={win} />);
    fireEvent.click(screen.getByRole("button", { name: "Won 1" }));
    expect(document.querySelector("[data-up-next]")).toBeNull();
  });

  it("follows Needs me: the person's own proposal, not someone else's", () => {
    render(<ProposalDesk now={NOW} data={list([proposal({ id: "theirs", canAct: true, receivedAt: hoursAgo(60) }), proposal({ id: "mine", mine: true, canAct: true })])} onSent={sent} />);
    expect(document.querySelector("[data-up-next]")?.getAttribute("data-proposal-row")).toBe("theirs");
    fireEvent.click(screen.getByRole("button", { name: "Needs me 1" }));
    expect(document.querySelector("[data-up-next]")?.getAttribute("data-proposal-row")).toBe("mine");
  });

  it("never shows a fee or a value, whoever is looking", () => {
    render(<ProposalDesk now={NOW} data={list([proposal({ id: "a", canAct: true, contextCount: 2 })])} onSent={sent} />);
    expect(document.body.textContent).not.toMatch(/[$£€]|\bfee\b|\bvalue\b/i);
  });
});

describe("the lead as a chip", () => {
  it("a face with a dot for the ask, the name, and the ask in a word", () => {
    render(<LeadChip name="Christy Johnson" ask="yes" texts="agreed" />);
    expect(document.querySelector("[data-lead-dot]")?.getAttribute("data-lead-dot")).toBe("yes");
    expect(document.querySelector("[data-lead-pill]")?.textContent).toBe("Yes");
    expect(document.querySelector("[data-proposal-lead]")?.textContent).toContain(LEAD_COPY.lead("Christy Johnson"));
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("before an ask it shows whether they agreed to texts; a practice ask shows only the dot", () => {
    render(<LeadChip name="Mina Okafor" ask={null} texts="none" onPick={vi.fn()} />);
    expect(document.querySelector("[data-lead-pill]")?.textContent).toBe("No text agreement");
    expect(document.querySelector("[data-lead-dot]")).toBeNull();
    expect(screen.getByRole("button", { name: LEAD_COPY.change })).toBeTruthy();
    cleanup();
    render(<LeadChip name="Mina Okafor" ask="practice" texts="agreed" />);
    expect(document.querySelector("[data-lead-pill]")).toBeNull();
    expect(document.querySelector("[data-lead-dot]")?.getAttribute("data-lead-dot")).toBe("practice");
  });

  it("with no lead: a dashed Pick a lead for someone who may pick, nothing for anyone else", () => {
    const onPick = vi.fn();
    render(<LeadChip name={undefined} ask={null} onPick={onPick} />);
    fireEvent.click(screen.getByRole("button", { name: LEAD_COPY.pick }));
    expect(onPick).toHaveBeenCalledTimes(1);
    cleanup();
    const { container } = render(<LeadChip name={undefined} ask={null} />);
    expect(container.textContent).toBe("");
  });

  it("a name with markup in it is drawn as text", () => {
    render(<LeadChip name={'<img src=x onerror="alert(1)">'} ask="asked" />);
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByText('<img src=x onerror="alert(1)">')).toBeTruthy();
  });
});

describe("More holds the rare changes", () => {
  it("only what the server allows, by name, and nothing at all when there is none", () => {
    const onClose = vi.fn();
    render(<ProposalDesk now={NOW} data={list([proposal({ id: "a", canAct: true, canClose: true, canArchive: false, sentAt: hoursAgo(1) }), proposal({ id: "b" })])} onSent={sent} onClose={onClose} />);
    expect(document.querySelector('[data-proposal-row="b"] [data-proposal-more]')).toBeNull();
    const trigger = document.querySelector('[data-proposal-row="a"] [data-proposal-more]') as HTMLElement;
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: "mouse" });
    const menu = document.querySelector("[data-proposal-close]") as HTMLElement;
    expect(within(menu).getAllByRole("menuitem").map((item) => item.textContent)).toEqual([SENT_COPY.undo, "Close as lost"]);
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Close as lost" }));
    expect(screen.getByTestId("close-proposal")).toBeTruthy();
  });

  it("Undo sent from the menu takes it back once", async () => {
    const onSent = vi.fn(sent);
    render(<ProposalDesk now={NOW} data={list([proposal({ id: "a", canAct: true, sentAt: hoursAgo(1) })])} onSent={onSent} />);
    fireEvent.pointerDown(document.querySelector("[data-proposal-more]") as HTMLElement, { button: 0, ctrlKey: false, pointerType: "mouse" });
    fireEvent.click(screen.getByRole("menuitem", { name: SENT_COPY.undo }));
    expect(onSent).toHaveBeenCalledTimes(1);
    expect(onSent).toHaveBeenCalledWith("a", false);
  });
});

describe("the clock", () => {
  it("over the goal is red with the exact line; sent in time is the good tint", () => {
    render(<ProposalDesk now={NOW} data={list([proposal({ id: "over", receivedAt: hoursAgo(73) }), proposal({ id: "done", receivedAt: hoursAgo(40), sentAt: hoursAgo(9) })])} />);
    const over = document.querySelector('[data-proposal-row="over"]') as HTMLElement;
    expect(within(over).getByText("Over the 72 hour goal by 1 hour")).toBeTruthy();
    expect((over.querySelector("[data-proposal-clock-bar]")?.firstElementChild as HTMLElement).className).toMatch(/bg-destructive/);
    expect(over.querySelector("[data-proposal-goal-mark]")).not.toBeNull();
    const done = document.querySelector('[data-proposal-row="done"]') as HTMLElement;
    expect(within(done).getByText("Went out in 31 hours")).toBeTruthy();
  });
});

describe("the first load", () => {
  it("is the shared skeleton frame that says Loading proposals to a screen reader, and nothing else", () => {
    render(<SkeletonFrame shape="rows" count={6} label={DESK_COPY.loading} />);
    const status = screen.getByRole("status");
    expect(status.textContent).toBe(DESK_COPY.loading);
    expect(status.querySelector('[aria-hidden="true"]')?.children.length).toBeGreaterThan(0);
  });
});

describe("the board building in, while Record the win works", () => {
  it("names each real step in order, leaving out the ones with nothing to do", () => {
    expect(REVEAL_COPY.stages("Larkspur Senior Living", 3, "Christy Johnson")).toEqual([
      "Making the team board for Larkspur Senior Living",
      "Turning your notes into its brief",
      "Putting your 3 context documents on it",
      "Naming Christy Johnson as the lead",
      "Opening the board",
    ]);
    expect(REVEAL_COPY.stages("", 1, "")).toEqual(["Making the team board", "Turning your notes into its brief", "Putting your context document on it", "Opening the board"]);
    expect(REVEAL_COPY.stages("Pellham", 0, "")).toEqual(["Making the team board for Pellham", "Turning your notes into its brief", "Opening the board"]);
  });

  it("shows the brief, the documents and the lead while the board is made, and goes back to the words on a failure", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let finish: (value: { ok: false; problem: string }) => void = () => {};
    const onWin = vi.fn(() => new Promise<{ ok: false; problem: string }>((resolve) => { finish = resolve; }));
    render(
      <ProposalDesk
        now={NOW}
        data={list([proposal({ id: "a", mine: true, canAct: true, sentAt: hoursAgo(1), clientName: "Larkspur Senior Living", contextCount: 2, contextTitles: ["Larkspur brief.docx", "Board memo"], leadName: "Christy Johnson", ownerName: "Maren Hollis" })])}
        onWin={onWin}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: WIN_COPY.record }));
    const dialog = await screen.findByTestId("win-proposal");
    expect(dialog.querySelector("[data-board-reveal]")).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: WIN_COPY.confirm }));
    const reveal = dialog.querySelector("[data-board-reveal]") as HTMLElement;
    expect(reveal).not.toBeNull();
    expect(reveal.querySelectorAll("[data-reveal-document]")).toHaveLength(2);
    expect(reveal.textContent).toContain("Larkspur brief.docx");
    expect(reveal.textContent).toContain("Christy Johnson");
    expect(within(reveal).getByRole("status").textContent).toBe("Making the team board for Larkspur Senior Living");
    act(() => { vi.advanceTimersByTime(REVEAL_COPY.stageMs); });
    expect(within(reveal).getByRole("status").textContent).toBe("Turning your notes into its brief");
    act(() => { vi.advanceTimersByTime(REVEAL_COPY.stageMs * 10); });
    // The last caption holds; it never loops back to the start.
    expect(within(reveal).getByRole("status").textContent).toBe("Opening the board");
    await act(async () => { finish({ ok: false, problem: WIN_COPY.failed }); });
    await waitFor(() => expect(within(dialog).getByRole("alert").textContent).toBe(WIN_COPY.failed));
    expect(dialog.querySelector("[data-board-reveal]")).toBeNull();
    expect(within(dialog).getByText(WIN_COPY.body(2))).toBeTruthy();
    vi.useRealTimers();
  });

  it("a title with markup in it stays text on the little board", async () => {
    const onWin = vi.fn(() => new Promise<never>(() => {}));
    render(<ProposalDesk now={NOW} data={list([proposal({ id: "a", mine: true, canAct: true, contextCount: 1, contextTitles: ['<img src=x onerror="alert(1)">'], ownerName: "Maren Hollis" })])} onWin={onWin} />);
    fireEvent.click(screen.getByRole("button", { name: WIN_COPY.record }));
    fireEvent.click(within(await screen.findByTestId("win-proposal")).getByRole("button", { name: WIN_COPY.confirm }));
    expect(document.querySelector("[data-board-reveal] img")).toBeNull();
  });
});

describe("one thing at a time (D-86)", () => {
  it("opens a row's document titles on Up next and when the lead's yes lands, and keeps them closed otherwise", () => {
    const docs = { mine: true, canAct: true, contextCount: 2, contextTitles: ["Larkspur brief.docx", "Board memo"] };
    render(
      <ProposalDesk
        now={NOW}
        data={list([
          proposal({ id: "next", receivedAt: hoursAgo(60), ...docs }),
          proposal({ id: "quiet", receivedAt: hoursAgo(20), ...docs }),
          proposal({ id: "yes", receivedAt: hoursAgo(10), ...docs, leadName: "Christy Johnson", ask: ask({ reply: "yes", waiting: false }) }),
        ])}
        onSent={sent}
        onWin={() => win()}
      />,
    );
    const row = (id: string) => document.querySelector(`[data-proposal-row="${id}"]`) as HTMLElement;
    expect(row("next").hasAttribute("data-up-next")).toBe(true);
    expect(within(row("next")).getByText("Larkspur brief.docx")).toBeTruthy();
    expect(row("quiet").querySelector("[data-proposal-context-titles]")).toBeNull();
    expect(within(row("quiet")).getByText("2 documents")).toBeTruthy();
    expect(within(row("yes")).getByText("Board memo")).toBeTruthy();
  });

  it("draws Up next's clock as a bolder shape, with the same words", () => {
    render(<ProposalDesk now={NOW} data={list([proposal({ id: "a", canAct: true, receivedAt: hoursAgo(69) }), proposal({ id: "b", receivedAt: hoursAgo(2) })])} onSent={sent} />);
    const bar = (id: string) => document.querySelector(`[data-proposal-row="${id}"] [data-proposal-clock-bar]`) as HTMLElement;
    expect(bar("a").className).toMatch(/h-2\.5/);
    expect(bar("b").className).toMatch(/h-1\.5/);
    expect(within(document.querySelector('[data-proposal-row="a"]') as HTMLElement).getByText("3 hours left of 72")).toBeTruthy();
  });
});

describe("past work beside each name (D-86)", () => {
  it("lists the won proposals each person led, newest first, and nothing from open, lost or unled ones", () => {
    const work = pastWorkByLead([
      proposal({ id: "1", status: "won", decidedAt: "2026-10-01T00:00:00Z", leadContactId: "christy", clientName: "Harrow Water District", title: "Rate study" }),
      proposal({ id: "2", status: "won", decidedAt: "2026-11-01T00:00:00Z", leadContactId: "christy", clientName: "Larkspur Senior Living", title: "Operations review" }),
      proposal({ id: "3", status: "lost", decidedAt: "2026-11-02T00:00:00Z", leadContactId: "adaeze" }),
      proposal({ id: "4", status: "open", leadContactId: "adaeze" }),
      proposal({ id: "5", status: "won", decidedAt: "2026-11-03T00:00:00Z", leadContactId: null }),
    ]);
    expect(work).toEqual({
      christy: [
        { client: "Larkspur Senior Living", title: "Operations review" },
        { client: "Harrow Water District", title: "Rate study" },
      ],
    });
    expect(JSON.stringify(work)).not.toMatch(/\$|fee|value|score|rank/i);
  });
});

describe("QA fixes on the rows", () => {
  it("a practice yes keeps the practice look: hollow dot, no Yes pill, titles stay closed (M1)", () => {
    render(
      <ProposalDesk
        now={NOW}
        data={list([
          proposal({ id: "x", receivedAt: hoursAgo(5) }),
          proposal({ id: "p", mine: true, contextCount: 1, contextTitles: ["Series A notes"], leadName: "Ben Stanton", ask: ask({ name: "Ben Stanton", status: "practice", practice: true, reply: "yes", waiting: false }) }),
        ])}
      />,
    );
    const row = document.querySelector('[data-proposal-row="p"]') as HTMLElement;
    expect(row.querySelector("[data-proposal-lead]")?.getAttribute("data-lead-ask")).toBe("practice");
    expect(row.querySelector("[data-lead-pill]")).toBeNull();
    expect(row.querySelector('[data-lead-dot="practice"]')).not.toBeNull();
    expect(row.querySelector("[data-proposal-context-titles]")).toBeNull();
  });

  it("a refused ask says it was not sent, never that it did not arrive (M2)", () => {
    render(<ProposalDesk now={NOW} data={list([proposal({ id: "r", mine: true, sentAt: hoursAgo(1), leadName: "Christy Johnson", ask: ask({ status: "rejected", waiting: false }) })])} />);
    const row = document.querySelector('[data-proposal-row="r"]') as HTMLElement;
    expect(row.querySelector("[data-lead-pill]")?.textContent).toBe("Not sent");
    expect(row.textContent).toContain("The text was not accepted, so nothing was sent");
    expect(row.textContent).not.toMatch(/did not arrive|Not arrived/);
  });

  it("a sent proposal's bar shows when it went out against the goal (M3)", () => {
    render(<ProposalDesk now={NOW} data={list([proposal({ id: "s", receivedAt: hoursAgo(40), sentAt: hoursAgo(4) })])} />);
    const fill = (document.querySelector('[data-proposal-row="s"] [data-proposal-clock-bar]')?.firstElementChild as HTMLElement).style.width;
    expect(fill).toBe("50%");
  });
});

describe("row glide after a scroll (H1)", () => {
  function List({ tick }: { tick: number }) {
    const ref = useRef<HTMLUListElement>(null);
    useRowFlip(ref);
    return (
      <ul ref={ref} data-tick={tick}>
        <li data-proposal-row="a">A</li>
        <li data-proposal-row="b">B</li>
      </ul>
    );
  }
  it("does not move any row when only the page scrolled between renders, and still glides a row that really moved", () => {
    let scroll = 0;
    let bMoved = 0;
    const rect = (top: number) => ({ top, left: 0, right: 100, bottom: top + 40, width: 100, height: 40, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
    const spy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const base = this.tagName === "UL" ? 100 : this.dataset["proposalRow"] === "a" ? 100 : 150 + bMoved;
      return rect(base - scroll);
    });
    const animate = vi.fn();
    (HTMLElement.prototype as unknown as { animate: unknown }).animate = animate;
    const { rerender } = render(<List tick={0} />);
    scroll = 1200;
    rerender(<List tick={1} />);
    expect(animate).not.toHaveBeenCalled();
    bMoved = 60;
    rerender(<List tick={2} />);
    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate.mock.calls[0]?.[0]?.[0]).toEqual({ transform: "translate(0px, -60px)" });
    spy.mockRestore();
    delete (HTMLElement.prototype as unknown as { animate?: unknown }).animate;
  });
});

// @vitest-environment jsdom
// 20 Nov 2026 (Liam, card Q-67): one sheet where a lead is picked and asked, ending in a confirm. Nothing is saved
// and nothing is sent before the confirm; cancelling at any point leaves everything as it was.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  LedBefore,
  LeadSheet,
  PAST_WORK_SHOWN,
  type LeadSheetStart,
  type PastWork,
} from "@/components/proposals/LeadSheet";
import { ASK_COPY, leadAskBody, SHEET_COPY, type AskPreview } from "@/lib/lead-ask-shared";
import { LEAD_COPY, type DeskProposal } from "@/lib/proposal-desk-shared";
import { MESSAGE_EXAMPLES_COPY } from "@/lib/won-text-shared";
import type { RosterContact } from "@/lib/roster-shared";

afterEach(cleanup);

const person = (id: string, name: string, texts: RosterContact["texts"]): RosterContact => ({
  id,
  name,
  role: null,
  affiliation: "independent",
  firm: null,
  texts,
  agreedOn: null,
  stoppedOn: null,
  confirmed: false,
  changeUntil: null,
  linkPath: `/texts?w=o&c=${id}`,
});
const roster = [person("c1", "Christy Johnson", "agreed"), person("c2", "Mina Okafor", "none")];
const proposal = (over: Partial<DeskProposal> = {}): DeskProposal => ({
  id: "a",
  title: "Review",
  clientName: "Pellham",
  ownerName: "Maren Hollis",
  mine: true,
  status: "open",
  receivedAt: "2026-11-20T09:00:00Z",
  sentAt: null,
  decidedAt: null,
  engagementId: null,
  contextCount: 0,
  canAct: true,
  canClose: true,
  canArchive: true,
  leadContactId: null,
  leadName: null,
  ...over,
});
const words = (name: string) =>
  leadAskBody({
    brandName: "Lasso",
    firmName: "Kestrel Bay Advisory",
    leadName: name,
    askerName: "Maren Hollis",
  });

function open(
  over: {
    start?: LeadSheetStart;
    mode?: "real" | "demo" | "practice";
    lead?: string | null;
    pastWork?: Record<string, PastWork[]>;
    noList?: boolean;
    connected?: boolean;
  } = {},
) {
  const mode = over.mode ?? "real";
  const calls: string[] = [];
  const preview = vi.fn(async (_id: string, contactId: string): Promise<AskPreview> => {
    const who = roster.find((p) => p.id === contactId) as RosterContact;
    return {
      ok: true,
      words: words(who.name),
      name: who.name,
      mode,
      warning: mode === "real" && who.texts !== "agreed" ? ASK_COPY.notAgreedYet(who.name) : null,
    };
  });
  const onSave = vi.fn(async (_id: string, _contact: string | null) => {
    calls.push("save");
    return { ok: true as const };
  });
  const send = vi.fn(async (_id: string, _press: string) => {
    calls.push("send");
    return { ok: true as const, practice: mode === "practice" };
  });
  const onClose = vi.fn();
  const lead = over.lead ?? null;
  render(
    <LeadSheet
      target={{
        proposal: proposal({
          leadContactId: lead,
          leadName: roster.find((p) => p.id === lead)?.name ?? null,
        }),
        start: over.start ?? "pick",
      }}
      roster={over.noList ? undefined : roster}
      wonWords="won"
      demo={mode !== "real"}
      connected={over.connected}
      preview={preview}
      send={send}
      onSave={onSave}
      onClose={onClose}
      pastWork={over.pastWork}
    />,
  );
  return { preview, onSave, send, onClose, calls };
}
const sheet = () => document.querySelector("[data-lead-sheet]") as HTMLElement;
const pick = (id: string) =>
  fireEvent.click(sheet().querySelector(`[data-lead-person="${id}"]`) as HTMLElement);
const press = (name: string) => fireEvent.click(within(sheet()).getByRole("button", { name }));

describe("the one sheet: pick, see their text, confirm", () => {
  it("picking fills the phone with that person's whole message, and saves and sends nothing", async () => {
    const h = open();
    expect(sheet().getAttribute("data-lead-sheet")).toBe("pick");
    expect(within(sheet()).getByText(SHEET_COPY.title("Pellham"))).toBeTruthy();
    expect(sheet().querySelector("[data-ask-words]")).toBeNull();
    expect(
      (within(sheet()).getByRole("button", { name: SHEET_COPY.ask("") }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    pick("c1");
    await waitFor(() =>
      expect(sheet().querySelector("[data-ask-words]")?.textContent).toBe(words("Christy Johnson")),
    );
    expect(h.preview).toHaveBeenCalledWith("a", "c1");
    expect(sheet().querySelector("[data-ask-gets]")?.textContent).toBe("Christy gets");
    expect(h.onSave).not.toHaveBeenCalled();
    expect(h.send).not.toHaveBeenCalled();
  });

  it("Ask turns the same sheet into the confirm; only the confirm saves, then sends, once", async () => {
    const h = open();
    pick("c1");
    await screen.findByText(words("Christy Johnson"));
    const phone = sheet().querySelector("[data-message-device]");
    press(SHEET_COPY.ask("Christy"));
    expect(sheet().getAttribute("data-lead-sheet")).toBe("confirm");
    // One surface: the same phone, not a second dialog.
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(sheet().querySelector("[data-message-device]")).toBe(phone);
    expect(within(sheet()).getByText(SHEET_COPY.confirmTitle("Christy"))).toBeTruthy();
    expect(within(sheet()).getByText(SHEET_COPY.goes("real", "Christy"))).toBeTruthy();
    expect(sheet().querySelector("[data-lead-confirm-who]")?.textContent).toContain(
      "Christy Johnson",
    );
    expect(h.calls).toEqual([]);
    const sendButton = within(sheet()).getByRole("button", { name: ASK_COPY.send });
    fireEvent.click(sendButton);
    fireEvent.click(sendButton);
    await waitFor(() => expect(h.onClose).toHaveBeenCalledTimes(1));
    expect(h.calls).toEqual(["save", "send"]);
    expect(h.onSave).toHaveBeenCalledWith("a", "c1");
    expect(h.send.mock.calls[0]?.[1]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("cancel or Back at each point leaves no lead saved and nothing sent", async () => {
    const h = open();
    press(LEAD_COPY.cancel);
    pick("c1");
    await screen.findByText(words("Christy Johnson"));
    press(LEAD_COPY.cancel);
    press(SHEET_COPY.ask("Christy"));
    press(SHEET_COPY.back);
    expect(sheet().getAttribute("data-lead-sheet")).toBe("pick");
    // Back keeps the pick.
    expect(sheet().querySelector('[data-lead-person="c1"]')?.getAttribute("aria-checked")).toBe(
      "true",
    );
    press(SHEET_COPY.ask("Christy"));
    press(ASK_COPY.cancel);
    expect(h.onClose).toHaveBeenCalledTimes(3);
    expect(h.calls).toEqual([]);
  });

  it("a real workspace with no agreement cannot reach send", async () => {
    const h = open();
    pick("c2");
    await screen.findByText(ASK_COPY.notAgreedYet("Mina Okafor"));
    press(SHEET_COPY.ask("Mina"));
    expect(within(sheet()).getByText(ASK_COPY.notAgreedYet("Mina Okafor"))).toBeTruthy();
    // Nothing on the sheet says a text goes out: no "One text to" line, and the phone is "would get".
    expect(within(sheet()).queryByText(SHEET_COPY.goes("real", "Mina"))).toBeNull();
    expect(sheet().querySelector("[data-ask-gets]")?.textContent).toBe("Mina would get");
    const sendButton = within(sheet()).getByRole("button", {
      name: ASK_COPY.send,
    }) as HTMLButtonElement;
    expect(sendButton.disabled).toBe(true);
    fireEvent.click(sendButton);
    expect(h.calls).toEqual([]);
    // Saving the lead without asking is still one press, as before.
    press(SHEET_COPY.back);
    press(LEAD_COPY.save);
    await waitFor(() => expect(h.onSave).toHaveBeenCalledWith("a", "c2"));
    expect(h.send).not.toHaveBeenCalled();
  });

  it("a demo workspace and a practice ask say truthfully where the text goes", async () => {
    open({ mode: "demo", lead: "c1", start: "confirm" });
    await screen.findByText(words("Christy Johnson"));
    expect(sheet().getAttribute("data-lead-sheet")).toBe("confirm");
    expect(within(sheet()).getByText(SHEET_COPY.goes("demo", "Christy"))).toBeTruthy();
    expect(sheet().querySelector("[data-ask-gets]")?.textContent).toBe("Christy would get");
    expect(SHEET_COPY.goes("demo", "Christy")).toContain("demo number, not to Christy");
    cleanup();
    const h = open({ mode: "practice", lead: "c1", start: "confirm" });
    await screen.findByText(words("Christy Johnson"));
    expect(within(sheet()).getByText(SHEET_COPY.goes("practice", "Christy"))).toBeTruthy();
    expect(SHEET_COPY.goes("practice", "Christy")).toContain("Nothing is sent");
    expect(within(sheet()).getByText(ASK_COPY.practiceTag)).toBeTruthy();
    press(ASK_COPY.sendPractice);
    await waitFor(() => expect(h.onClose).toHaveBeenCalled());
    // The lead was already saved, so the confirm only sends.
    expect(h.calls).toEqual(["send"]);
    expect(sheet()?.textContent ?? "").not.toMatch(/\+?\d[\d ()-]{6,}\d/);
  });

  it("a save that fails sends nothing; a send that fails after a save says the lead is saved", async () => {
    const h = open();
    h.onSave.mockResolvedValueOnce({ ok: false, problem: LEAD_COPY.missing } as never);
    pick("c1");
    await screen.findByText(words("Christy Johnson"));
    press(SHEET_COPY.ask("Christy"));
    press(ASK_COPY.send);
    expect((await within(sheet()).findByRole("alert")).textContent).toBe(LEAD_COPY.missing);
    expect(h.send).not.toHaveBeenCalled();
    h.send.mockResolvedValueOnce({ ok: false, problem: ASK_COPY.capped } as never);
    press(ASK_COPY.send);
    await waitFor(() =>
      expect(within(sheet()).getByRole("alert").textContent).toBe(
        SHEET_COPY.savedNotSent("Christy Johnson", ASK_COPY.capped),
      ),
    );
    expect(h.onClose).not.toHaveBeenCalled();
  });
});

describe("past work beside each name (Q-68)", () => {
  it("shows nothing with no data, three at most with it, and never a number, a score or a new order", async () => {
    open();
    expect(sheet().querySelector("[data-led-before]")).toBeNull();
    cleanup();
    const many = [1, 2, 3, 4, 5].map((n) => ({
      client: `Client ${"ABCDE"[n - 1]}`,
      title: "Review",
    }));
    open({ pastWork: { c2: many } });
    const lines = [...sheet().querySelectorAll("[data-led-before]")];
    expect(lines).toHaveLength(1);
    expect(lines[0]?.closest("[data-lead-person]")?.getAttribute("data-lead-person")).toBe("c2");
    expect(lines[0]?.textContent).toBe(
      `${SHEET_COPY.ledBefore} Client A, Review; Client B, Review; Client C, Review`,
    );
    expect(PAST_WORK_SHOWN).toBe(3);
    expect(lines[0]?.textContent).not.toMatch(/\d|best|match|top|score|rank|%/i);
    // The list keeps its ordinary order: the person with past work is not moved up.
    expect(
      [...sheet().querySelectorAll("[data-lead-person]")].map((row) =>
        row.getAttribute("data-lead-person"),
      ),
    ).toEqual(["c1", "c2"]);
    cleanup();
    const { container } = render(<LedBefore work={[{ client: "", title: "" }]} />);
    expect(container.textContent).toBe("");
  });

  // QA L4, carried from the two dialogs this sheet replaces.
  it("says so in one line while the list of people loads or cannot be read, and offers nothing to press", () => {
    const { preview, onSave, send } = open({ noList: true });
    expect(within(sheet()).getByRole("status").textContent).toBe(LEAD_COPY.noList);
    expect(sheet().querySelector("[data-lead-people]")).toBeNull();
    expect(within(sheet()).queryByText(LEAD_COPY.noPeople)).toBeNull();
    expect((within(sheet()).getByRole("button", { name: SHEET_COPY.ask("") }) as HTMLButtonElement).disabled).toBe(true);
    expect(preview).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  // 20 Nov 2026 (orchestrator, after the live walk): with the sender off, nothing may say or imply a text is sent.
  describe("where a text goes, in each of the three states", () => {
    const pickChristy = async () => {
      fireEvent.click(within(sheet()).getAllByRole("radio")[0] as HTMLElement);
      await waitFor(() => expect(sheet().querySelector("[data-ask-words]")).not.toBeNull());
    };
    const toConfirm = async () => {
      const first = (roster[0] as RosterContact).name.split(" ")[0] as string;
      fireEvent.click(within(sheet()).getByRole("button", { name: SHEET_COPY.ask(first) }));
      await waitFor(() => expect(sheet().getAttribute("data-lead-sheet")).toBe("confirm"));
      return first;
    };

    it("real: texts go to the person picked, and the text is the one thing sent", async () => {
      open({ mode: "real", connected: true });
      const today = sheet().querySelector("[data-lead-today]") as HTMLElement;
      expect(today.getAttribute("data-lead-today")).toBe("real");
      expect(today.textContent).toBe(LEAD_COPY.where(false));
      expect(sheet().textContent).toContain(MESSAGE_EXAMPLES_COPY.textState);
      expect(sheet().textContent).toContain(MESSAGE_EXAMPLES_COPY.note);
      expect(sheet().textContent).not.toMatch(/practice|demo number/i);
    });

    it("demo with the sender on: the demo-number line is right, on the list and on the confirm", async () => {
      open({ mode: "demo", connected: true });
      const today = sheet().querySelector("[data-lead-today]") as HTMLElement;
      expect(today.getAttribute("data-lead-today")).toBe("demo");
      expect(today.textContent).toBe(LEAD_COPY.where(true));
      expect(sheet().textContent).toContain(MESSAGE_EXAMPLES_COPY.textState);
      await pickChristy();
      const first = await toConfirm();
      expect(sheet().textContent).toContain(SHEET_COPY.goes("demo", first));
      expect(sheet().textContent).not.toMatch(/practice/i);
    });

    it("sender off: a practice ask, nothing is sent, said once at each step, and nothing says sent or demo number", async () => {
      open({ mode: "practice", connected: false });
      const count = (needle: string) => (sheet().textContent ?? "").split(needle).length - 1;
      const today = sheet().querySelector("[data-lead-today]") as HTMLElement;
      expect(today.getAttribute("data-lead-today")).toBe("off");
      expect(today.textContent).toBe(SHEET_COPY.off(true));
      expect(count("Nothing is sent")).toBe(1);
      expect(sheet().textContent).toContain(MESSAGE_EXAMPLES_COPY.noteOff);
      expect(sheet().textContent).not.toContain(MESSAGE_EXAMPLES_COPY.textState);
      expect(sheet().textContent).not.toContain(MESSAGE_EXAMPLES_COPY.note);
      expect(sheet().textContent).not.toMatch(/demo number|Sent today|texts go to/i);
      expect(sheet().querySelector('[data-message-example="live"]')).toBeNull();
      await pickChristy();
      expect(sheet().textContent).not.toMatch(/demo number|Sent today|texts go to/i);
      const first = await toConfirm();
      expect(count(SHEET_COPY.goes("practice", first))).toBe(1);
      expect(sheet().querySelector("[data-lead-today]")).toBeNull();
      expect(sheet().textContent).not.toMatch(/demo number|Sent today|texts go to/i);
      expect(within(sheet()).getByRole("button", { name: ASK_COPY.sendPractice })).toBeTruthy();
      expect(within(sheet()).queryByRole("button", { name: ASK_COPY.send })).toBeNull();
    });

    it("a real workspace with the sender off says nothing is sent and never calls it practice", () => {
      open({ mode: "real", connected: false });
      expect((sheet().querySelector("[data-lead-today]") as HTMLElement).textContent).toBe(SHEET_COPY.off(false));
      expect(sheet().textContent).not.toMatch(/practice|Sent today|texts go to/i);
    });
  });
});

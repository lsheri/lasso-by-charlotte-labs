// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const fromCalls: string[] = [];
const inserts: string[] = [];
vi.mock("@/integrations/supabase/client", () => {
  const chain = (table: string): unknown => {
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "update", "upsert", "delete", "maybeSingle", "order", "limit"]) q[m] = () => q;
    q["insert"] = () => {
      inserts.push(table);
      return q;
    };
    return q;
  };
  return { supabase: { from: (t: string) => (fromCalls.push(t), chain(t)), rpc: vi.fn() } };
});
vi.mock("@/components/work/PasteThreadDialog", () => ({
  PasteThreadDialog: ({ trigger }: { trigger: React.ReactNode }) => trigger,
}));
const logged: { event: string; dims: Record<string, unknown> }[] = [];
vi.mock("@/lib/telemetry", () => ({
  bucket: (n: number) => (n <= 0 ? "0" : n <= 10 ? "1-10" : "11-50"),
  logEvent: (event: string, _org: string, dims: Record<string, unknown>) => logged.push({ event, dims }),
}));

vi.mock("@/lib/welcome-answer.functions", () => ({ answerWelcomeQuestionFn: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (f: unknown) => f }));

import { act, waitFor } from "@testing-library/react";
import { WelcomeBoardView, type WelcomeHiddenStore } from "@/components/home/WelcomeBoard";
import { REGISTER_COPY } from "@/lib/register";
import type { OrgType } from "@/lib/org-type";

// Record<OrgType, ...> is type-complete, so a fifth register must appear here.
const REGISTERS = Object.keys(REGISTER_COPY) as OrgType[];
const BANNED = /\b(firm|consultancy|consulting|organize|mentor|audit|oversight|governance|monitor|track|surveillance|score)\b/i;
const WORK_TABLES = ["work_items", "engagements", "tasks", "clients", "work_item_tasks"];

const okAnswer = vi.fn(async () => ({ text: "Capturing brings work in; mapping files it." }));

function memoryStore() {
  let hidden = false;
  const store = (): WelcomeHiddenStore => ({ hidden, hide: () => { hidden = true; } });
  return store;
}

afterEach(() => {
  cleanup();
  fromCalls.length = 0;
  inserts.length = 0;
  logged.length = 0;
});

describe("Unit B2 welcome board", () => {
  it("runs every interaction and writes zero work rows", async () => {
    for (const register of REGISTERS) {
      const store = memoryStore();
      render(<WelcomeBoardView register={register} orgId="o1" store={store()} answerQuestion={okAnswer} />);
      for (const b of screen.getAllByRole("button", { expanded: false })) fireEvent.click(b);
      for (const b of screen.getAllByRole("button", { name: "Circle" })) fireEvent.click(b);
      for (const b of screen.getAllByRole("button", { name: "Try this with your own work" })) fireEvent.click(b);
      fireEvent.change(screen.getByLabelText("Ask about the circled cards"), { target: { value: "what?" } });
      fireEvent.click(screen.getByRole("button", { name: "Ask" }));
      await waitFor(() => expect(screen.getByTestId("welcome-answer")).toBeTruthy());
      fireEvent.click(screen.getByRole("button", { name: "Got it, hide this" }));
      cleanup();
    }
    expect(inserts).toEqual([]);
    expect(fromCalls.filter((t) => WORK_TABLES.includes(t))).toEqual([]);
    const names = new Set(logged.map((l) => l.event));
    expect([...names].sort()).toEqual(["welcome.ask_used", "welcome.card_opened", "welcome.dismissed", "welcome.viewed"]);
  });

  it.each(REGISTERS)("%s renders twelve cards in four groups with no banned words", (register) => {
    const { container } = render(<WelcomeBoardView register={register} orgId="o1" store={memoryStore()()} answerQuestion={okAnswer} />);
    expect(screen.getAllByTestId("welcome-group")).toHaveLength(4);
    expect(screen.getAllByTestId("welcome-card")).toHaveLength(12);
    for (const b of screen.getAllByRole("button", { expanded: false })) fireEvent.click(b);
    const text = container.textContent ?? "";
    const attrs = [...container.querySelectorAll("[placeholder],[aria-label]")].map(
      (el) => `${el.getAttribute("placeholder") ?? ""} ${el.getAttribute("aria-label") ?? ""}`,
    );
    const all = [text, ...attrs].join(" ");
    expect(all).not.toMatch(BANNED);
    expect(all).not.toContain("\u2014");
  });

  it("dismiss hides the board and survives a remount", () => {
    const store = memoryStore();
    const first = render(<WelcomeBoardView register="personal" orgId="o1" store={store()} answerQuestion={okAnswer} />);
    fireEvent.click(screen.getByRole("button", { name: "Got it, hide this" }));
    first.rerender(<WelcomeBoardView register="personal" orgId="o1" store={store()} answerQuestion={okAnswer} />);
    expect(screen.queryByTestId("welcome-board")).toBeNull();
    first.unmount();
    render(<WelcomeBoardView register="personal" orgId="o1" store={store()} answerQuestion={okAnswer} />);
    expect(screen.queryByTestId("welcome-board")).toBeNull();
  });
  });

  it("sends the question and circled ids, and renders the returned text", async () => {
    const fn = vi.fn(async () => ({ text: "A plain answer." }));
    render(<WelcomeBoardView register="company" orgId="o1" store={memoryStore()()} answerQuestion={fn} />);
    const circles = screen.getAllByRole("button", { name: "Circle" });
    fireEvent.click(circles[0]!);
    fireEvent.click(circles[3]!);
    fireEvent.change(screen.getByLabelText("Ask about the circled cards"), { target: { value: "difference?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    await waitFor(() => expect(screen.getByText("A plain answer.")).toBeTruthy());
    expect(fn).toHaveBeenCalledWith({ question: "difference?", cardIds: ["c1", "c4"], register: "company", orgId: "o1" });
    expect(screen.getByText(/Cards used/).textContent).toContain("Trace a fact back to its source");
  });

  it("falls back to card text when the answer throws", async () => {
    const fn = vi.fn(async () => { throw new Error("down"); });
    render(<WelcomeBoardView register="edu" orgId="o1" store={memoryStore()()} answerQuestion={fn} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Circle" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    await waitFor(() => expect(screen.getByText(/could not answer just now/)).toBeTruthy());
    expect(screen.getByTestId("welcome-answer").textContent).toContain("The thinking happened in a conversation.");
    expect(inserts).toEqual([]);
  });

  it("ignores a second submit while one is in flight", async () => {
    let release: (v: { text: string }) => void = () => {};
    const fn = vi.fn(() => new Promise<{ text: string }>((r) => { release = r; }));
    render(<WelcomeBoardView register="personal" orgId="o1" store={memoryStore()()} answerQuestion={fn} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Circle" })[0]!);
    const form = screen.getByLabelText("Ask about the circled cards").closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(logged.filter((l) => l.event === "welcome.ask_used")).toHaveLength(1);
    await act(async () => release({ text: "done" }));
  });
});

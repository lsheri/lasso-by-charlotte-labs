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

import { WelcomeBoardView, type WelcomeHiddenStore } from "@/components/home/WelcomeBoard";
import { REGISTER_COPY } from "@/lib/register";
import type { OrgType } from "@/lib/org-type";

// Record<OrgType, ...> is type-complete, so a fifth register must appear here.
const REGISTERS = Object.keys(REGISTER_COPY) as OrgType[];
const BANNED = /\b(firm|consultancy|consulting|organize|mentor|audit|oversight|governance|monitor|track|surveillance|score)\b/i;
const WORK_TABLES = ["work_items", "engagements", "tasks", "clients", "work_item_tasks"];

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
  it("runs every interaction and writes zero work rows", () => {
    for (const register of REGISTERS) {
      const store = memoryStore();
      render(<WelcomeBoardView register={register} orgId="o1" store={store()} />);
      for (const b of screen.getAllByRole("button", { expanded: false })) fireEvent.click(b);
      for (const b of screen.getAllByRole("button", { name: "Circle" })) fireEvent.click(b);
      for (const b of screen.getAllByRole("button", { name: "Try this with your own work" })) fireEvent.click(b);
      fireEvent.change(screen.getByLabelText("Ask about the circled cards"), { target: { value: "what?" } });
      fireEvent.click(screen.getByRole("button", { name: "Ask" }));
      expect(screen.getByTestId("welcome-answer")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Got it, hide this" }));
      cleanup();
    }
    expect(inserts).toEqual([]);
    expect(fromCalls.filter((t) => WORK_TABLES.includes(t))).toEqual([]);
    const names = new Set(logged.map((l) => l.event));
    expect([...names].sort()).toEqual(["welcome.ask_used", "welcome.card_opened", "welcome.dismissed", "welcome.viewed"]);
  });

  it.each(REGISTERS)("%s renders twelve cards in four groups with no banned words", (register) => {
    const { container } = render(<WelcomeBoardView register={register} orgId="o1" store={memoryStore()()} />);
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
    const first = render(<WelcomeBoardView register="personal" orgId="o1" store={store()} />);
    fireEvent.click(screen.getByRole("button", { name: "Got it, hide this" }));
    first.rerender(<WelcomeBoardView register="personal" orgId="o1" store={store()} />);
    expect(screen.queryByTestId("welcome-board")).toBeNull();
    first.unmount();
    render(<WelcomeBoardView register="personal" orgId="o1" store={store()} />);
    expect(screen.queryByTestId("welcome-board")).toBeNull();
  });
});

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SuggestStructurePanel, type SuggestStructurePanelProps } from "./SuggestStructurePanel";
import type { SuggestedStructure } from "@/lib/structure-suggest-shared";

afterEach(cleanup);
const structures: SuggestedStructure[] = [
  { id: "costs", cut: "workstream", title: "By cost pool", why: "Three cost pools shape the decision.", regions: ["Warehouse cost", "Freight lanes", "Fleet leases"] },
  { id: "outputs", cut: "deliverable", title: "By deliverable", why: "The renewal needs three outputs.", regions: ["Board memo", "Savings model", "Vendor shortlist"] },
];
function props(overrides: Partial<SuggestStructurePanelProps> = {}): SuggestStructurePanelProps {
  return { state: "idle", structures: [], done: 0, total: 0, onSubmit: vi.fn(), onChoose: vi.fn(), onCancel: vi.fn(), ...overrides };
}

describe("standalone suggestion panel", () => {
  it("shows input and submits the person's pasted text and source kind", () => {
    const callbacks = props();
    render(<SuggestStructurePanel {...callbacks} />);
    expect(screen.getByText("Lasso reads what you paste and suggests ways to lay the board out.")).toBeTruthy();
    const submit = screen.getByRole("button", { name: "Suggest workstreams" });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByRole("textbox", { name: "Your material" }), { target: { value: "Warehouse lease renews in June." } });
    fireEvent.click(submit);
    expect(callbacks.onSubmit).toHaveBeenCalledWith("Warehouse lease renews in June.", "transcript");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(callbacks.onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows determinate reading part numbers and updates when the parent advances", () => {
    const callbacks = props({ state: "reading", done: 2, total: 6 });
    const view = render(<SuggestStructurePanel {...callbacks} />);
    expect(screen.getByRole("status").textContent).toBe("Reading your material, part 2 of 6");
    expect(Number(screen.getByRole("progressbar").getAttribute("aria-valuenow"))).toBeCloseTo(100 / 3);
    view.rerender(<SuggestStructurePanel {...callbacks} done={5} />);
    expect(screen.getByRole("status").textContent).toBe("Reading your material, part 5 of 6");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(callbacks.onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows titles, reasons, region names and shortfall, and chooses the right suggestion", () => {
    const callbacks = props({ state: "choosing", structures });
    render(<SuggestStructurePanel {...callbacks} />);
    expect(screen.getByText("Only 2 of 3 suggestions met the naming and shape rules after one retry.")).toBeTruthy();
    for (const structure of structures) {
      const card = within(screen.getByRole("article", { name: structure.title }));
      expect(card.getByText(structure.why)).toBeTruthy();
      for (const region of structure.regions) expect(card.getByText(region)).toBeTruthy();
    }
    fireEvent.click(within(screen.getByRole("article", { name: "By deliverable" })).getByRole("button", { name: "Use this" }));
    expect(callbacks.onChoose).toHaveBeenCalledWith("outputs");
  });

  it("retries an error with the preserved draft and does not submit globally", () => {
    const callbacks = props();
    const view = render(<SuggestStructurePanel {...callbacks} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Freight cost comparison" } });
    fireEvent.click(screen.getByRole("button", { name: "Suggest workstreams" }));
    view.rerender(<SuggestStructurePanel {...callbacks} state="reading" done={1} total={1} />);
    view.rerender(<SuggestStructurePanel {...callbacks} state="error" />);
    expect(screen.getByRole("alert").textContent).toBe("Suggestions could not be generated. Please try again.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(vi.mocked(callbacks.onSubmit).mock.calls).toEqual([["Freight cost comparison", "transcript"], ["Freight cost comparison", "transcript"]]);
  });
});
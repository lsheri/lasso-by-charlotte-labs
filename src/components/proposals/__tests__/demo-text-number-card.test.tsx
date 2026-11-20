// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DemoTextNumberForm } from "@/components/proposals/DemoTextNumberCard";
import { DEMO_NUMBER_COPY, type DemoNumberResult } from "@/lib/demo-text-number-shared";

vi.mock("@/lib/demo-text-number.functions", () => ({ demoNumberStatusFn: vi.fn(), saveDemoNumberFn: vi.fn(), clearDemoNumberFn: vi.fn() }));
// The checkbox measures itself; jsdom has no ResizeObserver.
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

afterEach(cleanup);

const copy = DEMO_NUMBER_COPY;
const SET = { show: true as const, set: true as const, lastTwo: "23", setAt: "2026-11-20T09:00:00Z" };
const NONE = { show: true as const, set: false as const };
const ok = (status: typeof SET | typeof NONE): DemoNumberResult => ({ ok: true, status });
const field = () => screen.getByLabelText(copy.label) as HTMLInputElement;

describe("the demo text number card", () => {
  it("with no number: says nothing will be sent, and saves a typed number once the box is ticked", async () => {
    const onSave = vi.fn(async () => ok(SET));
    render(<DemoTextNumberForm status={NONE} onSave={onSave} onClear={vi.fn()} />);
    expect(screen.getByText(copy.none)).toBeTruthy();
    fireEvent.change(field(), { target: { value: "415 555 0123" } });
    fireEvent.click(screen.getByRole("button", { name: copy.save }));
    expect(screen.getByRole("alert").textContent).toBe(copy.problems.agreed);
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox", { name: copy.agreed }));
    fireEvent.click(screen.getByRole("button", { name: copy.save }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith("415 555 0123", true));
    expect((await screen.findByRole("status")).textContent).toBe(copy.saved);
  });

  it("refuses a number from another country before calling the server", () => {
    const onSave = vi.fn();
    render(<DemoTextNumberForm status={NONE} onSave={onSave} onClear={vi.fn()} />);
    fireEvent.change(field(), { target: { value: "+44 20 7946 0958" } });
    fireEvent.click(screen.getByRole("checkbox", { name: copy.agreed }));
    fireEvent.click(screen.getByRole("button", { name: copy.save }));
    expect(screen.getByRole("alert").textContent).toBe(copy.problems.number);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("with a number set: shows only the last two digits and no field, until Change", () => {
    render(<DemoTextNumberForm status={SET} onSave={vi.fn()} onClear={vi.fn()} />);
    expect(screen.getByText(copy.set("23", "Fri 20 Nov"))).toBeTruthy();
    expect(screen.queryByLabelText(copy.label)).toBeNull();
    expect(document.body.textContent).not.toMatch(/\d{4}/);
    fireEvent.click(screen.getByRole("button", { name: copy.change }));
    expect(field().value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: copy.cancel }));
    expect(screen.queryByLabelText(copy.label)).toBeNull();
  });

  it("empties the field after a save, so the typed number does not stay on the page", async () => {
    const { rerender } = render(<DemoTextNumberForm status={SET} onSave={async () => ok(SET)} onClear={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: copy.change }));
    fireEvent.change(field(), { target: { value: "604 555 0199" } });
    fireEvent.click(screen.getByRole("checkbox", { name: copy.agreed }));
    fireEvent.click(screen.getByRole("button", { name: copy.save }));
    await screen.findByRole("status");
    rerender(<DemoTextNumberForm status={{ ...SET, lastTwo: "99" }} onSave={async () => ok(SET)} onClear={vi.fn()} />);
    expect(screen.queryByLabelText(copy.label)).toBeNull();
    expect(document.body.innerHTML).not.toContain("0199");
    expect(document.body.innerHTML).not.toContain("604");
  });

  it("clears once on a double press, and says so when the server refuses or fails", async () => {
    let finish: (value: DemoNumberResult) => void = () => {};
    const onClear = vi.fn(() => new Promise<DemoNumberResult>((resolve) => { finish = resolve; }));
    render(<DemoTextNumberForm status={SET} onSave={vi.fn()} onClear={onClear} />);
    const clear = screen.getByRole("button", { name: copy.clear });
    fireEvent.click(clear);
    fireEvent.click(clear);
    expect(onClear).toHaveBeenCalledTimes(1);
    finish({ ok: false, problem: copy.problems.notHere });
    expect((await screen.findByRole("alert")).textContent).toBe(copy.problems.notHere);
    onClear.mockImplementationOnce(() => Promise.reject(new Error("offline")));
    fireEvent.click(screen.getByRole("button", { name: copy.clear }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(copy.problems.failed));
  });
});

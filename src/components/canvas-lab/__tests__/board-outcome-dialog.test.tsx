// @vitest-environment jsdom
// 18 Nov, firm brain: how a finished engagement ended. Loads the saved line, writes the format precedents read,
// clears the lesson when set back to still running, and stays open when the board's policies refuse the write.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ outcome: null as string | null, update: vi.fn(), rows: [{ id: "b1" }] as { id: string }[], load: null as Promise<unknown> | null }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => m.load ?? Promise.resolve({ data: { outcome: m.outcome }, error: null }) }) }),
      update: (patch: unknown) => {
        m.update(patch);
        return { eq: () => ({ select: () => Promise.resolve({ data: m.rows, error: null }) }) };
      },
    }),
  },
}));

import { BoardOutcomeDialog } from "@/components/canvas-lab/BoardOutcomeDialog";

const plan = () => screen.getByLabelText("Plan") as HTMLSelectElement;
const extension = () => screen.getByLabelText("Extension") as HTMLSelectElement;
const lesson = () => screen.getByLabelText(/What we would do differently/) as HTMLTextAreaElement;

beforeEach(() => {
  m.outcome = null;
  m.rows = [{ id: "b1" }];
  m.update.mockReset();
  m.load = null;
});
afterEach(cleanup);

describe("BoardOutcomeDialog", () => {
  it("loads the saved outcome", async () => {
    m.outcome = "Overran. Client extended. Book CFO time earlier.";
    render(<BoardOutcomeDialog engagementId="b1" open onClose={() => {}} />);
    await waitFor(() => expect(plan().value).toBe("overran"));
    expect(extension().value).toBe("yes");
    expect(lesson().value).toBe("Book CFO time earlier.");
  });

  it("saves the line precedents read and calls back", async () => {
    const onClose = vi.fn();
    const onSaved = vi.fn();
    render(<BoardOutcomeDialog engagementId="b1" open onClose={onClose} onSaved={onSaved} />);
    await waitFor(() => expect(plan().value).toBe("running"));
    expect(lesson().disabled).toBe(true);
    fireEvent.change(plan(), { target: { value: "ran" } });
    fireEvent.change(extension(), { target: { value: "no" } });
    fireEvent.change(lesson(), { target: { value: "Payer talks alongside the diagnostic" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(m.update).toHaveBeenCalledWith({ outcome: "Ran to plan. Not extended. Payer talks alongside the diagnostic." }));
    expect(onSaved).toHaveBeenCalledWith("Ran to plan. Not extended. Payer talks alongside the diagnostic.");
    expect(onClose).toHaveBeenCalled();
  });

  it("set back to still running clears the outcome", async () => {
    m.outcome = "Ran to plan. Client extended. A lesson.";
    render(<BoardOutcomeDialog engagementId="b1" open onClose={() => {}} />);
    await waitFor(() => expect(plan().value).toBe("ran"));
    fireEvent.change(plan(), { target: { value: "running" } });
    expect(lesson().value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(m.update).toHaveBeenCalledWith({ outcome: null }));
  });

  it("stays open with an honest line when the write is refused", async () => {
    m.rows = [];
    const onClose = vi.fn();
    render(<BoardOutcomeDialog engagementId="b1" open onClose={onClose} />);
    await waitFor(() => expect(plan().value).toBe("running"));
    fireEvent.change(plan(), { target: { value: "overran" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Only people who can edit this board/);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("locks the fields until the saved line arrives, so a late load never overwrites a choice", async () => {
    let finish: (value: unknown) => void = () => {};
    m.load = new Promise((resolve) => (finish = resolve));
    render(<BoardOutcomeDialog engagementId="b1" open onClose={() => {}} />);
    expect(plan().disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
    finish({ data: { outcome: "Overran. Not extended." }, error: null });
    await waitFor(() => expect(plan().disabled).toBe(false));
    expect(plan().value).toBe("overran");
  });

  it("stays locked with a plain line when the load fails", async () => {
    m.load = Promise.reject(new Error("offline"));
    render(<BoardOutcomeDialog engagementId="b1" open onClose={() => {}} />);
    expect((await screen.findByRole("alert")).textContent).toMatch(/Could not load/);
    expect(plan().disabled).toBe(true);
  });
});

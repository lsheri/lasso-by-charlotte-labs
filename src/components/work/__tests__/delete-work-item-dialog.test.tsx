// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DeleteWorkItemDialog, confirmMatches } from "@/components/work/DeleteWorkItemDialog";

const mocks = vi.hoisted(() => ({
  run: vi.fn(),
  logEvent: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({ useServerFn: () => mocks.run }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({}) }));
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => ({ data: { id: "p1", org_id: "o1" } }) }));
vi.mock("@/lib/work-remove.functions", () => ({ deleteWorkItem: {} }));
vi.mock("@/lib/work-invalidation", () => ({ invalidateAfterWorkChange: vi.fn(async () => {}) }));
vi.mock("@/lib/telemetry", () => ({ logEvent: mocks.logEvent }));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError, success: mocks.toastSuccess } }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: async () => ({ count: 0, error: null }) }),
    }),
  },
}));

const TITLE = "Cure First pricing memo";

function open() {
  return render(<DeleteWorkItemDialog workItemId="w1" title={TITLE} open onOpenChange={() => {}} />);
}

function step2() {
  fireEvent.click(screen.getByText("Continue"));
  return screen.getByLabelText("Type the name to confirm") as HTMLInputElement;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("typed-name delete", () => {
  it("ignores case and extra spaces when matching", () => {
    expect(confirmMatches("  cure   first PRICING memo ", TITLE)).toBe(true);
    expect(confirmMatches("cure first pricing", TITLE)).toBe(false);
  });

  it("keeps the delete button disabled until the name matches", () => {
    open();
    const input = step2();
    const button = screen.getByText("Delete permanently").closest("button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.change(input, { target: { value: "wrong" } });
    expect((screen.getByText("Delete permanently").closest("button") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(input, { target: { value: "  CURE  first pricing memo " } });
    expect((screen.getByText("Delete permanently").closest("button") as HTMLButtonElement).disabled).toBe(false);
  });

  it("logs workitem.deleted with only on_board on success", async () => {
    mocks.run.mockResolvedValue({});
    open();
    const input = step2();
    fireEvent.change(input, { target: { value: TITLE } });
    fireEvent.click(screen.getByText("Delete permanently"));
    await waitFor(() => expect(mocks.logEvent).toHaveBeenCalled());
    const call = mocks.logEvent.mock.calls[0];
    expect(call?.[0]).toBe("workitem.deleted");
    expect(call?.[1]).toBe("o1");
    expect(Object.keys(call?.[2] as object)).toEqual(["on_board"]);
  });

  it("keeps the dialog open and explains a legal hold", async () => {
    mocks.run.mockRejectedValue(new Error("This item is under a legal hold"));
    open();
    const input = step2();
    fireEvent.change(input, { target: { value: TITLE } });
    fireEvent.click(screen.getByText("Delete permanently"));
    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("This work is under a legal hold and can't be deleted."),
    );
    expect(screen.getByLabelText("Type the name to confirm")).toBeTruthy();
  });
});

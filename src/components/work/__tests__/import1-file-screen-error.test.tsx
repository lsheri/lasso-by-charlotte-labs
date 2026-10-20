// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ImportFlowDialog } from "@/components/work/import/ImportFlowDialog";

const mocks = vi.hoisted(() => ({ logEvent: vi.fn() }));

vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => ({ data: { id: "p1", org_id: "o1" } }) }));
vi.mock("@/lib/telemetry", () => ({ logEvent: mocks.logEvent, bucket: (n: number) => String(n) }));
vi.mock("@/lib/import-commit", () => ({ commitImport: vi.fn() }));
vi.mock("@/components/work/PasteThreadDialog", () => ({
  PasteThreadDialog: ({ trigger }: { trigger: React.ReactNode }) => trigger,
}));

afterEach(() => {
  cleanup();
  mocks.logEvent.mockReset();
});

describe("IMPORT-1 file screen", () => {
  it("shows the error when a dropped export has no conversations", async () => {
    render(<ImportFlowDialog trigger={<button type="button">Open importer</button>} initialVendor="claude" />);
    fireEvent.click(screen.getByText("Open importer"));

    const file = new File([JSON.stringify([{ nope: 1 }])], "conversations.json", {
      type: "application/json",
    });
    fireEvent.change(screen.getByLabelText("Export file"), { target: { files: [file] } });

    await waitFor(() =>
      expect(screen.getByText("No conversations could be read from that file.")).toBeTruthy(),
    );
    expect(screen.getByText("Export not working? Paste a conversation instead")).toBeTruthy();

    const failed = mocks.logEvent.mock.calls.filter((c) => c[0] === "import.failed");
    expect(failed).toHaveLength(1);
    expect(failed[0]?.[2]).toEqual({ vendor: "claude", last_screen: "file", reason: "no_conversations" });
  });
});

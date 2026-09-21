// @vitest-environment jsdom
import { cleanup, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/connectors/ConnectorPicker", () => ({
  ConnectorPicker: ({ trigger }: { trigger: React.ReactNode }) => trigger,
}));

vi.mock("@/components/work/use-capture-files", () => ({
  useCaptureFiles: () => ({ capture: vi.fn(), pending: false, error: null }),
}));

vi.mock("@/hooks/use-connector-accounts", () => ({
  useConnectorAccounts: () => ({ data: {} }),
}));

vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ data: { id: "profile-1" } }),
}));

vi.mock("@/hooks/use-work-items", () => ({
  useWorkItems: () => ({
    data: {
      items: [
        {
          id: "work-1",
          owner_id: "profile-1",
          visibility: "unmapped",
          title: "x".repeat(300),
          type: "document",
        },
      ],
    },
  }),
}));

vi.mock("@/lib/settings-dialog-context", () => ({
  useSettingsDialogOptional: () => null,
}));

import { AddWorkPanel } from "@/components/canvas-lab/AddWorkPanel";

afterEach(cleanup);

function renderPanel() {
  return render(
    <AddWorkPanel open onOpenChange={() => undefined} onPlace={() => undefined} />,
  );
}

describe("AddWorkPanel layout containment", () => {
  it("keeps the inbox confirmation in the dialog footer, outside the scrolling tab panel", () => {
    renderPanel();
    const dialog = document.querySelector<HTMLElement>("[role=dialog]");
    expect(dialog).not.toBeNull();

    const confirm = within(dialog as HTMLElement)
      .getAllByRole("button")
      .find((button) => button.getAttribute("type") === "button" && button.disabled);

    expect(confirm).toBeDefined();
    expect(confirm?.closest("[role=tabpanel]")).toBeNull();
    expect(confirm?.parentElement?.parentElement).toBe(dialog);
  });

  it("constrains the scroll viewport child and clips the dialog box", () => {
    renderPanel();
    const dialog = document.querySelector<HTMLElement>("[role=dialog]");
    const viewport = dialog?.querySelector<HTMLElement>("[data-radix-scroll-area-viewport]");

    expect(dialog?.classList.contains("overflow-hidden")).toBe(true);
    expect(viewport?.className).toContain("[&>div]:!w-full");
    expect(viewport?.className).toContain("[&>div]:!min-w-0");
  });
});
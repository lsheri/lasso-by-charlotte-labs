// @vitest-environment jsdom
/** BB-4: Add work lists all of your non-private work, with where it already sits. */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

let items: unknown[] = [];
vi.mock("@/components/connectors/ConnectorPicker", () => ({ ConnectorPicker: ({ trigger }: { trigger: React.ReactNode }) => trigger }));
vi.mock("@/components/work/use-capture-files", () => ({ useCaptureFiles: () => ({ capture: vi.fn(), pending: false, error: null }) }));
vi.mock("@/hooks/use-connector-accounts", () => ({ useConnectorAccounts: () => ({ data: {} }) }));
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => ({ data: { id: "me" } }) }));
vi.mock("@/hooks/use-work-items", () => ({ useWorkItems: () => ({ data: { items } }) }));
vi.mock("@/lib/settings-dialog-context", () => ({ useSettingsDialogOptional: () => null }));

const { AddWorkPanel } = await import("@/components/canvas-lab/AddWorkPanel");

const link = (engId: string, title: string) => ({ task_id: `t-${engId}`, tasks: { id: `t-${engId}`, name: "x", engagement_id: engId, engagements: { id: engId, code: "C-1", title } } });
const work = (id: string, extra: Record<string, unknown>) => ({ id, owner_id: "me", visibility: "mapped", title: id, type: "document", work_item_tasks: [], ...extra });

afterEach(cleanup);
const show = () => render(<AddWorkPanel open onOpenChange={() => undefined} onPlace={() => undefined} engagementId="here" />);

describe("BB-4 Add work lists all your work", () => {
  it("lists mapped work with its board names, excludes private and other owners", () => {
    items = [
      work("Mapped deck", { work_item_tasks: [link("a", "Board A"), link("a", "Board A"), link("b", "Board B")] }),
      work("Loose memo", { visibility: "unmapped" }),
      work("Secret", { visibility: "private" }),
      work("Theirs", { owner_id: "other" }),
    ];
    show();
    expect(screen.getByRole("tab", { name: "Your work" })).toBeTruthy();
    expect(screen.getByText("Mapped deck")).toBeTruthy();
    expect(screen.getByText("Board A, Board B")).toBeTruthy();
    expect(screen.getByText("No board")).toBeTruthy();
    expect(screen.queryByText("Secret")).toBeNull();
    expect(screen.queryByText("Theirs")).toBeNull();
    expect(screen.queryByText(/C-1/)).toBeNull();
    expect(screen.queryByText(/Mapped work, choose your work stream/)).toBeNull();
  });

  it("shows work already on this board as Already here, not selectable", () => {
    items = [work("On here", { work_item_tasks: [link("here", "This board")] }), work("Elsewhere", { work_item_tasks: [link("b", "Board B")] })];
    show();
    expect(screen.getByText("Already here")).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: "Choose On here" })).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Choose Elsewhere" })).toBeTruthy();
  });

  it("is empty only when the person has no non-private work", () => {
    items = [work("Secret", { visibility: "private" }), work("Theirs", { owner_id: "other" })];
    show();
    expect(screen.getByText("Nothing of yours to add yet.")).toBeTruthy();
  });
});

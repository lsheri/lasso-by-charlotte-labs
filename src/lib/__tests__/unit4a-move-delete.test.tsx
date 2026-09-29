// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { deleteConfirmLine, deletedLine } from "@/lib/container-actions";
import { rpcOutcome } from "@/lib/save-guard";

const mocks = vi.hoisted(() => ({
  logEvent: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  deleteContainer: vi.fn(),
  moveWorkboard: vi.fn(),
  reparentClient: vi.fn(),
}));

vi.mock("@/lib/telemetry", () => ({ logEvent: mocks.logEvent }));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError, success: mocks.toastSuccess } }));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ data: { id: "p1", org_id: "o1", org_type: "partner", role: "worker" } }),
}));
vi.mock("@/hooks/use-clients", () => ({
  useClients: () => ({
    data: [
      { id: "c1", name: "ABC Co", kind: "client", parent_id: null, quick_folder: false },
      { id: "f1", name: "Folder One", kind: "folder", parent_id: "c1", quick_folder: false },
    ],
  }),
  useInvalidateClients: () => () => {},
  renameClient: vi.fn(),
  reparentClient: mocks.reparentClient,
  deleteContainer: mocks.deleteContainer,
  moveWorkboard: mocks.moveWorkboard,
}));

import { SidebarItemMenu } from "@/components/layout/SidebarItemMenu";
import { useState } from "react";

function Harness(props: { target: Parameters<typeof SidebarItemMenu>[0]["target"] }) {
  const [open, setOpen] = useState(false);
  return <SidebarItemMenu target={props.target} open={open} onOpenChange={setOpen} />;
}

const folder = {
  type: "container" as const,
  id: "f1",
  name: "Folder One",
  kind: "folder" as const,
  workboards: 2,
  folders: 1,
};

beforeEach(() => {
  for (const fn of Object.values(mocks)) fn.mockReset();
});
afterEach(() => cleanup());

describe("unit 4a copy", () => {
  it("says where the contents go, in the workspace's words", () => {
    expect(
      deleteConfirmLine({ name: "Folder One", workboards: 2, folders: 1, parentName: "ABC Co", workboardWord: "Workboard" }),
    ).toBe("Folder One is removed. The 2 workboards and 1 folder inside it move up to ABC Co.");
    expect(
      deleteConfirmLine({ name: "ABC Co", workboards: 1, folders: 0, parentName: null, workboardWord: "Workboard" }),
    ).toBe("ABC Co is removed. The 1 workboard inside it moves up to the top level.");
    expect(
      deleteConfirmLine({ name: "Empty", workboards: 0, folders: 0, parentName: null, workboardWord: "Workboard" }),
    ).toBe("Empty is removed. It is empty.");
  });

  it("builds the after line from what the database lifted", () => {
    expect(
      deletedLine({ name: "Folder One", liftedWorkboards: 1, liftedFolders: 0, liftedItems: 0, liftedToName: "ABC Co", workboardWord: "Workboard" }),
    ).toBe("Folder One removed. 1 workboard moved up to ABC Co.");
    expect(
      deletedLine({ name: "X", liftedWorkboards: 0, liftedFolders: 0, liftedItems: 0, liftedToName: null, workboardWord: "Workboard" }),
    ).toBe("X removed.");
  });

  it("never calls the work permanently removed, and has no em dash", () => {
    const src = readFileSync("src/lib/container-actions.ts", "utf8");
    expect(src.toLowerCase()).not.toContain("permanent");
    expect(src).not.toContain("—");
  });
});

describe("unit 4a status replies", () => {
  it("reads a refusal reason verbatim", () => {
    expect(rpcOutcome({ data: { status: "forbidden", reason: "Not yours." }, error: null }, "deleted", "x")).toEqual({
      ok: false,
      message: "Not yours.",
    });
    expect(rpcOutcome({ data: { status: "deleted" }, error: null }, "deleted", "x").ok).toBe(true);
  });

  it("never deletes clients directly", () => {
    const hook = readFileSync("src/hooks/use-clients.ts", "utf8");
    expect(hook).not.toMatch(/from\("clients"\)[\s\S]{0,80}\.delete\(/);
  });
});

describe("unit 4a keyboard path and events", () => {
  it("opens the menu from the keyboard and deletes with the lifted confirmation", async () => {
    mocks.deleteContainer.mockResolvedValue({ status: "deleted", lifted_workboards: 2, lifted_folders: 1, lifted_items: 0, lifted_to: "c1" });
    render(<Harness target={folder} />);
    const trigger = screen.getByRole("button", { name: "More actions for Folder One" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    expect(await screen.findByText("Folder One is removed. The 2 workboards and 1 folder inside it move up to ABC Co.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalled());
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Folder One removed. 2 workboards and 1 folder moved up to ABC Co.");
    expect(mocks.logEvent).toHaveBeenCalledWith("container.deleted", "o1", {
      kind: "folder",
      had_workboards: "true",
      had_folders: "true",
    });
  });

  it("fires no event on a refusal and shows the database's words", async () => {
    mocks.moveWorkboard.mockRejectedValue(new Error("You cannot move that."));
    render(<Harness target={{ type: "workboard", id: "e1", name: "Board", clientId: "f1" }} />);
    const trigger = screen.getByRole("button", { name: "More actions for Board" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Move to…" }));
    fireEvent.change(await screen.findByLabelText("Destination"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Move" }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("You cannot move that."));
    expect(mocks.logEvent).not.toHaveBeenCalled();
  });

  it("moves a workboard to top level with the added dims", async () => {
    mocks.moveWorkboard.mockResolvedValue(undefined);
    render(<Harness target={{ type: "workboard", id: "e1", name: "Board", clientId: "f1" }} />);
    const trigger = screen.getByRole("button", { name: "More actions for Board" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Move to…" }));
    fireEvent.change(await screen.findByLabelText("Destination"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Move" }));
    await waitFor(() => expect(mocks.moveWorkboard).toHaveBeenCalledWith({ engagementId: "e1", clientId: null }));
    expect(mocks.logEvent).toHaveBeenCalledWith("engagement.updated", "o1", { moved: "true", to_container: "false" });
  });
});

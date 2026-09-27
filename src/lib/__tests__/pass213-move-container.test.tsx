// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const profileState: { data: unknown } = { data: null };
const useClientsMock = vi.fn();
const reparentMock = vi.fn();
const invalidateMock = vi.fn();
const logEventMock = vi.fn();

vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => profileState,
  isBusinessOrg: () => true,
}));
vi.mock("@/hooks/use-clients", () => ({
  useClients: (...args: unknown[]) => useClientsMock(...args),
  reparentClient: (...args: unknown[]) => reparentMock(...args),
  useInvalidateClients: () => invalidateMock,
}));
vi.mock("@/lib/telemetry", () => ({
  logEvent: (...args: unknown[]) => logEventMock(...args),
}));

import { MoveContainer } from "@/components/clients/MoveContainer";

const rows = [
  { id: "c1", name: "Acme", code: null, quick_folder: false, kind: "client", parent_id: null },
  { id: "f1", name: "Moving", code: null, quick_folder: false, kind: "folder", parent_id: null },
  { id: "f2", name: "Child of moving", code: null, quick_folder: false, kind: "folder", parent_id: "f1" },
  { id: "f3", name: "Other", code: null, quick_folder: false, kind: "folder", parent_id: "c1" },
];

const member = { role: "member", org_type: "company", org_id: "org1" };

beforeEach(() => {
  profileState.data = member;
  useClientsMock.mockReset().mockReturnValue({ data: rows });
  reparentMock.mockReset().mockResolvedValue(undefined);
  invalidateMock.mockReset();
  logEventMock.mockReset();
});

function folder() {
  return render(<MoveContainer clientId="f1" kind="folder" parentId={null} quickFolder={false} />);
}

describe("pass213 MoveContainer", () => {
  it("renders nothing for a client", () => {
    const { container } = render(
      <MoveContainer clientId="c1" kind="client" parentId={null} quickFolder={false} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing for a quick folder", () => {
    const { container } = render(
      <MoveContainer clientId="f1" kind="folder" parentId={null} quickFolder />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing for a coach and never reads clients", () => {
    profileState.data = { ...member, role: "coach" };
    const { container } = folder();
    expect(container.innerHTML).toBe("");
    expect(useClientsMock).toHaveBeenCalledTimes(0);
  });

  it("lists Top level and only eligible parents", () => {
    folder();
    const labels = Array.from(screen.getByLabelText("Inside").querySelectorAll("option")).map(
      (o) => o.textContent,
    );
    expect(labels[0]).toBe("Top level");
    expect(labels).toContain("Acme");
    expect(labels).toContain("Other");
    expect(labels).not.toContain("Child of moving");
    expect(labels).not.toContain("Moving");
  });

  it("choosing a parent writes, then records set with depth", async () => {
    folder();
    fireEvent.change(screen.getByLabelText("Inside"), { target: { value: "f3" } });
    await waitFor(() => expect(logEventMock).toHaveBeenCalled());
    expect(reparentMock).toHaveBeenCalledWith({ clientId: "f1", parentId: "f3" });
    expect(logEventMock).toHaveBeenCalledWith("container.reparented", "org1", {
      kind: "folder",
      depth: 2,
      action: "set",
    });
  });

  it("choosing Top level writes null and records cleared", async () => {
    render(<MoveContainer clientId="f1" kind="folder" parentId="c1" quickFolder={false} />);
    fireEvent.change(screen.getByLabelText("Inside"), { target: { value: "" } });
    await waitFor(() => expect(logEventMock).toHaveBeenCalled());
    expect(reparentMock).toHaveBeenCalledWith({ clientId: "f1", parentId: null });
    expect(logEventMock).toHaveBeenCalledWith("container.reparented", "org1", {
      kind: "folder",
      depth: 0,
      action: "cleared",
    });
  });

  it("a refusal shows the message, keeps the real value and records nothing", async () => {
    reparentMock.mockRejectedValue(new Error("That did not move."));
    folder();
    const select = screen.getByLabelText("Inside") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "c1" } });
    expect(await screen.findByText("That did not move.")).toBeTruthy();
    expect(select.value).toBe("");
    expect(logEventMock).not.toHaveBeenCalled();
  });
});

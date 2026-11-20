// @vitest-environment jsdom
// 20 Nov 2026: the Change role dialog on Members. Admin, Lead and Member; Lead only in company workspaces; the server's
// refusal shown in words with the dialog kept open; one call per double press.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MemberRoleDialog } from "@/components/members/MemberRoleDialog";
import { ROLE_COPY, type RoleChangeResult } from "@/lib/member-roles-shared";

afterEach(cleanup);

const dana = { id: "m1", display_name: "Dana Whitlock", role: "em" };

function open(over: Partial<Parameters<typeof MemberRoleDialog>[0]> = {}) {
  const props = {
    member: dana,
    firmView: true,
    change: vi.fn(async (): Promise<RoleChangeResult> => ({ ok: true, role: "lead" })),
    onChanged: vi.fn(),
    onClose: vi.fn(),
    ...over,
  };
  render(<MemberRoleDialog {...props} />);
  return props;
}

describe("MemberRoleDialog", () => {
  it("offers Admin, Lead and Member with the current role picked, and never Coach", () => {
    open();
    const radios = screen.getAllByRole("radio").map((r) => r.textContent ?? "");
    expect(radios).toHaveLength(3);
    expect(radios.some((t) => t.startsWith("Admin"))).toBe(true);
    expect(radios.some((t) => t.startsWith("Lead"))).toBe(true);
    expect(radios.some((t) => t.startsWith("Member"))).toBe(true);
    expect(radios.some((t) => t.startsWith("Coach"))).toBe(false);
    expect(screen.getByRole("radio", { name: /^Member/ }).getAttribute("aria-checked")).toBe("true");
    expect((screen.getByRole("button", { name: ROLE_COPY.save }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("offers no Lead outside a company workspace", () => {
    open({ firmView: false });
    expect(screen.queryByRole("radio", { name: /^Lead/ })).toBeNull();
  });

  it("saves once for a double press and reports the new role", async () => {
    let finish: (v: RoleChangeResult) => void = () => undefined;
    const props = open({ change: vi.fn(() => new Promise<RoleChangeResult>((r) => (finish = r))) });
    fireEvent.click(screen.getByRole("radio", { name: /^Lead/ }));
    const save = screen.getByRole("button", { name: ROLE_COPY.save });
    fireEvent.click(save);
    fireEvent.click(save);
    expect(props.change).toHaveBeenCalledTimes(1);
    expect(props.change).toHaveBeenCalledWith("m1", "lead");
    await act(async () => finish({ ok: true, role: "lead" }));
    expect(props.onChanged).toHaveBeenCalledWith("Dana Whitlock", "lead");
    expect(props.onClose).toHaveBeenCalled();
  });

  it("shows the server's refusal in words and stays open (the last admin)", async () => {
    const props = open({ member: { id: "a1", display_name: "Maren Hollis", role: "admin" }, change: vi.fn(async () => ({ ok: false, reason: "last_admin" }) as RoleChangeResult) });
    fireEvent.click(screen.getByRole("radio", { name: /^Member/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: ROLE_COPY.save }));
    });
    expect(screen.getByRole("alert").textContent).toBe(ROLE_COPY.refusals.last_admin);
    expect(props.onClose).not.toHaveBeenCalled();
    expect(props.onChanged).not.toHaveBeenCalled();
  });

  it("turns a network error into a plain line", async () => {
    open({ change: vi.fn(async () => Promise.reject(new Error("offline"))) });
    fireEvent.click(screen.getByRole("radio", { name: /^Admin/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: ROLE_COPY.save }));
    });
    expect(screen.getByRole("alert").textContent).toBe(ROLE_COPY.refusals.unavailable);
  });

  it("draws nothing with no member", () => {
    open({ member: null });
    expect(screen.queryByRole("radio")).toBeNull();
  });
});

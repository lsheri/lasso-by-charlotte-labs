// @vitest-environment jsdom
// 20 Nov 2026, Set up a pilot: the /founder/pilots page with its server functions mocked. Refused, invalid input,
// one call per press, success with the join link, a name that exists, and the list of pilots.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PILOT_COPY as C, type PilotRow } from "@/lib/pilot-setup-shared";

const m = vi.hoisted(() => ({ setUp: vi.fn(), list: vi.fn() }));

vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/pilot-setup.functions", () => ({
  setUpPilotFn: (...a: unknown[]) => m.setUp(...a),
  listPilotsFn: (...a: unknown[]) => m.list(...a),
}));

import { PilotSetupPage } from "@/components/founder/PilotSetupPage";

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PilotSetupPage />
    </QueryClientProvider>,
  );
}

const row: PilotRow = { orgId: "o1", name: "Alder Row Partners", setUpAt: "2026-11-20T15:00:00.000Z", inviteEmail: "jo@alderrow.com", joined: false, invite: "open", people: 0 };

function fill(name: string, email: string) {
  fireEvent.change(screen.getByLabelText(C.firmName), { target: { value: name } });
  fireEvent.change(screen.getByLabelText(C.adminEmail), { target: { value: email } });
}

beforeEach(() => {
  m.setUp.mockReset();
  m.list.mockReset();
  m.list.mockResolvedValue([]);
});
afterEach(cleanup);

describe("PilotSetupPage", () => {
  it("shows one line and no form when the server refuses", async () => {
    m.list.mockRejectedValue(new Response("Forbidden", { status: 403 }));
    renderPage();
    expect(await screen.findByText(C.refused)).toBeTruthy();
    expect(screen.queryByLabelText(C.firmName)).toBeNull();
  });

  it("keeps the button off until the name and email are usable", async () => {
    renderPage();
    const button = screen.getByRole("button", { name: C.submit }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fill("Alder Row Partners", "not an email");
    expect(button.disabled).toBe(true);
    fill("Alder Row Partners", "jo@alderrow.com");
    expect(button.disabled).toBe(false);
    expect(await screen.findByText(C.listEmpty)).toBeTruthy();
  });

  it("sends one call for a double press and shows the join link and the email outcome", async () => {
    let finish: (value: unknown) => void = () => undefined;
    m.setUp.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderPage();
    expect(await screen.findByText(C.listEmpty)).toBeTruthy();
    fill("Alder Row Partners", "jo@alderrow.com");
    const button = screen.getByRole("button", { name: C.submit });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(m.setUp).toHaveBeenCalledTimes(1);
    expect(m.setUp).toHaveBeenCalledWith({ data: { firm_name: "Alder Row Partners", admin_email: "jo@alderrow.com" } });
    m.list.mockResolvedValue([row]);
    await act(async () => finish({ ok: true, orgId: "o1", orgName: "Alder Row Partners", joinUrl: "https://lasso.charlotte-labs.com/join?code=abc", emailed: "not_configured" }));
    expect(await screen.findByText(C.done("Alder Row Partners"))).toBeTruthy();
    expect(screen.getByText(C.emailed.not_configured)).toBeTruthy();
    expect(screen.getByText("https://lasso.charlotte-labs.com/join?code=abc")).toBeTruthy();
    await waitFor(() => expect(m.list.mock.calls.length).toBeGreaterThan(1));
    await waitFor(() => expect(screen.getByText(C.invite.open)).toBeTruthy());
    expect((screen.getByLabelText(C.firmName) as HTMLInputElement).value).toBe("");
  });

  it("says plainly when the name already exists", async () => {
    m.setUp.mockResolvedValue({ ok: false, reason: "exists" });
    renderPage();
    fill("Kestrel Bay Advisory", "jo@alderrow.com");
    fireEvent.click(screen.getByRole("button", { name: C.submit }));
    expect(await screen.findByText(C.exists)).toBeTruthy();
    expect((screen.getByLabelText(C.firmName) as HTMLInputElement).value).toBe("Kestrel Bay Advisory");
  });

  it("turns a refused press into the refused line", async () => {
    m.setUp.mockRejectedValue(new Response("Forbidden", { status: 403 }));
    renderPage();
    fill("Alder Row Partners", "jo@alderrow.com");
    fireEvent.click(screen.getByRole("button", { name: C.submit }));
    expect(await screen.findByText(C.refused)).toBeTruthy();
  });

  it("turns a network error into the failed line and keeps the form", async () => {
    m.setUp.mockRejectedValue(new Error("network"));
    renderPage();
    fill("Alder Row Partners", "jo@alderrow.com");
    fireEvent.click(screen.getByRole("button", { name: C.submit }));
    expect(await screen.findByText(C.failed)).toBeTruthy();
    expect(screen.getByLabelText(C.firmName)).toBeTruthy();
  });
});

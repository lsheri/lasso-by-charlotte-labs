// @vitest-environment jsdom
// 19 Nov, Proposal Desk, first live slice: the "Text the lead" button. Server functions are mocked.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WON_TEXT_COPY } from "@/lib/won-text-shared";

const m = vi.hoisted(() => ({ status: vi.fn(), send: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/won-text.functions", () => ({
  wonTextStatus: (...a: unknown[]) => m.status(...a),
  sendWonText: (...a: unknown[]) => m.send(...a),
}));

import { WonTextButton } from "@/components/firm-brain/WonTextButton";

const BOARD = "0000000b-0000-4000-8000-000000000001";
const WORDS = "Lasso for Kestrel Bay: the proposal you helped with has been won, and the team board is ready. Reply STOP to opt out.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

beforeEach(() => {
  m.status.mockReset().mockResolvedValue({ show: true, connected: true, preview: WORDS });
  m.send.mockReset().mockResolvedValue({ ok: true });
});
afterEach(cleanup);

const open = async () => {
  render(<WonTextButton engagementId={BOARD} profileId="p1" />);
  fireEvent.click(await screen.findByRole("button", { name: WON_TEXT_COPY.open }));
};

describe("WonTextButton", () => {
  it("shows nothing while loading, when the server says no, and when the read fails", async () => {
    m.status.mockResolvedValueOnce({ show: false });
    const { container, unmount } = render(<WonTextButton engagementId={BOARD} profileId="p1" />);
    expect(container.innerHTML).toBe("");
    await waitFor(() => expect(m.status).toHaveBeenCalledTimes(1));
    expect(container.innerHTML).toBe("");
    unmount();
    m.status.mockRejectedValueOnce(new Error("offline"));
    const second = render(<WonTextButton engagementId={BOARD} profileId="p1" />);
    await waitFor(() => expect(m.status).toHaveBeenCalledTimes(2));
    expect(second.container.innerHTML).toBe("");
  });

  it("shows the exact words before anything is sent, and no phone number or field", async () => {
    await open();
    expect(screen.getByText(WORDS)).toBeTruthy();
    expect(screen.getByText(WON_TEXT_COPY.helper)).toBeTruthy();
    expect(document.querySelector("input")).toBeNull();
    expect(document.body.textContent).not.toMatch(/\+?\d{7,}/);
    expect(m.send).not.toHaveBeenCalled();
  });

  it("Send sends once for the board with one press id, then says so", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: WON_TEXT_COPY.send }));
    expect(await screen.findByText(WON_TEXT_COPY.sent)).toBeTruthy();
    expect(m.send).toHaveBeenCalledTimes(1);
    const sent = m.send.mock.calls[0]![0] as { data: { engagement_id: string; profile_id: string; press_id: string } };
    expect(sent.data.engagement_id).toBe(BOARD);
    expect(sent.data.profile_id).toBe("p1");
    expect(sent.data.press_id).toMatch(UUID);
    expect(Object.keys(sent.data).sort()).toEqual(["engagement_id", "press_id", "profile_id"]);
  });

  it("a second click while the first is on its way is ignored", async () => {
    let finish: (value: { ok: true }) => void = () => undefined;
    m.send.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    await open();
    const button = screen.getByRole("button", { name: WON_TEXT_COPY.send });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(m.send).toHaveBeenCalledTimes(1);
    finish({ ok: true });
    expect(await screen.findByText(WON_TEXT_COPY.sent)).toBeTruthy();
  });

  it("a refusal stays open with the plain line, and a retry is the same press", async () => {
    m.send.mockResolvedValueOnce({ ok: false, problem: WON_TEXT_COPY.failed });
    await open();
    fireEvent.click(screen.getByRole("button", { name: WON_TEXT_COPY.send }));
    expect((await screen.findByRole("alert")).textContent).toBe(WON_TEXT_COPY.failed);
    expect(screen.queryByText(WON_TEXT_COPY.sent)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: WON_TEXT_COPY.send }));
    expect(await screen.findByText(WON_TEXT_COPY.sent)).toBeTruthy();
    const ids = m.send.mock.calls.map((call) => (call[0] as { data: { press_id: string } }).data.press_id);
    expect(ids[0]).toBe(ids[1]);
  });

  it("a thrown request is told plainly and nothing claims to be sent", async () => {
    m.send.mockRejectedValueOnce(new Error("network"));
    await open();
    fireEvent.click(screen.getByRole("button", { name: WON_TEXT_COPY.send }));
    expect((await screen.findByRole("alert")).textContent).toBe(WON_TEXT_COPY.failed);
    expect(screen.queryByText(WON_TEXT_COPY.sent)).toBeNull();
  });

  it("opening the preview again is a new press", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: WON_TEXT_COPY.send }));
    await screen.findByText(WON_TEXT_COPY.sent);
    fireEvent.click(screen.getByRole("button", { name: WON_TEXT_COPY.open }));
    fireEvent.click(screen.getByRole("button", { name: WON_TEXT_COPY.send }));
    await waitFor(() => expect(m.send).toHaveBeenCalledTimes(2));
    const ids = m.send.mock.calls.map((call) => (call[0] as { data: { press_id: string } }).data.press_id);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it("awaiting approval: the words show, Send says nothing was sent, and no sent line ever appears", async () => {
    m.status.mockResolvedValue({ show: true, connected: false, preview: WORDS });
    m.send.mockResolvedValue({ ok: false, problem: WON_TEXT_COPY.notConnected });
    await open();
    expect(screen.getByText(WORDS)).toBeTruthy();
    expect(screen.getByText(WON_TEXT_COPY.awaiting)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: WON_TEXT_COPY.send }));
    expect((await screen.findByRole("alert")).textContent).toBe(WON_TEXT_COPY.notConnected);
    expect(screen.queryByText(WON_TEXT_COPY.sent)).toBeNull();
    expect(screen.getByText(WORDS)).toBeTruthy();
  });

  it("Cancel closes the preview and sends nothing", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: WON_TEXT_COPY.cancel }));
    expect(screen.queryByText(WORDS)).toBeNull();
    expect(m.send).not.toHaveBeenCalled();
  });

  it("a result that returns after the board changed changes nothing", async () => {
    let finish: (value: { ok: true }) => void = () => undefined;
    m.send.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    const view = render(<WonTextButton engagementId={BOARD} profileId="p1" />);
    fireEvent.click(await screen.findByRole("button", { name: WON_TEXT_COPY.open }));
    fireEvent.click(screen.getByRole("button", { name: WON_TEXT_COPY.send }));
    view.unmount();
    finish({ ok: true });
    await Promise.resolve();
    expect(document.body.textContent).not.toContain(WON_TEXT_COPY.sent);
  });
});

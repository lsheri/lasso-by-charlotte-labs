// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ConnectionRow } from "@/lib/mcp-connections.functions";
import { POSTHOG_CONFIG } from "@/lib/posthog-client";

vi.mock("posthog-js", () => ({ default: {} }));
const logEvent = vi.fn();
vi.mock("@/lib/telemetry", () => ({ logEvent: (...a: unknown[]) => logEvent(...a) }));

let rows: ConnectionRow[] = [];
const reveal = vi.fn(() => Promise.resolve({ secret: "s3cretkey" }));
const revoke = vi.fn(() => Promise.resolve({ ok: true }));
const create = vi.fn(() => Promise.resolve({ id: "n", kind: "link", secret: "newkey" }));
vi.mock("@/lib/mcp-connections.functions", () => ({
  CONNECTION_LIMIT_ERROR: "connection_limit",
  listConnections: () => Promise.resolve(rows),
  createConnection: (...a: unknown[]) => create(...(a as [])),
  revealConnection: (...a: unknown[]) => reveal(...(a as [])),
  renameConnection: () => Promise.resolve({ ok: true }),
  revokeConnection: (...a: unknown[]) => revoke(...(a as [])),
}));
vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: (...a: unknown[]) => unknown) => fn,
}));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ data: { id: "p1", org_id: "o1", org_name: "Acme" } }),
}));

const { ConnectYourAiCard, SHOW_SIGNIN_CONNECTIONS } =
  await import("@/components/connectors/ConnectYourAiCard");

function row(over: Partial<ConnectionRow>): ConnectionRow {
  return {
    id: "c1",
    kind: "link",
    label: "Claude",
    client_name: null,
    key_last4: "ab12",
    created_at: "2026-09-01T00:00:00Z",
    last_used_at: null,
    can_reveal: true,
    older: false,
    ...over,
  };
}

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ConnectYourAiCard />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  reveal.mockClear();
  revoke.mockClear();
  create.mockClear();
});
afterEach(() => cleanup());

describe("M2 connections settings", () => {
  it("1. an older link shows no Reveal and shows the older line", async () => {
    rows = [row({ older: true, can_reveal: false, label: null })];
    renderCard();
    expect(await screen.findByText(/Made before 1 Oct, can't be shown again/)).toBeTruthy();
    expect(screen.queryByText("Reveal")).toBeNull();
    expect(screen.getByText("Older link")).toBeTruthy();
  });

  it("2. Reveal calls reveal and shows the URL", async () => {
    rows = [row({})];
    renderCard();
    fireEvent.click(await screen.findByText("Reveal"));
    await waitFor(() => expect(reveal).toHaveBeenCalledWith({ data: { id: "c1" } }));
    expect((await screen.findByTestId("revealed-url")).textContent).toContain("/api/mcp/s3cretkey");
  });

  it("3. Disconnect asks before revoking", async () => {
    rows = [row({})];
    renderCard();
    fireEvent.click(await screen.findByText("Disconnect"));
    expect(revoke).not.toHaveBeenCalled();
    expect(await screen.findByText("Disconnect Claude?")).toBeTruthy();
    const buttons = screen.getAllByRole("button", { name: "Disconnect" });
    fireEvent.click(buttons[buttons.length - 1] as HTMLElement);
    await waitFor(() => expect(revoke).toHaveBeenCalledWith({ data: { id: "c1" } }));
  });

  it("4. refuses a 0 and an 81 character name", async () => {
    rows = [];
    renderCard();
    const input = await screen.findByLabelText("Name this connection");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.click(screen.getByText("Create link"));
    expect(await screen.findByText("Give the connection a name, up to 80 characters.")).toBeTruthy();
    fireEvent.change(input, { target: { value: "x".repeat(81) } });
    fireEvent.click(screen.getByText("Create link"));
    expect(screen.getByText("Give the connection a name, up to 80 characters.")).toBeTruthy();
    expect(create).not.toHaveBeenCalled();
  });

  it("5. the revealed URL and Copy carry the masking marker", async () => {
    rows = [row({})];
    renderCard();
    fireEvent.click(await screen.findByText("Reveal"));
    const url = await screen.findByTestId("revealed-url");
    const selector = POSTHOG_CONFIG.session_recording.maskTextSelector;
    expect(url.matches(selector)).toBe(true);
    expect(screen.getByTestId("copy-url").matches(selector)).toBe(true);
  });

  it("6. renders no Regenerate control", async () => {
    rows = [row({})];
    renderCard();
    await screen.findByText("Reveal");
    expect(screen.queryByText(/regenerate/i)).toBeNull();
    expect(screen.queryByText(/generate a new url/i)).toBeNull();
  });

  it("7. hides signin rows while the flag is false", async () => {
    expect(SHOW_SIGNIN_CONNECTIONS).toBe(false);
    rows = [row({ id: "s1", kind: "signin", client_name: "Claude Desktop", label: "Signin" })];
    renderCard();
    await screen.findByText("Create link");
    expect(screen.queryByText(/Signed in from/)).toBeNull();
    expect(screen.queryAllByTestId("connection-row")).toHaveLength(0);
  });
});

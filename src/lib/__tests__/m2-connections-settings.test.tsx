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

  it("1b. an unlabelled current connection is not described as older", async () => {
    rows = [row({ older: false, label: null })];
    renderCard();
    expect(await screen.findByText("Unnamed connection")).toBeTruthy();
    expect(screen.queryByText("Older link")).toBeNull();
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

  it("5. the revealed URL and Copy are excluded from autocapture", async () => {
    rows = [row({})];
    renderCard();
    fireEvent.click(await screen.findByText("Reveal"));
    for (const el of [await screen.findByTestId("revealed-url"), screen.getByTestId("copy-url")]) {
      expect(el.classList.contains("ph-no-autocapture")).toBe(true);
      expect(el.hasAttribute("data-ph-no-autocapture")).toBe(true);
    }
  });

  it("5b. session replay still masks all text", () => {
    expect(POSTHOG_CONFIG.session_recording.maskTextSelector).toBe("*");
  });

  it("8. the consent line renders with the revealed URL", async () => {
    rows = [row({})];
    renderCard();
    fireEvent.click(await screen.findByText("Reveal"));
    expect(
      await screen.findByText("Anyone with this link can add work to Acme as you. Keep it private."),
    ).toBeTruthy();
  });

  it("9. creating a link sends mcp.connection_created", async () => {
    rows = [];
    logEvent.mockClear();
    renderCard();
    fireEvent.change(await screen.findByLabelText("Name this connection"), { target: { value: "Claude" } });
    fireEvent.click(screen.getByText("Create link"));
    await waitFor(() =>
      expect(logEvent).toHaveBeenCalledWith("mcp.connection_created", "o1", { kind: "link" }),
    );
  });

  it("10. Reveal sends mcp.connection_revealed", async () => {
    rows = [row({})];
    logEvent.mockClear();
    renderCard();
    fireEvent.click(await screen.findByText("Reveal"));
    await waitFor(() =>
      expect(logEvent).toHaveBeenCalledWith("mcp.connection_revealed", "o1", { kind: "link" }),
    );
  });

  it("11. Disconnect sends mcp.connection_revoked via settings", async () => {
    rows = [row({})];
    logEvent.mockClear();
    renderCard();
    fireEvent.click(await screen.findByText("Disconnect"));
    await screen.findByText("Disconnect Claude?");
    const buttons = screen.getAllByRole("button", { name: "Disconnect" });
    fireEvent.click(buttons[buttons.length - 1] as HTMLElement);
    await waitFor(() =>
      expect(logEvent).toHaveBeenCalledWith("mcp.connection_revoked", "o1", { kind: "link", via: "settings" }),
    );
  });

  it("12. Disconnect after Replace sends via replace", async () => {
    rows = [row({ id: "old", older: true, can_reveal: false, label: null })];
    logEvent.mockClear();
    renderCard();
    fireEvent.change(await screen.findByLabelText("Name this connection"), { target: { value: "Cursor" } });
    fireEvent.click(screen.getByText("Replace"));
    expect(
      await screen.findByText("Your new link is ready. Paste it into your tool, then disconnect the older link."),
    ).toBeTruthy();
    fireEvent.click(screen.getByText("Disconnect"));
    await screen.findByText("Disconnect Older link?");
    const buttons = screen.getAllByRole("button", { name: "Disconnect" });
    fireEvent.click(buttons[buttons.length - 1] as HTMLElement);
    await waitFor(() =>
      expect(logEvent).toHaveBeenCalledWith("mcp.connection_revoked", "o1", { kind: "link", via: "replace" }),
    );
  });

  it("13. Replace with an empty name is refused and calls nothing", async () => {
    rows = [row({ id: "old", older: true, can_reveal: false, label: null })];
    logEvent.mockClear();
    renderCard();
    fireEvent.click(await screen.findByText("Replace"));
    expect(await screen.findByText("Give the connection a name, up to 80 characters.")).toBeTruthy();
    expect(create).not.toHaveBeenCalled();
    expect(logEvent).not.toHaveBeenCalled();
  });

  it("13b. a Replace refusal appears inside the selected older row", async () => {
    rows = [
      row({ id: "old-1", older: true, can_reveal: false, label: null }),
      row({ id: "old-2", older: true, can_reveal: false, label: null }),
    ];
    renderCard();
    const replaceButtons = await screen.findAllByRole("button", { name: "Replace" });
    fireEvent.click(replaceButtons[1] as HTMLElement);
    const alerts = await screen.findAllByRole("alert");
    expect(alerts).toHaveLength(1);
    const connectionRows = screen.getAllByTestId("connection-row");
    expect(alerts[0]?.closest('[data-testid="connection-row"]')).toBe(connectionRows[1]);
    expect(create).not.toHaveBeenCalled();
  });

  it("6. renders no Regenerate control", async () => {
    rows = [row({})];
    renderCard();
    await screen.findByText("Reveal");
    expect(screen.queryByText(/regenerate/i)).toBeNull();
    expect(screen.queryByText(/generate a new url/i)).toBeNull();
  });

  it("7. shows signin rows now the flag is on", async () => {
    expect(SHOW_SIGNIN_CONNECTIONS).toBe(true);
    rows = [row({ id: "s1", kind: "signin", client_name: "Claude", label: "Claude", key_last4: null, can_reveal: false })];
    renderCard();
    expect(await screen.findByText("Signed in from Claude")).toBeTruthy();
    expect(screen.queryAllByTestId("connection-row")).toHaveLength(1);
    expect(screen.queryByText("Reveal")).toBeNull();
    expect(screen.queryByText(/····/)).toBeNull();
  });

  it("7b. disconnecting a signin row uses the sign-in sentence and logs the revoke", async () => {
    rows = [row({ id: "s1", kind: "signin", client_name: "Claude", label: "Claude", key_last4: null, can_reveal: false })];
    logEvent.mockClear();
    renderCard();
    fireEvent.click(await screen.findByText("Disconnect"));
    expect(
      await screen.findByText(
        "Claude stops being able to add or read work right away. To use it again, choose Connect in Claude.",
      ),
    ).toBeTruthy();
    const buttons = screen.getAllByRole("button", { name: "Disconnect" });
    fireEvent.click(buttons[buttons.length - 1] as HTMLElement);
    await waitFor(() => expect(revoke).toHaveBeenCalledWith({ data: { id: "s1" } }));
    await waitFor(() =>
      expect(logEvent).toHaveBeenCalledWith("mcp.connection_revoked", "o1", { kind: "signin", via: "settings" }),
    );
  });

  it("14. a link row carries the Link kind label and not the sign-in one", async () => {
    rows = [row({})];
    renderCard();
    expect(await screen.findByText("Link")).toBeTruthy();
    expect(screen.queryByText("Signed in")).toBeNull();
  });

  it("15. a signin row carries the Signed in kind label and not the link one", async () => {
    rows = [row({ id: "s1", kind: "signin", client_name: "Claude", label: "Claude", key_last4: null, can_reveal: false })];
    renderCard();
    expect(await screen.findByText("Signed in")).toBeTruthy();
    expect(screen.queryByText("Link")).toBeNull();
  });

  it("16. a signin row still shows its Signed in from secondary line", async () => {
    rows = [row({ id: "s1", kind: "signin", client_name: "Claude", label: "Claude", key_last4: null, can_reveal: false })];
    renderCard();
    expect(await screen.findByText("Signed in from Claude")).toBeTruthy();
    expect(screen.findByText("Signed in")).toBeTruthy();
  });
});

// @vitest-environment jsdom
import { readFileSync } from "node:fs";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MCP_PUSH_BLOCKED_NOTE,
  MCP_PUSH_PHRASE,
  MCP_REGENERATE_WARNING,
  MCP_SERVER_NAME,
  MCP_SETUP_STEPS,
  MCP_SIGNIN_NOTE,
  MCP_SIGNIN_STEPS,
  MCP_SIGNIN_URL,
  MCP_VENDORS,
} from "@/lib/mcp-setup-steps";

const BANNED = /(telemetry|analytics|data collection|scor(e|ed|ing)|monitor|track|—)/i;

const logEvent = vi.fn();
vi.mock("@/lib/telemetry", () => ({ logEvent: (...args: unknown[]) => logEvent(...args) }));

let token: { created_at: string; last_used_at: string | null } | null = null;
vi.mock("@/lib/mcp-connections.functions", () => ({
  CONNECTION_LIMIT_ERROR: "connection_limit",
  listConnections: () =>
    Promise.resolve(
      token
        ? [{ id: "c1", kind: "link", label: "Claude", client_name: null, key_last4: "abcd", can_reveal: true, older: false, ...token }]
        : [],
    ),
  createConnection: () => Promise.resolve({ id: "c2", kind: "link", secret: "raw" }),
  revealConnection: () => Promise.resolve({ secret: "raw" }),
  renameConnection: () => Promise.resolve({ ok: true }),
  revokeConnection: () => Promise.resolve({ ok: true }),
}));
vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: (...a: unknown[]) => unknown) => fn,
}));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ data: { id: "p1", org_id: "o1" } }),
}));

const { ConnectYourAiCard, SetupSteps, connectorStatusLine } =
  await import("@/components/connectors/ConnectYourAiCard");

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ConnectYourAiCard />
    </QueryClientProvider>,
  );
}

afterEach(() => cleanup());

describe("shared setup steps", () => {
  it("gives both vendors steps and clean copy", () => {
    for (const vendor of MCP_VENDORS) {
      expect(MCP_SETUP_STEPS[vendor].length).toBeGreaterThan(1);
      for (const step of MCP_SETUP_STEPS[vendor]) expect(BANNED.test(step)).toBe(false);
      for (const step of MCP_SIGNIN_STEPS[vendor] ?? []) expect(BANNED.test(step)).toBe(false);
    }
    expect(BANNED.test(MCP_SIGNIN_NOTE)).toBe(false);
    expect(MCP_SERVER_NAME).toBe("Lasso by Charlotte Labs");
    expect(BANNED.test(MCP_REGENERATE_WARNING)).toBe(false);
    expect(BANNED.test(MCP_PUSH_PHRASE)).toBe(false);
    expect(BANNED.test(MCP_PUSH_BLOCKED_NOTE)).toBe(false);
  });

  it("carries the sign-in path for claude only, with no URL in the card", () => {
    expect(MCP_SIGNIN_STEPS.claude).toHaveLength(4);
    expect(MCP_SIGNIN_STEPS.chatgpt).toBeUndefined();
    expect(MCP_SIGNIN_STEPS.claude!.join("\n")).toContain(MCP_SIGNIN_URL);
    const source = readFileSync("src/components/connectors/ConnectYourAiCard.tsx", "utf8");
    expect(source).not.toContain(MCP_SIGNIN_URL);
  });

  it("is the only place the steps are defined", () => {
    for (const path of [
      "src/components/connectors/ConnectYourAiCard.tsx",
      "src/components/onboarding/McpSetupCard.tsx",
    ]) {
      const source = readFileSync(path, "utf8");
      expect(source).toContain("@/lib/mcp-setup-steps");
      expect(source).not.toContain("Add custom connector.");
      expect(source).not.toContain("custom MCP server");
    }
  });
});

describe("status line", () => {
  it("reads correctly in all three states", () => {
    expect(connectorStatusLine(null)).toBe("No connector yet");
    expect(connectorStatusLine({ created_at: "2026-01-01", last_used_at: null })).toBe(
      "Set up, no work pushed yet",
    );
    expect(connectorStatusLine({ created_at: "2026-01-01", last_used_at: "2026-02-02" })).toBe(
      "Your connector is live",
    );
  });
});

describe("ConnectYourAiCard", () => {
  it("shows the steps expanded with no connector, and no confirm needed", async () => {
    token = null;
    logEvent.mockClear();
    renderCard();
    expect(await screen.findByText("No connector yet")).toBeTruthy();
    expect(screen.getByText(MCP_SETUP_STEPS.claude[0] as string)).toBeTruthy();
    expect(screen.getByText("Create link")).toBeTruthy();
    expect(screen.queryByText(MCP_REGENERATE_WARNING)).toBeNull();
  });

  it("hides steps behind the toggle once live, with no regenerate control", async () => {
    token = { created_at: "2026-01-01", last_used_at: "2026-02-02" };
    logEvent.mockClear();
    renderCard();
    expect(await screen.findByText("Your connector is live")).toBeTruthy();
    expect(screen.queryByText(MCP_SETUP_STEPS.claude[0] as string)).toBeNull();

    expect(screen.queryByText("Generate a new URL")).toBeNull();

    fireEvent.click(screen.getByText("Setup instructions"));
    expect(screen.getByText(MCP_SETUP_STEPS.claude[0] as string)).toBeTruthy();
    expect(logEvent).toHaveBeenCalledTimes(1);
    expect(logEvent).toHaveBeenCalledWith("connector.setup_opened", "o1", {
      surface: "mcp",
      had_connector: true,
    });
  });

  it("shows the blocked push line below the steps, defined only in mcp-setup-steps", async () => {
    token = null;
    logEvent.mockClear();
    renderCard();
    expect(await screen.findByText(MCP_PUSH_BLOCKED_NOTE)).toBeTruthy();
    const source = readFileSync("src/components/connectors/ConnectYourAiCard.tsx", "utf8");
    expect(source).toContain("MCP_PUSH_BLOCKED_NOTE");
    expect(source).not.toContain("If your AI stops a push before it runs");
  });

  it("shows the Sign in group before the link group for claude, and no headings for chatgpt", async () => {
    token = null;
    renderCard();
    expect(await screen.findByText("No connector yet")).toBeTruthy();
    expect(screen.getAllByText("Sign in")).toHaveLength(1);
    expect(screen.getAllByText("Or paste a link")).toHaveLength(1);
    expect(screen.getByText(MCP_SIGNIN_NOTE)).toBeTruthy();
    const signin = screen.getByText("Sign in");
    const link = screen.getByText("Or paste a link");
    expect(link.compareDocumentPosition(signin) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });
});

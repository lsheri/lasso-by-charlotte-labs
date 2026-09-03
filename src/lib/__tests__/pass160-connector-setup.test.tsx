// @vitest-environment jsdom
import { readFileSync } from "node:fs";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  MCP_PUSH_PHRASE,
  MCP_REGENERATE_WARNING,
  MCP_SERVER_NAME,
  MCP_SETUP_STEPS,
  MCP_VENDORS,
} from "@/lib/mcp-setup-steps";

const BANNED = /(telemetry|analytics|data collection|scor(e|ed|ing)|monitor|track|—)/i;

const logEvent = vi.fn();
vi.mock("@/lib/telemetry", () => ({ logEvent: (...args: unknown[]) => logEvent(...args) }));

let token: { created_at: string; last_used_at: string | null } | null = null;
vi.mock("@/lib/mcp-tokens.functions", () => ({
  getMcpToken: () => Promise.resolve(token),
  createMcpToken: () => Promise.resolve({ token: "raw" }),
  revokeMcpToken: () => Promise.resolve({ ok: true }),
}));
vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: (...a: unknown[]) => unknown) => fn,
}));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ data: { id: "p1", org_id: "o1" } }),
}));

const { ConnectYourAiCard, connectorStatusLine } = await import(
  "@/components/connectors/ConnectYourAiCard"
);

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ConnectYourAiCard />
    </QueryClientProvider>,
  );
}

describe("shared setup steps", () => {
  it("gives both vendors steps and clean copy", () => {
    for (const vendor of MCP_VENDORS) {
      expect(MCP_SETUP_STEPS[vendor].length).toBeGreaterThan(1);
      for (const step of MCP_SETUP_STEPS[vendor]) expect(BANNED.test(step)).toBe(false);
    }
    expect(MCP_SERVER_NAME).toBe("Lasso by Charlotte Labs");
    expect(BANNED.test(MCP_REGENERATE_WARNING)).toBe(false);
    expect(BANNED.test(MCP_PUSH_PHRASE)).toBe(false);
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
    expect(screen.getByText("Generate my connector URL")).toBeTruthy();
    expect(screen.queryByText(MCP_REGENERATE_WARNING)).toBeNull();
  });

  it("hides steps behind the toggle once live, and asks before replacing the URL", async () => {
    token = { created_at: "2026-01-01", last_used_at: "2026-02-02" };
    logEvent.mockClear();
    renderCard();
    expect(await screen.findByText("Your connector is live")).toBeTruthy();
    expect(screen.queryByText(MCP_SETUP_STEPS.claude[0] as string)).toBeNull();

    fireEvent.click(screen.getByText("Generate a new URL"));
    expect(screen.getByText(MCP_REGENERATE_WARNING)).toBeTruthy();
    expect(screen.getByText("Yes, generate a new URL")).toBeTruthy();

    fireEvent.click(screen.getByText("Setup instructions"));
    expect(screen.getByText(MCP_SETUP_STEPS.claude[0] as string)).toBeTruthy();
    expect(logEvent).toHaveBeenCalledTimes(1);
    expect(logEvent).toHaveBeenCalledWith("connector.setup_opened", "o1", {
      surface: "connectors",
      had_connector: true,
    });
  });
});

import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  passedToken: "",
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: vi.fn(async (name: string) =>
      name === "mcp_resolve_key" ? { data: mocks.rows, error: null } : { data: null, error: null },
    ),
    from: vi.fn(),
  },
}));
vi.mock("../telemetry.server", () => ({ recordEvent: vi.fn() }));

import { handleMcpRequest, resolveOwner } from "../mcp-handler.server";

const ownerRow = {
  connection_id: "connection-1",
  profile_id: "profile-1",
  org_id: "org-1",
  user_id: "user-1",
  kind: "link",
  scopes: ["read", "write"],
  read_only: false,
  legacy: true,
};

function rpcRequest(name: string): Request {
  return new Request("https://x.test/api/mcp/key", {
    method: "POST",
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: {} } }),
  });
}

beforeEach(() => {
  mocks.rows = [];
});

describe("M1 connections resolver", () => {
  it("resolves the first connection row", async () => {
    mocks.rows = [ownerRow];
    await expect(resolveOwner("abc")).resolves.toMatchObject({
      tokenId: "connection-1",
      profileId: "profile-1",
      orgId: "org-1",
      userId: "user-1",
      kind: "link",
      readOnly: false,
      legacy: true,
      authKind: "link",
    });
  });

  it("returns null for an empty result and the handler answers 401", async () => {
    await expect(resolveOwner("abc")).resolves.toBeNull();
    const response = await handleMcpRequest(rpcRequest("push_conversation"), "abc");
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("refuses writes but permits a listing call for read-only connections", async () => {
    mocks.rows = [{ ...ownerRow, read_only: true }];
    const denied = await handleMcpRequest(rpcRequest("push_conversation"), "abc");
    expect(JSON.stringify(await denied.json())).toContain(
      "This connection can read but not add work right now.",
    );
    const listed = await handleMcpRequest(
      new Request("https://x.test/api/mcp/key", {
        method: "POST",
        body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
      }),
      "abc",
    );
    expect(listed.status).toBe(200);
  });

  it("keeps old token-table reads out of the runtime files", () => {
    const handler = readFileSync("src/lib/mcp-handler.server.ts", "utf8");
    const tokens = readFileSync("src/lib/mcp-tokens.functions.ts", "utf8");
    expect(handler).not.toContain('.from("mcp_tokens")');
    expect(tokens).toContain("mcp_create_connection");
    expect(tokens).not.toContain('.from("mcp_tokens")');
  });
});
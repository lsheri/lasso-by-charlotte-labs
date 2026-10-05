import { beforeEach, describe, expect, it, vi } from "vitest";

const JWT = "aaa.bbb.ccc";
const mocks = vi.hoisted(() => ({
  keyRows: [] as Record<string, unknown>[],
  signinRows: [] as Record<string, unknown>[],
  claims: { data: null as unknown, error: null as unknown },
  getClaims: vi.fn(),
  rpc: vi.fn(),
  recordAnonymousEvent: vi.fn(async (..._args: unknown[]) => undefined),
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    auth: { getClaims: mocks.getClaims },
    rpc: mocks.rpc,
    from: vi.fn(),
  },
}));
vi.mock("../telemetry.server", () => ({
  recordEvent: vi.fn(),
  recordAnonymousEvent: mocks.recordAnonymousEvent,
}));

import { handleMcpRequest, resolveOwner } from "../mcp-handler.server";

const row = {
  connection_id: "conn-9",
  profile_id: "profile-1",
  org_id: "org-1",
  user_id: "user-1",
  kind: "signin",
  scopes: ["read", "write"],
  read_only: false,
  legacy: false,
};

function call(name: string, method = "tools/call"): Request {
  return new Request("https://x.test/api/mcp", {
    method: "POST",
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: { name, arguments: {} } }),
  });
}

function failures() {
  return mocks.recordAnonymousEvent.mock.calls.filter((c) => (c as unknown[])[0] === "mcp.auth_failed");
}

beforeEach(() => {
  mocks.keyRows = [];
  mocks.signinRows = [];
  mocks.claims = { data: { claims: { sub: "user-1", client_id: "client-7" } }, error: null };
  mocks.getClaims.mockReset().mockImplementation(async () => mocks.claims);
  mocks.rpc.mockReset().mockImplementation(async (name: string) => ({
    data: name === "mcp_resolve_key" ? mocks.keyRows : name === "mcp_resolve_signin" ? mocks.signinRows : null,
    error: null,
  }));
  mocks.recordAnonymousEvent.mockClear();
});

describe("M3-C2 sign-in resolver", () => {
  it("(a) verifies a header JWT and resolves the sign-in connection", async () => {
    mocks.signinRows = [row];
    const owner = await resolveOwner(JWT, true);
    expect(mocks.getClaims).toHaveBeenCalledWith(JWT);
    expect(mocks.rpc).toHaveBeenCalledWith("mcp_resolve_signin", { p_user_id: "user-1", p_oauth_client_id: "client-7" });
    expect(owner).toMatchObject({ authKind: "signin", kind: "signin", tokenId: "conn-9" });
  });

  it("(b) an lsk_live_ header key takes the key path", async () => {
    mocks.keyRows = [{ ...row, kind: "link" }];
    await resolveOwner("lsk_live_abc", true);
    expect(mocks.rpc).toHaveBeenCalledWith("mcp_resolve_key", expect.anything());
    expect(mocks.getClaims).not.toHaveBeenCalled();
  });

  it("(c) a 64-hex key on the path route takes the key path", async () => {
    mocks.keyRows = [{ ...row, kind: "link" }];
    const owner = await resolveOwner("a".repeat(64), false);
    expect(mocks.rpc).toHaveBeenCalledWith("mcp_resolve_key", expect.anything());
    expect(owner?.authKind).toBe("link");
  });

  it("(d) a JWT on the path route takes the key path", async () => {
    await resolveOwner(JWT, false);
    expect(mocks.getClaims).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith("mcp_resolve_key", expect.anything());
  });

  it("(e) a getClaims error answers 401 and records bad_token", async () => {
    mocks.claims = { data: null, error: new Error("bad") };
    const response = await handleMcpRequest(call("push_conversation"), JWT, "header");
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(failures()[0]?.[2]).toEqual({ kind: "signin", reason: "bad_token" });
  });

  it("(f) verified claims without client_id are bad_token", async () => {
    mocks.claims = { data: { claims: { sub: "user-1" } }, error: null };
    await handleMcpRequest(call("push_conversation"), JWT, "header");
    expect(failures()[0]?.[2]).toEqual({ kind: "signin", reason: "bad_token" });
    expect(mocks.rpc).not.toHaveBeenCalledWith("mcp_resolve_signin", expect.anything());
  });

  it("(g) a verified token with no row is no_connection", async () => {
    await handleMcpRequest(call("push_conversation"), JWT, "header");
    expect(failures()[0]?.[2]).toEqual({ kind: "signin", reason: "no_connection" });
  });

  it("(h) an unknown lsk key on the header route is bad_key", async () => {
    await handleMcpRequest(call("push_conversation"), "lsk_live_nope", "header");
    expect(failures()[0]?.[2]).toEqual({ kind: "header", reason: "bad_key" });
  });

  it("(i) a successful resolution records no failure", async () => {
    mocks.signinRows = [row];
    await handleMcpRequest(call("", "tools/list"), JWT, "header");
    expect(failures()).toHaveLength(0);
  });

  it("(j) dims carry only kind and reason and never the token", async () => {
    const token = "lsk_live_secretvalue123";
    await handleMcpRequest(call("push_conversation"), token, "header");
    const recorded = failures()[0] as unknown[];
    expect(Object.keys(recorded[2] as object).sort()).toEqual(["kind", "reason"]);
    expect(JSON.stringify(mocks.recordAnonymousEvent.mock.calls)).not.toContain(token);
    expect(recorded[3]).toBeUndefined();
  });

  it("(k) a read-only sign-in connection is refused on push_conversation", async () => {
    mocks.signinRows = [{ ...row, read_only: true }];
    const response = await handleMcpRequest(call("push_conversation"), JWT, "header");
    expect(JSON.stringify(await response.json())).toContain("This connection can read but not add work right now.");
  });
});

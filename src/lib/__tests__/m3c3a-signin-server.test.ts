import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recordEvent: vi.fn(async (..._args: unknown[]) => undefined),
  authorization: "Bearer user-token",
}));
vi.mock("../telemetry.server", () => ({ recordEvent: mocks.recordEvent }));
vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("https://x.test", { headers: { authorization: mocks.authorization } }),
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));

import { decideSigninCore, revokeGrantAfterDisconnect } from "../mcp-signin.server";
import { revokeOAuthGrant } from "../oauth-grants.server";
import { CONNECTION_LIMIT_ERROR } from "../mcp-connections.functions";

const NAME = "Sneaky Tool 9000";
const CID = "cid-123";

function fakeSupabase(opts: {
  profile?: { org_id: string } | null;
  rpc?: { data: unknown; error: { code?: string; message: string } | null };
  connection?: { kind: string; oauth_client_id: string | null } | null;
}) {
  const rpc = vi.fn(async () => opts.rpc ?? { data: "conn-1", error: null });
  const from = vi.fn((table: string) => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    chain["select"] = self;
    chain["eq"] = self;
    chain["is"] = self;
    chain["maybeSingle"] = async () => ({
      data: table === "profiles" ? opts.profile ?? null : opts.connection ?? null,
      error: null,
    });
    return chain;
  });
  return { client: { rpc, from } as never, rpc };
}

const approve = (redirect: string | null = "https://claude.ai/api/mcp/auth_callback") => ({
  decision: "approve" as const,
  profile_id: "p1",
  client_id: CID,
  client_name: NAME,
  redirect_uri: redirect,
});

beforeEach(() => mocks.recordEvent.mockClear());

describe("M3-C3a sign-in server", () => {
  it("(a) approve binds and records connection_created with kind and client", async () => {
    const { client, rpc } = fakeSupabase({ profile: { org_id: "o1" } });
    const result = await decideSigninCore(client, "u1", approve());
    expect(rpc).toHaveBeenCalledWith("mcp_bind_signin", { p_profile_id: "p1", p_oauth_client_id: CID, p_client_label: NAME });
    const [, payload] = mocks.recordEvent.mock.calls[0] as [unknown, { eventType: string; dims: unknown }];
    expect(payload.eventType).toBe("mcp.connection_created");
    expect(payload.dims).toEqual({ kind: "signin", client: "claude" });
    expect(result).toEqual({ connection_id: "conn-1" });
  });

  it("(b) approve for someone else's profile refuses without binding", async () => {
    const { client, rpc } = fakeSupabase({ profile: null });
    await expect(decideSigninCore(client, "u1", approve())).rejects.toThrow("not_your_workspace");
    expect(rpc).not.toHaveBeenCalled();
    expect(mocks.recordEvent).not.toHaveBeenCalled();
  });

  it("(c) the connection limit maps to CONNECTION_LIMIT_ERROR", async () => {
    const { client } = fakeSupabase({ profile: { org_id: "o1" }, rpc: { data: null, error: { code: "54000", message: "too many" } } });
    await expect(decideSigninCore(client, "u1", approve())).rejects.toThrow(CONNECTION_LIMIT_ERROR);
    expect(mocks.recordEvent).not.toHaveBeenCalled();
  });

  it("(d) any other error is bind_failed with no database text", async () => {
    const { client } = fakeSupabase({ profile: { org_id: "o1" }, rpc: { data: null, error: { code: "XX000", message: "secret db detail" } } });
    const err = await decideSigninCore(client, "u1", approve()).catch((e: Error) => e);
    expect((err as Error).message).toBe("bind_failed");
    expect((err as Error).message).not.toContain("secret db detail");
  });

  it("(e) deny records consent_denied and never binds", async () => {
    const { client, rpc } = fakeSupabase({ profile: { org_id: "o1" } });
    const result = await decideSigninCore(client, "u1", { ...approve("https://evil.com/cb"), decision: "deny" });
    expect(rpc).not.toHaveBeenCalled();
    const [, payload] = mocks.recordEvent.mock.calls[0] as [unknown, { eventType: string; dims: unknown }];
    expect(payload.eventType).toBe("mcp.consent_denied");
    expect(payload.dims).toEqual({ client: "other" });
    expect(result).toEqual({ ok: true });
  });

  it("(f) no recorded argument carries the raw name or the client id", async () => {
    const { client } = fakeSupabase({ profile: { org_id: "o1" } });
    await decideSigninCore(client, "u1", approve("https://evil.com/cb"));
    await decideSigninCore(client, "u1", { ...approve("https://evil.com/cb"), decision: "deny" });
    expect(mocks.recordEvent).toHaveBeenCalledTimes(2);
    const recorded = JSON.stringify(mocks.recordEvent.mock.calls.map((c) => c[1]));
    expect(recorded).not.toContain(NAME);
    expect(recorded).not.toContain(CID);
  });

  it("(g) a signin row revokes its grant", async () => {
    const revoke = vi.fn(async () => true);
    const { client } = fakeSupabase({ connection: { kind: "signin", oauth_client_id: CID } });
    await expect(revokeGrantAfterDisconnect(client, "c1", revoke)).resolves.toBe(true);
    expect(revoke).toHaveBeenCalledWith(CID);
  });

  it("(h) a link row never revokes", async () => {
    const revoke = vi.fn(async () => true);
    const { client } = fakeSupabase({ connection: { kind: "link", oauth_client_id: null } });
    await expect(revokeGrantAfterDisconnect(client, "c1", revoke)).resolves.toBe(false);
    expect(revoke).not.toHaveBeenCalled();
  });

  it("(i) a failing or throwing revoke still resolves", async () => {
    const { client } = fakeSupabase({ connection: { kind: "signin", oauth_client_id: CID } });
    await expect(revokeGrantAfterDisconnect(client, "c1", async () => false)).resolves.toBe(false);
    await expect(revokeGrantAfterDisconnect(client, "c1", async () => { throw new Error("x"); })).resolves.toBe(false);
  });

  describe("(j) revokeOAuthGrant", () => {
    const env = { ...process.env };
    afterEach(() => {
      process.env = { ...env };
      vi.unstubAllGlobals();
    });

    it("sends the DELETE with apikey and the incoming Authorization, false on 404", async () => {
      process.env["SUPABASE_URL"] = "https://sb.test";
      process.env["SUPABASE_PUBLISHABLE_KEY"] = "pk";
      const fetchMock = vi.fn(async () => new Response(null, { status: 404 }));
      vi.stubGlobal("fetch", fetchMock);
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      await expect(revokeOAuthGrant(CID)).resolves.toBe(false);
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toBe("https://sb.test/auth/v1/user/oauth/grants?client_id=cid-123");
      expect(init.method).toBe("DELETE");
      expect(init.headers).toMatchObject({ apikey: "pk", Authorization: "Bearer user-token" });
      expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(CID);
      expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("user-token");
      errorSpy.mockRestore();
    });
  });
});

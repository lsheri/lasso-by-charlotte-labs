import { describe, expect, it, vi } from "vitest";
import {
  handleHeaderMcp,
  buildOAuthProtectedResourceResponse,
  MCP_RESOURCE_URL,
  OAUTH_RESOURCE_METADATA_URL,
} from "@/lib/mcp-header.server";

function metadataRequest(path: string): Request {
  return new Request(`https://lasso.charlotte-labs.com${path}`, { method: "GET" });
}

describe("M3-C1 OAuth discovery", () => {
  it("1. serves resource exactly equal to the production MCP URL", async () => {
    const response = buildOAuthProtectedResourceResponse(
      metadataRequest("/.well-known/oauth-protected-resource"),
    );
    const body = await response.json();
    expect(MCP_RESOURCE_URL).toBe("https://lasso.charlotte-labs.com/api/mcp");
    expect(body.resource).toBe(MCP_RESOURCE_URL);
  });

  it("2. authorization_servers has exactly the Supabase auth entry", async () => {
    const response = buildOAuthProtectedResourceResponse(
      metadataRequest("/.well-known/oauth-protected-resource"),
    );
    const body = await response.json();
    expect(body.authorization_servers).toEqual([
      "https://oksycelinhrffzabdguy.supabase.co/auth/v1",
    ]);
  });

  it("3. the body has no scopes_supported key", async () => {
    const response = buildOAuthProtectedResourceResponse(
      metadataRequest("/.well-known/oauth-protected-resource"),
    );
    const body = await response.json();
    expect("scopes_supported" in body).toBe(false);
  });

  it("4. both route paths return the same body", async () => {
    const bare = await buildOAuthProtectedResourceResponse(
      metadataRequest("/.well-known/oauth-protected-resource"),
    ).text();
    const pathed = await buildOAuthProtectedResourceResponse(
      metadataRequest("/.well-known/oauth-protected-resource/api/mcp"),
    ).text();
    expect(pathed).toBe(bare);
  });

  it("5. a missing authorization header answers 401 with the challenge", async () => {
    const load = async () => ({
      CORS_HEADERS: {},
      handleMcpRequest: vi.fn(async () => new Response("ok")),
    });
    const response = await handleHeaderMcp(
      new Request("https://x.test/api/mcp", { method: "POST" }),
      load,
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toContain(
      `resource_metadata="${OAUTH_RESOURCE_METADATA_URL}"`,
    );
    expect(OAUTH_RESOURCE_METADATA_URL).toBe(
      "https://lasso.charlotte-labs.com/api/oauth-protected-resource",
    );
  });

  it("6. a bearer the handler rejects with 401 also carries the challenge", async () => {
    const load = async () => ({
      CORS_HEADERS: {},
      handleMcpRequest: vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
      ),
    });
    const response = await handleHeaderMcp(
      new Request("https://x.test/api/mcp", {
        method: "POST",
        headers: { Authorization: "Bearer bad" },
      }),
      load,
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toContain(
      `resource_metadata="${OAUTH_RESOURCE_METADATA_URL}"`,
    );
  });

  it("7. a 200 from the handler carries no challenge header", async () => {
    const load = async () => ({
      CORS_HEADERS: {},
      handleMcpRequest: vi.fn(async () => new Response("ok")),
    });
    const response = await handleHeaderMcp(
      new Request("https://x.test/api/mcp", {
        method: "POST",
        headers: { Authorization: "Bearer good" },
      }),
      load,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("WWW-Authenticate")).toBeNull();
  });
});

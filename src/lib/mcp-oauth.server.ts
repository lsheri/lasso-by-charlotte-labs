/**
 * OAuth 2.1 for outbound MCP servers, server side only.
 *
 * The flow is the standard one an MCP client runs: read the protected resource
 * metadata the server points at, read the authorization server metadata, register
 * this app dynamically, then authorization code with PKCE. Nothing here is
 * Wispr shaped; the next MCP server we read from can reuse all of it.
 */

import { McpClientError } from "@/lib/mcp-client.server";

export type ProtectedResource = {
  resource: string;
  authorizationServer: string;
  scopes: string[];
};

export type AuthServerMeta = {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  registrationEndpoint: string | null;
};

export type OAuthTokens = {
  accessToken: string;
  refreshToken: string | null;
  /** Epoch milliseconds, or null when the server did not say. */
  expiresAt: number | null;
};

async function getJson(url: string): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: "application/json" } });
  } catch {
    throw new McpClientError("network", "We could not reach that server.");
  }
  if (!response.ok) {
    throw new McpClientError("not_found", `That server has no setup details at ${url}.`);
  }
  return (await response.json()) as Record<string, unknown>;
}

function str(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === "string" && value.trim() ? value : null;
}

/**
 * RFC 9728 puts the document under the resource path first, then at the root.
 * Both are tried, because servers in the wild publish one or the other.
 */
export async function discoverProtectedResource(mcpUrl: string): Promise<ProtectedResource> {
  const url = new URL(mcpUrl);
  const path = url.pathname.replace(/\/+$/, "");
  const candidates = [
    `${url.origin}/.well-known/oauth-protected-resource${path}`,
    `${url.origin}/.well-known/oauth-protected-resource`,
  ];
  let last: unknown = null;
  for (const candidate of candidates) {
    try {
      const body = await getJson(candidate);
      const servers = body["authorization_servers"];
      const issuer = Array.isArray(servers) && typeof servers[0] === "string" ? servers[0] : null;
      if (!issuer) continue;
      const scopes = body["scopes_supported"];
      return {
        resource: str(body, "resource") ?? mcpUrl,
        authorizationServer: issuer,
        scopes: Array.isArray(scopes) ? scopes.filter((s): s is string => typeof s === "string") : [],
      };
    } catch (e) {
      last = e;
    }
  }
  throw last instanceof McpClientError
    ? last
    : new McpClientError("not_found", "That server did not say how to sign in.");
}

export async function discoverAuthServer(issuer: string): Promise<AuthServerMeta> {
  const base = issuer.replace(/\/+$/, "");
  for (const candidate of [
    `${base}/.well-known/oauth-authorization-server`,
    `${base}/.well-known/openid-configuration`,
  ]) {
    try {
      const body = await getJson(candidate);
      const authorize = str(body, "authorization_endpoint");
      const token = str(body, "token_endpoint");
      if (!authorize || !token) continue;
      return {
        issuer: str(body, "issuer") ?? base,
        authorizationEndpoint: authorize,
        tokenEndpoint: token,
        registrationEndpoint: str(body, "registration_endpoint"),
      };
    } catch {
      /* try the next well-known path */
    }
  }
  throw new McpClientError("not_found", "That sign-in service did not publish its details.");
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomToken(size = 32): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(size)));
}

export async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = randomToken(48);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: base64Url(new Uint8Array(digest)) };
}

/** Dynamic client registration, public client, no secret to keep. */
export async function registerClient(
  meta: AuthServerMeta,
  redirectUri: string,
): Promise<{ clientId: string }> {
  if (!meta.registrationEndpoint) {
    throw new McpClientError("server", "That sign-in service does not accept new apps yet.");
  }
  const response = await fetch(meta.registrationEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_name: "Lasso by Charlotte Labs",
      client_uri: new URL(redirectUri).origin,
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const clientId = str(body, "client_id");
  if (!response.ok || !clientId) {
    throw new McpClientError("server", "That sign-in service would not accept this app.");
  }
  return { clientId };
}

export function authorizeUrl(input: {
  meta: AuthServerMeta;
  clientId: string;
  redirectUri: string;
  challenge: string;
  state: string;
  scopes: string[];
  resource: string;
}): string {
  const url = new URL(input.meta.authorizationEndpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("code_challenge", input.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", input.state);
  url.searchParams.set("resource", input.resource);
  if (input.scopes.length > 0) url.searchParams.set("scope", input.scopes.join(" "));
  return url.toString();
}

function readTokens(body: Record<string, unknown>): OAuthTokens {
  const access = str(body, "access_token");
  if (!access) throw new McpClientError("unauthorized", "That sign-in did not finish.");
  const expiresIn = body["expires_in"];
  return {
    accessToken: access,
    refreshToken: str(body, "refresh_token"),
    expiresAt: typeof expiresIn === "number" ? Date.now() + expiresIn * 1000 : null,
  };
}

async function tokenCall(
  meta: AuthServerMeta,
  form: Record<string, string>,
): Promise<OAuthTokens> {
  const response = await fetch(meta.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(form).toString(),
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new McpClientError("unauthorized", "That sign-in did not go through. Try connecting again.");
  }
  return readTokens(body);
}

export function exchangeCode(input: {
  meta: AuthServerMeta;
  clientId: string;
  redirectUri: string;
  verifier: string;
  code: string;
  resource: string;
}): Promise<OAuthTokens> {
  return tokenCall(input.meta, {
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
    client_id: input.clientId,
    code_verifier: input.verifier,
    resource: input.resource,
  });
}

export function refreshTokens(input: {
  meta: AuthServerMeta;
  clientId: string;
  refreshToken: string;
  resource: string;
}): Promise<OAuthTokens> {
  return tokenCall(input.meta, {
    grant_type: "refresh_token",
    refresh_token: input.refreshToken,
    client_id: input.clientId,
    resource: input.resource,
  });
}

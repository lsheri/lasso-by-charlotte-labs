/**
 * M3-C3a. Maps an AI tool's self-reported name and redirect URI to a closed
 * client family. The raw name is free text the tool chose; only the family
 * ever reaches telemetry. Pure: no server imports.
 */

export type ClientKind = "claude" | "chatgpt" | "cursor" | "other";

export function redirectHost(redirectUri: string | null | undefined): string | null {
  if (!redirectUri) return null;
  try {
    const host = new URL(redirectUri).hostname.toLowerCase();
    return host || null;
  } catch {
    return null;
  }
}

function hostIs(host: string, domains: readonly string[]): boolean {
  return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

export function clientKindFromHost(redirectUri: string | null | undefined): ClientKind | null {
  const host = redirectHost(redirectUri);
  if (!host) return null;
  if (hostIs(host, ["claude.ai", "claude.com"])) return "claude";
  if (hostIs(host, ["chatgpt.com", "openai.com"])) return "chatgpt";
  return null;
}

export function clientKind(
  name: string | null | undefined,
  redirectUri: string | null | undefined,
): ClientKind {
  const fromHost = clientKindFromHost(redirectUri);
  if (fromHost) return fromHost;
  const lower = (name ?? "").toLowerCase();
  if (lower.includes("claude")) return "claude";
  if (lower.includes("chatgpt") || lower.includes("openai")) return "chatgpt";
  if (lower.includes("cursor")) return "cursor";
  if (typeof redirectUri === "string" && redirectUri.toLowerCase().startsWith("cursor:")) return "cursor";
  return "other";
}

/** A friendly label is earned only by the redirect host, never by the name alone. */
export function clientDisplayName(
  name: string | null | undefined,
  redirectUri: string | null | undefined,
): string | null {
  const fromHost = clientKindFromHost(redirectUri);
  if (fromHost === "claude") return "Claude";
  if (fromHost === "chatgpt") return "ChatGPT";
  const trimmed = (name ?? "").trim().slice(0, 60);
  return trimmed ? trimmed : null;
}

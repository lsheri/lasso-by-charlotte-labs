/**
 * Where an event was produced. The database holds the same four values under a
 * check constraint, so nothing here may ever return anything outside this list.
 */
export const ENVIRONMENTS = ["production", "preview", "local", "unknown"] as const;

export type Environment = (typeof ENVIRONMENTS)[number];

const PRODUCTION_HOST = "lasso.charlotte-labs.com";
const PREVIEW_SUFFIX = "lovable.app";
const LOCAL_HOSTS = ["localhost", "127.0.0.1"];

/** Lowercased, trimmed, port and trailing dot removed. Never a substring test. */
function parseHost(host: string | null | undefined): string {
  if (typeof host !== "string") return "";
  let value = host.trim().toLowerCase();
  if (!value) return "";
  // A bracketed IPv6 literal keeps its brackets; the port is what follows them.
  if (value.startsWith("[")) {
    const close = value.indexOf("]");
    if (close === -1) return "";
    value = value.slice(0, close + 1);
  } else {
    const colon = value.indexOf(":");
    if (colon !== -1) value = value.slice(0, colon);
  }
  return value.replace(/\.$/, "");
}

export function environmentFromHost(host: string | null | undefined): Environment {
  const value = parseHost(host);
  if (!value) return "unknown";
  if (value === PRODUCTION_HOST) return "production";
  if (value === PREVIEW_SUFFIX || value.endsWith(`.${PREVIEW_SUFFIX}`)) return "preview";
  if (LOCAL_HOSTS.includes(value)) return "local";
  return "unknown";
}

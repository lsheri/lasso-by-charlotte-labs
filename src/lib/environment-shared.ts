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

/**
 * AUDIT-1 (7 Nov 2026): which kind of host produced a request, as a closed
 * bucket. Stamped as the host_class dim only when environmentFromHost says
 * "unknown", so the next audit can see why instead of inferring it. Never the
 * host itself: a bucket name cannot carry a tenant, a path or a person.
 */
export const HOST_CLASSES = [
  "lovable_project", // *.lovableproject.com, the editor's own preview pane
  "lovable_app", // *.lovable.app, would have been preview
  "charlotte_labs", // another charlotte-labs.com host
  "loopback", // localhost or 127.0.0.1
  "none", // no host header at all
  "other",
] as const;

export type HostClass = (typeof HOST_CLASSES)[number];

export function hostClassFromHost(host: string | null | undefined): HostClass {
  const value = parseHost(host);
  if (!value) return "none";
  if (value === "lovableproject.com" || value.endsWith(".lovableproject.com")) return "lovable_project";
  if (value === PREVIEW_SUFFIX || value.endsWith(`.${PREVIEW_SUFFIX}`)) return "lovable_app";
  if (value === "charlotte-labs.com" || value.endsWith(".charlotte-labs.com")) return "charlotte_labs";
  if (LOCAL_HOSTS.includes(value)) return "loopback";
  return "other";
}

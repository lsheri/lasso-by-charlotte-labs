import { emitClientEvent } from "./client-telemetry";
import { classifyRoute, type RouteClass } from "./pageload-timing";

/**
 * A content-free client error signal. The detailed record stays with Lovable's
 * own error reporting; this exists so lag and breakage are countable in the
 * first-party pipeline.
 *
 * CONTENT RULE: the message never travels. A message can quote a document, a
 * client name, a prompt. Only the constructor name, a hashed
 * name+file:line fingerprint, the route class and the source travel.
 */

export const ERROR_SOURCES = Object.freeze(["window", "promise", "boundary"] as const);
export type ErrorSource = (typeof ERROR_SOURCES)[number];

const SOURCE_SET: ReadonlySet<string> = new Set(ERROR_SOURCES);

/** At most this many rows per window; an error storm is not a telemetry storm. */
export const ERROR_EMIT_CAP = 10;
export const ERROR_EMIT_WINDOW_MS = 60_000;

let windowStart = 0;
let windowCount = 0;

/** Test seam. */
export function resetErrorSignal(): void {
  windowStart = 0;
  windowCount = 0;
  installed = false;
}

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

function errorName(error: unknown): string {
  if (error instanceof Error) {
    const name = error.constructor?.name || error.name;
    if (typeof name === "string" && NAME_PATTERN.test(name)) return name;
    return "Error";
  }
  const ctor = (error as { constructor?: { name?: string } } | null)?.constructor?.name;
  if (typeof ctor === "string" && NAME_PATTERN.test(ctor)) return ctor;
  return "UnknownError";
}

/**
 * First stack frame reduced to file:line, with origins and query strings
 * stripped. No function names, no free text: only the shape of the location.
 */
export function firstFrame(stack: unknown): string {
  if (typeof stack !== "string") return "unknown";
  for (const line of stack.split("\n")) {
    const match = /(?:https?:\/\/[^\s)]+|\/[^\s):]+)(?::(\d+))(?::(\d+))?/.exec(line);
    if (!match) continue;
    const located = match[0].slice(
      0,
      match[0].length - `:${match[1]}`.length - (match[2] ? `:${match[2]}`.length : 0),
    );
    let file = located;
    try {
      if (/^https?:\/\//.test(located)) file = new URL(located).pathname;
    } catch {
      /* fall through to the raw path */
    }
    file = file.split("?")[0]!.split("#")[0]!;
    const name = file.split("/").filter(Boolean).slice(-2).join("/");
    if (!name) continue;
    return `${name}:${match[1]}`;
  }
  return "unknown";
}

export function errorFingerprint(name: string, stack: unknown): string {
  return fnv1a(`${name}@${firstFrame(stack)}`);
}

export type ErrorDims = {
  route_class: RouteClass;
  error_name: string;
  fingerprint: string;
  source: ErrorSource;
};

/**
 * The only shape a client.error row can take. Built here from four keys, so a
 * caller physically cannot smuggle a message, a stack or a component name in.
 */
export function buildErrorDims(
  error: unknown,
  source: ErrorSource,
  pathname?: string,
): ErrorDims | null {
  if (!SOURCE_SET.has(source as string)) return null;
  const name = errorName(error);
  const stack = (error as { stack?: unknown } | null)?.stack;
  return {
    route_class: classifyRoute(
      pathname ?? (typeof window !== "undefined" ? window.location?.pathname : ""),
    ),
    error_name: name,
    fingerprint: errorFingerprint(name, stack),
    source,
  };
}

/** Fire and forget, rate limited. Returns whether a row was written. */
export function reportClientError(error: unknown, source: ErrorSource): boolean {
  const dims = buildErrorDims(error, source);
  if (!dims) return false;

  const now = Date.now();
  if (now - windowStart >= ERROR_EMIT_WINDOW_MS) {
    windowStart = now;
    windowCount = 0;
  }
  if (windowCount >= ERROR_EMIT_CAP) return false;
  windowCount += 1;

  emitClientEvent("client.error", { ...dims });
  return true;
}

let installed = false;

export function initErrorSignal(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (event) => {
    reportClientError(event.error ?? new Error("error"), "window");
  });
  window.addEventListener("unhandledrejection", (event) => {
    reportClientError(event.reason, "promise");
  });
}

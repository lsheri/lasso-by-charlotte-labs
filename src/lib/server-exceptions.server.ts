/**
 * PH-S3a: server-side failures reach PostHog error tracking as `$exception`.
 *
 * Content-safe by construction: the message is scrubbed and capped, and no
 * request URL, path, header, body or user id is ever sent. Never throws.
 */
import { resolveEnvironment } from "./environment.server";
import { POSTHOG_HOST, POSTHOG_KEY } from "./telemetry.server";

export type ServerExceptionWhere = "ssr_catch" | "ssr_swallowed";

export type ExceptionFrame = {
  platform: "node:javascript";
  filename: string;
  function: string;
  lineno: number;
  colno: number;
  in_app: boolean;
};

const MAX_FRAMES = 50;
const MAX_MESSAGE = 300;

export function scrubMessage(message: string): string {
  return message
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]")
    .replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, "[id]")
    .replace(/\d{6,}/g, "[n]")
    .slice(0, MAX_MESSAGE);
}

const WITH_FN = /^\s*at\s+(.*?)\s+\((.*):(\d+):(\d+)\)\s*$/;
const NO_FN = /^\s*at\s+(.*):(\d+):(\d+)\s*$/;

/** V8 stack lines to frames, oldest first as PostHog expects, capped at 50. */
export function parseFrames(stack: string | undefined): ExceptionFrame[] {
  if (!stack) return [];
  const frames: ExceptionFrame[] = [];
  for (const line of stack.split("\n")) {
    let fn = "?";
    let filename: string;
    let lineno: string;
    let colno: string;
    const a = WITH_FN.exec(line);
    if (a) {
      fn = a[1] ?? "?";
      filename = a[2] ?? "";
      lineno = a[3] ?? "0";
      colno = a[4] ?? "0";
    } else {
      const b = NO_FN.exec(line);
      if (!b) continue;
      filename = b[1] ?? "";
      lineno = b[2] ?? "0";
      colno = b[3] ?? "0";
    }
    frames.push({
      platform: "node:javascript",
      filename,
      function: fn,
      lineno: Number(lineno),
      colno: Number(colno),
      in_app: !filename.includes("node_modules"),
    });
    if (frames.length >= MAX_FRAMES) break;
  }
  return frames.reverse();
}

export function buildExceptionPayload(error: unknown, where: ServerExceptionWhere) {
  const isError = error instanceof Error;
  const type = isError && error.name ? error.name : "Error";
  const rawMessage = isError ? error.message : typeof error === "string" ? error : String(error);
  return {
    api_key: POSTHOG_KEY,
    event: "$exception",
    distinct_id: "lasso-server",
    properties: {
      $process_person_profile: false,
      $exception_source: "server",
      where,
      environment: resolveEnvironment(),
      $exception_list: [
        {
          type,
          value: scrubMessage(rawMessage),
          mechanism: { handled: false, synthetic: false },
          stacktrace: { type: "raw", frames: parseFrames(isError ? error.stack : undefined) },
        },
      ],
    },
  };
}

export async function captureServerException(
  error: unknown,
  where: ServerExceptionWhere,
): Promise<void> {
  try {
    const body = JSON.stringify(buildExceptionPayload(error, where));
    await fetch(`${POSTHOG_HOST}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(3000),
      body,
    });
  } catch {
    /* error reporting must never break the error path */
  }
}

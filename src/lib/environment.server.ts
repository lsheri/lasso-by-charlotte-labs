import { getRequestHeader } from "@tanstack/react-start/server";

import { environmentFromHost, type Environment } from "./environment-shared";

/**
 * Where this request came from, read from the incoming request's host. Server
 * side only, never supplied by the caller. Outside a request there is nothing
 * to read, so the answer is "unknown" rather than a guess.
 */
export function resolveEnvironment(): Environment {
  try {
    const host = getRequestHeader("x-forwarded-host") ?? getRequestHeader("host");
    return environmentFromHost(host);
  } catch {
    return "unknown";
  }
}

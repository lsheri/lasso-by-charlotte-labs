import { getRequestHeader } from "@tanstack/react-start/server";

import { environmentFromHost, hostClassFromHost, type Environment, type HostClass } from "./environment-shared";

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

/**
 * The host bucket for the current request, read the same way resolveEnvironment
 * reads it. "none" outside a request. Used to explain an "unknown" environment.
 */
export function resolveHostClass(): HostClass {
  try {
    const host = getRequestHeader("x-forwarded-host") ?? getRequestHeader("host");
    return hostClassFromHost(host);
  } catch {
    return "none";
  }
}

/**
 * Pass 173: keeping background work alive.
 *
 * On this hosting the request handler is torn down as soon as the response is
 * returned, so a plain fire-and-forget promise is cancelled part way through.
 * The entry point hands us its execution context, and anything registered here
 * is kept running until it settles.
 */

type WaitUntilContext = { waitUntil: (promise: Promise<unknown>) => void };

let current: WaitUntilContext | null = null;

function isWaitUntilContext(value: unknown): value is WaitUntilContext {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as WaitUntilContext).waitUntil === "function"
  );
}

/** Called once per request by the server entry. */
export function setRequestContext(ctx: unknown): void {
  current = isWaitUntilContext(ctx) ? ctx : null;
}

/** Test seam. */
export function resetRequestContext(): void {
  current = null;
}

/**
 * Runs work after the response without holding the person up. Falls back to a
 * detached promise when no context is available, which is what dev does.
 */
export function runAfterResponse(work: () => Promise<unknown>): void {
  let promise: Promise<unknown>;
  try {
    promise = Promise.resolve(work());
  } catch (e) {
    console.error("[background] work threw synchronously:", (e as Error).message);
    return;
  }
  const settled = promise.catch((e: unknown) =>
    console.error("[background] work failed:", (e as Error).message),
  );
  if (current) current.waitUntil(settled);
  else void settled;
}

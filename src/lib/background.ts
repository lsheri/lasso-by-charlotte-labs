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
/**
 * PERF-4 (QA F1): work that must finish but must not hold the answer for long. It starts at once, is handed to the
 * host as a backstop, and the returned promise settles when the work does or after `capMs`, whichever is first. It
 * never rejects. The host does not always keep runAfterResponse work alive for server functions (see
 * canvas-lab.functions.ts and recordUsage in ai.server.ts), so callers await this rather than relying on the host.
 */
export function runAlongside(work: () => Promise<unknown>, capMs: number): Promise<void> {
  let running: Promise<unknown>;
  try {
    running = Promise.resolve(work());
  } catch (e) {
    console.error("[background] work threw synchronously:", (e as Error).message);
    return Promise.resolve();
  }
  runAfterResponse(() => running);
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, capMs);
    void running.then(
      () => { clearTimeout(timer); resolve(); },
      () => { clearTimeout(timer); resolve(); },
    );
  });
}

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

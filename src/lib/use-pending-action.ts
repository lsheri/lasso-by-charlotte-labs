import { useCallback, useEffect, useRef, useState } from "react";

/**
 * One pending flag for async buttons. A second run while pending is ignored
 * entirely, so a second click can never produce a second write. Errors are
 * not swallowed: a sync throw propagates out of run, and a rejection stays a
 * rejection of the derived promise, exactly as the bare handler behaved.
 */
export function usePendingAction<A extends unknown[]>(
  fn: (...args: A) => unknown | Promise<unknown>,
): { run: (...args: A) => void; pending: boolean } {
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    (...args: A) => {
      if (inFlight.current) return;
      const result = fn(...args);
      if (result instanceof Promise) {
        inFlight.current = true;
        setPending(true);
        void result.finally(() => {
          inFlight.current = false;
          if (mounted.current) setPending(false);
        });
      }
    },
    [fn],
  );

  return { run, pending };
}

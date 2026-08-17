import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

type Handler = (() => void) | null;

const AskLassoContext = createContext<{
  handler: Handler;
  setHandler: (handler: Handler) => void;
}>({ handler: null, setHandler: () => {} });

/**
 * A page with its own Ask Lasso context (an engagement, for example) registers
 * the action here so the mobile floating button opens that context rather than
 * navigating away to Reflect.
 */
export function AskLassoProvider({ children }: { children: ReactNode }) {
  const [handler, setHandler] = useState<Handler>(null);
  const value = useMemo(() => ({ handler, setHandler }), [handler]);
  return <AskLassoContext.Provider value={value}>{children}</AskLassoContext.Provider>;
}

export function useAskLassoHandler(): Handler {
  return useContext(AskLassoContext).handler;
}

/** Register a contextual Ask Lasso action for as long as the page is mounted. */
export function useRegisterAskLasso(action: () => void) {
  const { setHandler } = useContext(AskLassoContext);
  const ref = useRef(action);
  ref.current = action;
  useEffect(() => {
    const run = () => ref.current();
    setHandler(() => run);
    return () => setHandler(null);
  }, [setHandler]);
}

import { useEffect, useRef } from "react";

/**
 * 20 Nov 2026: on a phone, Back with a dialog open should close the dialog, not leave the page and lose what was
 * typed. While `open` is true this puts one extra entry in the browser's history for the same address. Back removes
 * that entry and the dialog closes. Closed any other way, the hook takes its own entry out again, and only when that
 * entry is still the current one, so it can never step back off the page.
 *
 * The entry copies the router's own state and moves its index on by one, so the router reads it as an ordinary step
 * on the same page. Do not use this on a dialog whose action moves to another page as it closes.
 */
const MARK = "__backCloses";
const ROUTER_INDEX = "__TSR_index";

type State = Record<string, unknown> | null;
const current = (): State => (typeof window === "undefined" ? null : ((window.history.state as State) ?? null));
const holds = (id: string): boolean => current()?.[MARK] === id;

export function useBackCloses(open: boolean, onClose: () => void): void {
  const id = useRef<string>("");
  if (!id.current) id.current = `bc-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
  const close = useRef(onClose);
  close.current = onClose;
  // The tidy-up waits a tick, so a strict mode remount (or a quick close and reopen) keeps the entry it already has.
  const tidy = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const mark = id.current;
    if (tidy.current) {
      clearTimeout(tidy.current);
      tidy.current = null;
    }
    if (!holds(mark)) {
      const state = current() ?? {};
      const index = state[ROUTER_INDEX];
      try {
        window.history.pushState({ ...state, ...(typeof index === "number" ? { [ROUTER_INDEX]: index + 1 } : {}), [MARK]: mark }, "");
      } catch {
        return; // History is not available here; the dialog still works, Back just behaves as before.
      }
    }
    let popped = false;
    const onPop = () => {
      if (popped || holds(mark)) return;
      popped = true;
      close.current();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (popped) return;
      tidy.current = setTimeout(() => {
        tidy.current = null;
        if (holds(mark)) window.history.back();
      }, 0);
    };
  }, [open]);
}

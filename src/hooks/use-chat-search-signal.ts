import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef } from "react";

import { noteChatSearchFn } from "@/lib/chat-library.functions";
import { CHAT_SEARCH_DEBOUNCE_MS, isSettledQuery } from "@/lib/chat-search-signal";

/**
 * Pass 157b: the search signal, client half. One record per settled query,
 * never per keystroke, plus one more when a result from that search is opened.
 */
export function useChatSearchSignal(query: string, results: number) {
  const note = useServerFn(noteChatSearchFn);
  const resultsRef = useRef(results);
  resultsRef.current = results;
  const lastSent = useRef<string | null>(null);
  const clicked = useRef<string | null>(null);

  const send = useCallback(
    (value: string, hadClick: boolean) => {
      void Promise.resolve(
        note({ data: { query: value, results: resultsRef.current, had_click: hadClick } }),
      ).catch(() => {});
    },
    [note],
  );

  const fire = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!isSettledQuery(trimmed) || lastSent.current === trimmed) return;
      lastSent.current = trimmed;
      send(trimmed, false);
    },
    [send],
  );

  useEffect(() => {
    const trimmed = query.trim();
    if (!isSettledQuery(trimmed) || lastSent.current === trimmed) return;
    const timer = setTimeout(() => fire(trimmed), CHAT_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, fire]);

  /** Enter settles a query at once. */
  const onSubmitQuery = useCallback(() => fire(query), [fire, query]);

  /** A result opened from this search, recorded once. */
  const onResultOpened = useCallback(() => {
    const trimmed = query.trim();
    if (!isSettledQuery(trimmed) || clicked.current === trimmed) return;
    clicked.current = trimmed;
    lastSent.current = trimmed;
    send(trimmed, true);
  }, [query, send]);

  return { onSubmitQuery, onResultOpened };
}

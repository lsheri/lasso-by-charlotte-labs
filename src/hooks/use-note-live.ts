import { useEffect, useRef } from "react";

/**
 * Marks a note as animating only while it is on screen.
 *
 * Forty notes breathing at once is fine as compositor work, but forty
 * animations running behind a scrolled-past column is not: it is fan noise on a
 * laptop in a meeting for motion nobody can see. The observer sets
 * `data-live="1"` and the stylesheet does the rest, so nothing re-renders.
 *
 * The animation also stops when the tab is hidden. A background tab has no
 * reason to keep paper moving.
 */
export function useNoteLive<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") {
      node.dataset["live"] = "1";
      return;
    }

    let onScreen = false;
    const apply = () => {
      if (onScreen && !document.hidden) node.dataset["live"] = "1";
      else delete node.dataset["live"];
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) onScreen = entry.isIntersecting;
        apply();
      },
      { rootMargin: "120px" },
    );
    observer.observe(node);
    document.addEventListener("visibilitychange", apply);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", apply);
    };
  }, []);

  return ref;
}

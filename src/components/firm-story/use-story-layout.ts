import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";

import {
  STORY_DEFAULT_PLACEMENT,
  storyCardPlacement,
  storyCardTop,
  storyScrollDelta,
  type StoryLayoutMetrics,
  type StoryPlacement,
} from "@/lib/firm-story-layout-shared";

import { measureAnchor } from "./measure-anchor";

/**
 * When a beat starts the page keeps being lined up until the target has stayed put for a moment, so a block that
 * loads late above it, or the router putting the page back at the top, is allowed for. Never longer than the cap.
 */
const QUIET_MS = 2000;
const SETTLE_CAP_MS = 10_000;
const MOVE_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);

type Layout = { placement: StoryPlacement; top: number };
const USUAL: Layout = { placement: STORY_DEFAULT_PLACEMENT, top: 0 };

/** The bottom edge of a header pinned to the top of the screen (the phone's bar), or 0 when there is none. */
function headerBottom(): number {
  let bottom = 0;
  for (const header of document.querySelectorAll("header")) {
    const position = getComputedStyle(header).position;
    if (position !== "sticky" && position !== "fixed") continue;
    const rect = header.getBoundingClientRect();
    // Pinned means: it has a size, spans the screen and sits at the very top right now.
    if (rect.height > 0 && rect.width >= window.innerWidth / 2 && rect.top <= 0 && rect.bottom > 0) bottom = Math.max(bottom, rect.bottom);
  }
  return bottom;
}

/**
 * Keeps a beat's target in sight. When the beat starts, the page is moved so the target sits clear of the card; the
 * moment the person scrolls for themselves, that stops. While the beat is up, the card moves to another corner if it
 * would cover the target. It only reads the page and scrolls it: no request, no stored value, nothing saved.
 *
 * Returns the card's place and the inline style that puts its frame there (empty in its usual place).
 */
export function useStoryLayout(
  anchor: string | null,
  beat: number | null,
  cardWrap: RefObject<HTMLElement | null>,
  /** This beat wants the card at the top on a phone. */
  phoneTop = false,
): { placement: StoryPlacement; style: CSSProperties } {
  const [layout, setLayout] = useState<Layout>(USUAL);
  const current = useRef<Layout>(USUAL);

  useEffect(() => {
    let usual: { left: number; bottom: number } | null = null;
    let waitUntil = 0;
    let startedAt: number | null = null;
    let quietSince: number | null = null;
    let settled = false;
    let personMoved = false;
    // Where the target sits in the page itself. Scrolling does not change it; a block arriving above it does.
    let restedAt: number | null = null;

    const apply = (next: Layout) => {
      if (current.current.placement === next.placement && current.current.top === next.top) return;
      current.current = next;
      // The card is drawn in its new place on the next paint; do not measure it before then.
      waitUntil = Date.now() + 120;
      setLayout(next);
    };

    // Every beat is measured from the usual place, so a corner one beat chose is never carried into the next.
    apply(USUAL);
    if (!anchor) return;

    const tick = () => {
      const now = Date.now();
      if (now < waitUntil) return;
      const card = cardWrap.current?.querySelector('[data-testid="firm-story-card"]');
      let target = measureAnchor(anchor);
      if (!card || !target) return;
      const rect = card.getBoundingClientRect();
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      if (current.current.placement === STORY_DEFAULT_PLACEMENT) usual = { left: rect.left, bottom: viewport.height - rect.bottom };
      if (!usual) return;
      const metrics: StoryLayoutMetrics = {
        card: { width: rect.width, height: rect.height },
        viewport,
        startLeft: usual.left,
        bottomOffset: usual.bottom,
        topInset: headerBottom(),
        wide: viewport.width >= 768,
      };
      startedAt ??= now;
      // The target itself moved after the page had settled (the proposals rows arrived late): line up again.
      const inPage = target.top + window.scrollY;
      if (settled && !personMoved && restedAt !== null && Math.abs(inPage - restedAt) > 4) {
        settled = false;
        quietSince = null;
        startedAt = now;
      }
      if (!settled) {
        const delta = storyScrollDelta(target, metrics);
        if (delta !== 0) {
          window.scrollBy({ top: delta, behavior: "instant" });
          target = measureAnchor(anchor) ?? target;
          quietSince = now;
        } else quietSince ??= now;
        if (now - quietSince >= QUIET_MS || now - startedAt >= SETTLE_CAP_MS) settled = true;
        restedAt = target.top + window.scrollY;
      }
      apply({ placement: storyCardPlacement(target, metrics, phoneTop), top: storyCardTop(metrics) });
    };

    // The person's own scrolling wins from the first touch.
    const moved = () => {
      settled = true;
      personMoved = true;
    };
    const key = (event: KeyboardEvent) => {
      if (MOVE_KEYS.has(event.key)) moved();
    };
    const resized = () => {
      // The usual place changes with the screen: go back to it and measure again.
      usual = null;
      apply(USUAL);
    };

    tick();
    const timer = window.setInterval(tick, 300);
    window.addEventListener("scroll", tick, true);
    window.addEventListener("resize", resized);
    window.addEventListener("wheel", moved, { passive: true });
    window.addEventListener("touchmove", moved, { passive: true });
    window.addEventListener("keydown", key);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("scroll", tick, true);
      window.removeEventListener("resize", resized);
      window.removeEventListener("wheel", moved);
      window.removeEventListener("touchmove", moved);
      window.removeEventListener("keydown", key);
    };
    // A new beat lines the page up again, even when it points at the same surface as the one before.
  }, [anchor, beat, cardWrap, phoneTop]);

  const { placement, top } = layout;
  const style: CSSProperties = {
    ...(placement.startsWith("top") ? { top, bottom: "auto" } : {}),
    ...(placement.endsWith("end") ? { justifyContent: "flex-end" } : {}),
  };
  return { placement, style };
}

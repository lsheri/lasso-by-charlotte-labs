/**
 * PASS 132/133 — the working card story.
 *
 * While the run happens, the rail plays the conversation back: turn cards
 * landing one at a time on blank paper with hand-drawn graphite connectors
 * between them, in the Work Artifact story's motion family. It depicts reading
 * the chat, which is exactly what both thread presets do, so both readers
 * get it.
 *
 * PASS 133 turns the column into a canvas: the walk drifts down and sideways
 * across the whole rail, and when the paper runs out the page turns. The loop
 * never fakes progress: it walks the whole chat, holds a beat, and starts
 * again. Every timer is owned here and cleaned up on skip, resolve and
 * unmount.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { GraphiteIcon } from "@/components/notebook/icons";
import { SourceMark, sourceVendorKey } from "@/components/work/SourceMark";
import { turnConnectorD } from "@/lib/journey-path";
import {
  CARD_STEP_MS,
  PAGE_FADE_MS,
  TURN_CARD_H,
  TURN_CARD_W,
  TURN_STORY_HOLD_MS,
  TURN_STORY_W,
  TURN_STORY_WINDOW,
  layoutTurnWalk,
  turnCards,
  type TurnCard,
  type TurnPlacement,
  type TurnStage,
  type TurnStoryTurn,
} from "@/lib/turn-story-shared";
import type { WorkItemRow } from "@/lib/work-types";

/** The stacked layout has no room for the story: phase lines only there. */
export function useWideLayout(): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia?.("(min-width: 901px)");
    if (!mql) return;
    const apply = () => setWide(mql.matches);
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, []);
  return wide;
}

/** The blank paper: whatever the rail actually gives us, never smaller. */
function useStage(node: HTMLDivElement | null): TurnStage {
  const [stage, setStage] = useState<TurnStage>({ width: TURN_STORY_W, height: 420 });

  useEffect(() => {
    if (!node) return;
    const apply = () => {
      setStage({
        width: Math.max(node.clientWidth, TURN_STORY_W),
        height: Math.max(node.clientHeight, 420),
      });
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return stage;
}

/**
 * How far through the walk we are. One timer chain, one stop, full cleanup.
 */
export function useTurnCardStory({ count, enabled }: { count: number; enabled: boolean }) {
  const [head, setHead] = useState(0);
  const headRef = useRef(0);
  const timer = useRef<number | null>(null);
  const stopped = useRef(false);

  const stop = useCallback(() => {
    stopped.current = true;
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => {
    if (!enabled || count <= 0) return;
    stopped.current = false;
    headRef.current = 0;
    setHead(0);
    const tick = () => {
      if (stopped.current) return;
      const next = headRef.current >= count ? 0 : headRef.current + 1;
      headRef.current = next;
      setHead(next);
      timer.current = window.setTimeout(
        tick,
        next >= count ? TURN_STORY_HOLD_MS : CARD_STEP_MS,
      );
    };
    timer.current = window.setTimeout(tick, CARD_STEP_MS);
    return () => {
      stopped.current = true;
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
    };
  }, [count, enabled]);

  return { head, stop };
}

function TurnMark({ card, item }: { card: TurnCard; item: WorkItemRow | null }) {
  if (!card.isAssistant) {
    return <GraphiteIcon name="members" size={14} animate={false} title="You" />;
  }
  if (item && sourceVendorKey(item)) return <SourceMark item={item} size={14} />;
  return <GraphiteIcon name="messages" size={14} animate={false} title="Conversation" />;
}

function TurnCardBox({
  card,
  item,
  className = "",
  style,
}: {
  card: TurnCard;
  item: WorkItemRow | null;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      data-testid="turn-story-card"
      data-turn={card.turnNo}
      className={`nb-journey-node ${className}`}
      style={style}
    >
      <div className="flex items-center gap-1.5">
        <TurnMark card={card} item={item} />
        <span className="micro-label text-muted-foreground">{card.label}</span>
      </div>
      <p className="mt-1 truncate text-xs text-foreground/80">{card.snippet}</p>
    </div>
  );
}

type ShownEntry = { place: TurnPlacement; card: TurnCard };

/**
 * PASS 133.1 — the page turn fades instead of cutting. When the walk turns
 * the paper, the outgoing page's cards linger one fade (PAGE_FADE_MS) at
 * opacity 0 before leaving the DOM. One timer, owned here, cleaned on
 * unmount and stop; reduced motion never reaches this path.
 */
function usePageTurnFade(page: number, shown: readonly ShownEntry[]): ShownEntry[] {
  const [fading, setFading] = useState<ShownEntry[]>([]);
  const lastShown = useRef<readonly ShownEntry[]>([]);
  const lastPage = useRef(page);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (lastPage.current === page) {
      lastShown.current = shown;
      return;
    }
    lastPage.current = page;
    setFading([...lastShown.current]);
    lastShown.current = shown;
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setFading([]);
    }, PAGE_FADE_MS);
  }, [page, shown]);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
    },
    [],
  );

  return fading;
}

export function TurnCardStory({
  itemId,
  item,
  turns,
  running,
  reduced,
}: {
  itemId: string;
  item: WorkItemRow | null;
  turns: readonly TurnStoryTurn[];
  running: boolean;
  reduced: boolean;
}) {
  const wide = useWideLayout();
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const stage = useStage(host);
  const cards = useMemo(() => turnCards(itemId, turns), [itemId, turns]);
  const places = useMemo(
    () => layoutTurnWalk(itemId, cards, stage),
    [cards, itemId, stage],
  );
  const { head, stop } = useTurnCardStory({
    count: cards.length,
    enabled: running && !reduced && wide,
  });

  useEffect(() => {
    if (!running) stop();
  }, [running, stop]);

  // Only the current page of paper is on screen, and only the last few cards
  // of it: as one lands, the oldest leaves.
  const last = Math.max(0, Math.min(head, cards.length)) - 1;
  const page = last >= 0 ? (places[last]?.page ?? 0) : -1;
  const shown: ShownEntry[] =
    last < 0
      ? []
      : places
          .slice(0, last + 1)
          .map((place, index) => ({ place, card: cards[index] as TurnCard }))
          .filter((entry) => entry.place.page === page)
          .slice(-TURN_STORY_WINDOW);
  // The page just turned: the outgoing page's cards fade out over PAGE_FADE_MS.
  const fading = usePageTurnFade(page, shown);

  if (!wide || cards.length === 0) return null;

  if (reduced) {
    return (
      <div className="flex flex-col gap-2" data-testid="turn-story" data-reduced="true">
        {cards.slice(0, 3).map((card) => (
          <TurnCardBox key={card.id} card={card} item={item} />
        ))}
      </div>
    );
  }

  return (
    <div
      ref={setHost}
      className="nb-journey relative min-h-[420px] w-full flex-1"
      data-testid="turn-story"
      data-page={page}
      aria-hidden
    >
      <svg
        className="nb-journey-svg"
        viewBox={`0 0 ${stage.width} ${stage.height}`}
        width={stage.width}
        height={stage.height}
      >
        {shown.map((entry, index) => {
          if (index === 0) return null;
          const prev = shown[index - 1]!.place;
          const from = { x: prev.x + TURN_CARD_W / 2, y: prev.y + TURN_CARD_H };
          const to = {
            x: entry.place.x + TURN_CARD_W / 2,
            y: entry.place.y - 2,
          };
          const connector = turnConnectorD(`${itemId}:${entry.card.turnNo}`, from, to);
          return (
            <g key={`c-${entry.card.id}`}>
              <path
                className="nb-journey-seg"
                d={connector.stroke.d}
                style={{ ["--nb-len" as string]: `${connector.stroke.length}` }}
              />
              {connector.arrow.map((stroke, k) => (
                <path
                  key={k}
                  className="nb-journey-arrow"
                  d={stroke.d}
                  style={{ ["--nb-len" as string]: `${stroke.length}` }}
                />
              ))}
            </g>
          );
        })}
      </svg>
      {fading.map((entry) => (
        <TurnCardBox
          key={`fade-${entry.card.id}`}
          card={entry.card}
          item={item}
          className="nb-page-fade absolute"
          style={{
            left: entry.place.x,
            top: entry.place.y,
            width: TURN_CARD_W,
          }}
        />
      ))}
      {shown.map((entry) => (
        <TurnCardBox
          key={entry.card.id}
          card={entry.card}
          item={item}
          className="absolute"
          style={{
            left: entry.place.x,
            top: entry.place.y,
            width: TURN_CARD_W,
          }}
        />
      ))}
    </div>
  );
}

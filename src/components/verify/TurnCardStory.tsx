/**
 * PASS 132 — the working card story.
 *
 * While the run happens, the rail plays the conversation back: turn cards
 * snaking in one at a time with hand-drawn graphite connectors between them,
 * in the Work Artifact story's motion family. It depicts reading the chat,
 * which is exactly what both thread presets do, so both readers get it.
 *
 * The loop never fakes progress: it walks the whole chat, holds a beat, and
 * starts again. Every timer is owned here and cleaned up on skip, resolve and
 * unmount.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { GraphiteIcon } from "@/components/notebook/icons";
import { SourceMark, sourceVendorKey } from "@/components/work/SourceMark";
import { turnConnectorD } from "@/lib/journey-path";
import {
  TURN_CARD_GAP,
  TURN_CARD_H,
  TURN_CARD_W,
  TURN_STORY_HOLD_MS,
  TURN_STORY_STEP_MS,
  TURN_STORY_W,
  turnCards,
  turnStoryWindow,
  type TurnCard,
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
        next >= count ? TURN_STORY_HOLD_MS : TURN_STORY_STEP_MS,
      );
    };
    timer.current = window.setTimeout(tick, TURN_STORY_STEP_MS);
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
  const cards = turnCards(itemId, turns);
  const story = useTurnCardStory({ count: cards.length, enabled: running && !reduced && wide });

  useEffect(() => {
    if (!running) story.stop();
  }, [running, story]);

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

  const shown = turnStoryWindow(cards, story.head);
  const height = Math.max(1, shown.length) * (TURN_CARD_H + TURN_CARD_GAP);
  const centre = TURN_STORY_W / 2;

  return (
    <div
      className="nb-journey relative mx-auto"
      data-testid="turn-story"
      aria-hidden
      style={{ width: TURN_STORY_W, height }}
    >
      <svg
        className="nb-journey-svg"
        viewBox={`0 0 ${TURN_STORY_W} ${height}`}
        width={TURN_STORY_W}
        height={height}
      >
        {shown.map((card, index) => {
          if (index === 0) return null;
          const prev = shown[index - 1] as TurnCard;
          const from = {
            x: centre + prev.dx,
            y: (index - 1) * (TURN_CARD_H + TURN_CARD_GAP) + TURN_CARD_H,
          };
          const to = { x: centre + card.dx, y: index * (TURN_CARD_H + TURN_CARD_GAP) - 2 };
          const connector = turnConnectorD(`${itemId}:${card.turnNo}`, from, to);
          return (
            <g key={`c-${card.id}`}>
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
      {shown.map((card, index) => (
        <TurnCardBox
          key={card.id}
          card={card}
          item={item}
          className="absolute"
          style={{
            left: centre + card.dx - TURN_CARD_W / 2,
            top: index * (TURN_CARD_H + TURN_CARD_GAP),
            width: TURN_CARD_W,
          }}
        />
      ))}
    </div>
  );
}

import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";

import { PencilFirework, PencilHatch } from "@/components/notebook/marks";
import { ShippedWorkCard } from "@/components/firm/ShippedWorkCard";
import { canTakeBackCard } from "@/components/firm/FirmArchive";
import { useProfile } from "@/hooks/use-profile";
import {
  ARCHIVE_BROWSE_PILE_LABEL,
  ARCHIVE_MIN_ITEMS,
  ARCHIVE_NO_MATCH_LINE,
  ARCHIVE_PLACEHOLDER,
  ARCHIVE_SKIP_LABEL,
  ARCHIVE_TOO_SMALL_LINE,
  ARCHIVE_WHY_PREFIX,
  type ArchiveMatch,
  type ArchiveSearchResult,
} from "@/lib/archive-search-shared";
import { ARCHIVE_BACK_LABEL } from "@/lib/archive-search-shared";
import { searchArchive } from "@/lib/archive-search.functions";
import { closeJourney, useJourneyRequest } from "@/lib/journey-state";
import type { ShippedCard } from "@/lib/shipped-work-shared";

const RESULT_STAGGER_MS = 90;

function Thinking() {
  return (
    <span className="nb-dots" role="status" aria-label="Reading past work">
      <span className="nb-dot" />
      <span className="nb-dot" />
      <span className="nb-dot" />
    </span>
  );
}

export type ArchiveResultState = {
  /** Increments per answered question: one firework per result set. */
  setId: number;
  matches: ArchiveMatch[];
  best: string | null;
  line: string | null;
};

/**
 * The archive chat. Ephemeral by design: no table, no localStorage, no history.
 * This is search, not a record.
 */
export function ArchiveChat({
  cards,
  onResultsChange,
}: {
  cards: ShippedCard[];
  onResultsChange?: ((open: boolean) => void) | undefined;
}) {
  const { data: profile } = useProfile();
  const run = useServerFn(searchArchive) as unknown as (input: {
    data: { question: string };
  }) => Promise<ArchiveSearchResult>;

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [state, setState] = useState<ArchiveResultState | null>(null);
  const playedFor = useRef<number | null>(null);

  // "/" focuses the dock, unless the person is already typing somewhere.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "/") return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;
      event.preventDefault();
      inputRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const byId = useMemo(
    () => new Map(cards.map((card) => [card.work_item_id, card] as const)),
    [cards],
  );

  const journey = useJourneyRequest();
  const showResults = state !== null;

  useEffect(() => {
    onResultsChange?.(state !== null);
  }, [state, onResultsChange]);
  const fireworkOwed =
    state?.best != null && playedFor.current !== state.setId && !skipped ? state.best : null;
  if (fireworkOwed && state) playedFor.current = state.setId;

  async function ask() {
    const asked = question.trim();
    if (!asked || busy) return;
    setSkipped(false);
    if (cards.length < ARCHIVE_MIN_ITEMS) {
      setState((prev) => ({
        setId: (prev?.setId ?? 0) + 1,
        matches: [],
        best: null,
        line: ARCHIVE_TOO_SMALL_LINE,
      }));
      return;
    }
    setBusy(true);
    try {
      const result = await run({ data: { question: asked } });
      const matches = result.matches.filter((match) => byId.has(match.work_item_id));
      setState((prev) => ({
        setId: (prev?.setId ?? 0) + 1,
        matches,
        best: matches.length > 0 ? result.best_match_id : null,
        line: matches.length === 0 ? ARCHIVE_NO_MATCH_LINE : null,
      }));
    } catch {
      setState((prev) => ({
        setId: (prev?.setId ?? 0) + 1,
        matches: [],
        best: null,
        line: ARCHIVE_NO_MATCH_LINE,
      }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-testid="archive-chat">
      <div className="nb-archive-dock">
        <PencilHatch seed="archive-chat" className="nb-archive-hatch" />
        <input
          ref={inputRef}
          className="nb-archive-input"
          data-testid="archive-chat-input"
          placeholder={ARCHIVE_PLACEHOLDER}
          aria-label="Ask past work"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void ask();
          }}
        />
        {busy ? <Thinking /> : null}
        <button
          type="button"
          className="nb-archive-send"
          data-testid="archive-chat-send"
          aria-label="Ask past work"
          onClick={() => void ask()}
          disabled={busy}
        >
          <PencilHatch seed="archive-send" />
          <svg width={14} height={14} viewBox="0 0 14 14" fill="none" aria-hidden>
            <path
              d="M2 7h9M7.4 3.2 11.2 7 7.4 10.8"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {showResults ? (
        <div className={`mt-5 ${skipped ? "is-skipped" : ""}`} data-testid="archive-results">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              {state.line ?? "FROM PAST WORK"}
            </span>
            <div className="flex items-center gap-3">
              {journey ? (
                <button
                  type="button"
                  data-testid="archive-back-to-results"
                  onClick={() => closeJourney()}
                  className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground"
                >
                  {ARCHIVE_BACK_LABEL}
                </button>
              ) : null}
              {!skipped && state.matches.length > 0 ? (
                <button
                  type="button"
                  data-testid="archive-skip"
                  onClick={() => setSkipped(true)}
                  className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground"
                >
                  {ARCHIVE_SKIP_LABEL}
                </button>
              ) : null}
              <button
                type="button"
                data-testid="archive-browse-pile"
                onClick={() => {
                  setState(null);
                  setSkipped(false);
                }}
                className="font-mono text-[11px] uppercase tracking-[0.08em] text-accent-deep"
              >
                {ARCHIVE_BROWSE_PILE_LABEL}
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-3">
            {state.matches.map((match, index) => {
              const card = byId.get(match.work_item_id);
              if (!card) return null;
              return (
                <div
                  key={match.work_item_id}
                  data-testid={`archive-result-${match.work_item_id}`}
                  className="nb-rise relative w-[260px]"
                  style={{ animationDelay: `${index * RESULT_STAGGER_MS}ms` }}
                >
                  {fireworkOwed === match.work_item_id ? (
                    <PencilFirework
                      nodeId={match.work_item_id}
                      drawing={!skipped}
                      className="absolute -right-3 -top-3 z-10"
                    />
                  ) : null}
                  <ShippedWorkCard
                    card={card}
                    canTakeBack={canTakeBackCard(profile, card)}
                  />
                  <p
                    data-testid={`archive-why-${match.work_item_id}`}
                    className="mt-1.5 font-mono text-[12px] text-muted-foreground"
                  >
                    {ARCHIVE_WHY_PREFIX}
                    {match.why}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { FIRM_TYPE_LABELS, firmDate } from "@/lib/firm-ask-shared";
import {
  FIRM_WALK_COPY,
  type FirmWalkthroughResult,
  type WalkTag,
} from "@/lib/firm-walkthrough-shared";
import { getFirmWalkthrough } from "@/lib/firm-walkthrough.functions";

import { CiteThis } from "./CiteThis";
import { FirmSourceCard } from "./FirmSourceCard";
import { FirmSourcePreview } from "./FirmSourcePreview";

const eyebrow =
  "font-mono text-(length:--type-label) uppercase tracking-wider text-muted-foreground";

/**
 * "How we do this" for one situation or method, in the firm map's reading panel: a button that asks the server for a
 * walk-through and shows it in place. Habits each carry their quote and its source; under them are up to four
 * examples to read. Sources open in the same read-only preview as Ask the firm's citations.
 *
 * The walk-through lives in this component's state only and is asked for again on every press, so nothing is kept
 * here or on the server. Give it a `key` per point: a new point starts empty, and a reply for the old one is ignored.
 * `autoOpen` asks once as it appears, for places where the person has already pressed to read it.
 */
export function FirmWalkthrough({
  tag,
  profileId,
  autoOpen = false,
}: {
  tag: WalkTag;
  profileId: string | null | undefined;
  autoOpen?: boolean;
}) {
  const load = useServerFn(getFirmWalkthrough);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [refused, setRefused] = useState(false);
  const [result, setResult] = useState<FirmWalkthroughResult | null>(null);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const alive = useRef(true);
  const busy = useRef(false);

  useEffect(() => {
    alive.current = true;
    // The busy ref makes a second run of this effect a no-op, so one appearance asks once.
    if (autoOpen) void open();
    return () => {
      alive.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A guest or someone outside a company workspace: the server says no, so the button goes away.
  if (refused) return null;

  async function open() {
    // The ref, not the state, stops a double press: two clicks in one tick both see the old state.
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setFailed(false);
    try {
      const walk = await load({
        data: { kind: tag.kind, tag: tag.tag, profile_id: profileId ?? null },
      });
      if (alive.current) setResult(walk);
    } catch (error) {
      if (!alive.current) return;
      if (error instanceof Response && error.status === 403) setRefused(true);
      else setFailed(true);
    } finally {
      busy.current = false;
      if (alive.current) setPending(false);
    }
  }

  return (
    <section
      data-testid="firm-walkthrough"
      data-walk={result && !pending ? result.status : "closed"}
      className="flex flex-col gap-3"
    >
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          data-testid="firm-walkthrough-open"
          onClick={() => void open()}
        >
          {result ? FIRM_WALK_COPY.again : FIRM_WALK_COPY.open}
        </Button>
      </div>
      {pending ? (
        <p
          role="status"
          className="flex items-center gap-2 text-(length:--type-small) text-muted-foreground"
        >
          <span className="nb-dots" aria-hidden>
            <span className="nb-dot" />
            <span className="nb-dot" />
            <span className="nb-dot" />
          </span>
          {FIRM_WALK_COPY.pending}
        </p>
      ) : null}
      {failed && !pending ? (
        <p role="alert" className="text-(length:--type-small) text-destructive">
          {FIRM_WALK_COPY.error}
        </p>
      ) : null}

      {result && !pending ? (
        <>
          {result.status === "thin" ? (
            <p data-walk-thin className="text-(length:--type-body) text-foreground">
              {FIRM_WALK_COPY.thin(result.engagements)}
            </p>
          ) : null}
          {result.status === "none" ? (
            <p data-walk-none className="text-(length:--type-body) text-foreground">
              {FIRM_WALK_COPY.none}
            </p>
          ) : null}

          {result.habits.length ? (
            <section className="flex flex-col gap-2">
              <h4 className={eyebrow}>{FIRM_WALK_COPY.habitsTitle}</h4>
              <ol className="flex flex-col gap-4">
                {result.habits.map((habit, index) => (
                  <li
                    key={`${index}-${habit.text}`}
                    data-walk-habit
                    className="flex flex-col gap-1.5"
                  >
                    <p className="text-(length:--type-body) font-medium text-foreground">
                      {habit.text}
                    </p>
                    {habit.quotes.map((quote) => {
                      const source = result.sources[quote.itemId];
                      return (
                        <div
                          key={`${quote.itemId}-${quote.quote}`}
                          className="flex flex-col gap-1.5"
                        >
                          <blockquote
                            data-walk-quote={quote.grade}
                            className="border-l-2 border-border pl-3 text-(length:--type-small) text-muted-foreground"
                          >
                            {quote.quote}
                            {quote.grade === "from_summary" ? (
                              <span className="block text-(length:--type-label)">
                                {FIRM_WALK_COPY.fromSummary}
                              </span>
                            ) : null}
                          </blockquote>
                          {source ? (
                            <FirmSourceCard
                              source={source}
                              grade={quote.grade}
                              onOpen={() => setOpenItem(quote.itemId)}
                            />
                          ) : null}
                          <CiteThis
                            quote={quote.quote}
                            sourceItemId={quote.itemId}
                            profileId={profileId}
                          />
                        </div>
                      );
                    })}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <section className="flex flex-col gap-2">
            <h4 className={eyebrow}>{FIRM_WALK_COPY.examplesTitle}</h4>
            {result.examples.length ? (
              <ul className="flex flex-col gap-2">
                {result.examples.map((example) => (
                  <li key={example.itemId}>
                    <button
                      type="button"
                      data-walk-example={example.itemId}
                      aria-label={FIRM_WALK_COPY.openExample(example.title)}
                      onClick={() => setOpenItem(example.itemId)}
                      className="flex w-full min-w-0 flex-col gap-0.5 rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-left hover:border-foreground/40 focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      <span className="text-(length:--type-body) font-medium text-foreground">
                        {example.title}
                      </span>
                      <span className="text-(length:--type-small) text-muted-foreground">
                        {example.engagement === example.boardTitle
                          ? example.boardTitle
                          : `${example.engagement} · ${example.boardTitle}`}
                      </span>
                      <span className="flex flex-wrap gap-x-2 font-mono text-(length:--type-label) uppercase tracking-wider text-muted-foreground">
                        <span>{FIRM_TYPE_LABELS[example.type] ?? example.type}</span>
                        <span data-walk-example-date>{firmDate(example.date)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-(length:--type-small) text-muted-foreground">
                {FIRM_WALK_COPY.noExamples}
              </p>
            )}
          </section>

          <p className="text-(length:--type-small) text-muted-foreground">{`${result.coverage} ${FIRM_WALK_COPY.generated}`}</p>
        </>
      ) : null}
      <FirmSourcePreview
        itemId={openItem}
        profileId={profileId}
        onClose={() => setOpenItem(null)}
      />
    </section>
  );
}

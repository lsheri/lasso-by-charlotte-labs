import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { tagVariants } from "@/components/ui/tag";
import { FIRM_ASK_COPY, type FirmAskResult, type FirmAskStarter } from "@/lib/firm-ask-shared";
import { FIRM_BRAIN_LIMIT_COPY } from "@/lib/firm-brain-limit-shared";
import {
  answerBoards,
  CANVAS_SIZES,
  FIRM_CANVAS_COPY,
  LINE_REVEAL_MS,
  pendingCaption,
  pendingPercent,
} from "@/lib/firm-canvas-shared";
import { cn } from "@/lib/utils";

import { CiteThis } from "./CiteThis";

/** One question on the canvas and what came back. Lives in memory only: nothing about it is stored or sent anywhere. */
export type CanvasAnswer = {
  id: string;
  question: string;
  starter: FirmAskStarter | null;
  status: "pending" | "answered" | "failed";
  result: FirmAskResult | null;
  /** The daily limit was reached, so the failure line says so. */
  limited: boolean;
  x: number;
  y: number;
  /** Measured height, once drawn. */
  h: number;
  startedAt: number;
  /** The build has run once; coming back to the page shows the finished answer. */
  built: boolean;
};

/**
 * An answer card on the canvas. While the firm is read it says what is happening, stage by stage, over grey line
 * placeholders. When the answer is in, its lines appear one by one, each with a link to the source it came from, then
 * the card turns done with a short count. Line positions are reported up so the engagements behind them can sit
 * level with them.
 */
export function CanvasAnswerCard({
  answer,
  focused,
  dimmed,
  reduceMotion,
  profileId,
  onOpenSource,
  onRetry,
  onMeasured,
  onBuilt,
}: {
  answer: CanvasAnswer;
  focused: boolean;
  dimmed: boolean;
  reduceMotion: boolean;
  profileId: string | null | undefined;
  onOpenSource: (itemId: string) => void;
  onRetry: (answer: CanvasAnswer) => void;
  onMeasured: (id: string, height: number, lineCentres: number[]) => void;
  onBuilt: (id: string) => void;
}) {
  const card = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const result = answer.result;
  const claims = result?.claims ?? [];
  const [shown, setShown] = useState(() => (answer.built || reduceMotion ? claims.length : 0));
  const pending = answer.status === "pending";
  const revealing = answer.status === "answered" && shown < claims.length;
  const done = answer.status === "answered" && !revealing;

  // The caption and percentage follow the time spent waiting.
  useEffect(() => {
    if (!pending || reduceMotion) return;
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, [pending, reduceMotion]);

  // The lines arrive one at a time once the answer is in.
  useEffect(() => {
    if (answer.status !== "answered") return;
    if (answer.built || reduceMotion) {
      setShown(claims.length);
      return;
    }
    if (shown >= claims.length) {
      onBuilt(answer.id);
      return;
    }
    const timer = window.setTimeout(() => setShown((count) => count + 1), shown === 0 ? 450 : LINE_REVEAL_MS);
    return () => window.clearTimeout(timer);
  }, [answer.status, answer.built, answer.id, shown, claims.length, reduceMotion, onBuilt]);

  // Every line is laid out from the start (only hidden), so the measures hold while lines appear.
  useLayoutEffect(() => {
    const el = card.current;
    if (!el) return;
    const lines = [...el.querySelectorAll<HTMLElement>("[data-canvas-line]")].map((line) => line.offsetTop + line.offsetHeight / 2);
    onMeasured(answer.id, el.offsetHeight, lines);
  });

  const elapsed = now - answer.startedAt;
  const caption = pending
    ? reduceMotion
      ? FIRM_ASK_COPY.pending
      : pendingCaption(elapsed)
    : answer.status === "failed"
      ? FIRM_CANVAS_COPY.failed
      : revealing
        ? FIRM_CANVAS_COPY.writing
        : result?.status === "answered"
          ? FIRM_CANVAS_COPY.done(claims.length, answerBoards(claims).length)
          : result?.coverage ?? "";

  return (
    <div
      ref={card}
      data-testid="canvas-answer"
      data-answer-status={answer.status}
      data-canvas-no-pan=""
      className={cn(
        "fc-answer ph-no-autocapture absolute flex flex-col gap-3 rounded-[var(--radius-card)] border bg-card p-4 shadow-card",
        focused ? "border-(--live-edge)" : "border-border",
        dimmed && "opacity-70",
        pending && "fc-building",
        done && "fc-done",
      )}
      data-ph-no-autocapture=""
      style={{ left: answer.x, top: answer.y, width: CANVAS_SIZES.answerW }}
    >
      <span aria-hidden className="fc-scan" />
      <span aria-hidden className="fc-sweep" />
      <p className="text-(length:--type-body) font-semibold text-foreground [text-wrap:balance]">{answer.question}</p>
      <p role="status" className="flex items-center gap-2 text-(length:--type-small) text-muted-foreground">
        <span aria-hidden className={cn("fc-dot", done && "fc-dot-done")} />
        <span className="min-w-0 flex-1" data-testid="canvas-answer-caption">
          {caption}
        </span>
        {pending && !reduceMotion ? <span className="font-mono text-(length:--type-label) tabular-nums">{`${pendingPercent(elapsed)}%`}</span> : null}
      </p>

      {pending ? (
        <ul aria-hidden className="flex flex-col gap-3">
          {[0, 1, 2].map((index) => (
            <li key={index} className="flex flex-col gap-1.5">
              <span className="fc-bar h-2.5 w-full rounded-[var(--radius-control)] bg-grey-2" />
              <span className="fc-bar h-2.5 w-3/5 rounded-[var(--radius-control)] bg-grey-2" />
            </li>
          ))}
        </ul>
      ) : null}

      {answer.status === "failed" ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-(length:--type-small) text-destructive">
          <span>{answer.limited ? FIRM_BRAIN_LIMIT_COPY.shown : FIRM_CANVAS_COPY.failed}</span>
          {answer.limited ? null : (
            <Button type="button" variant="outline" size="sm" onClick={() => onRetry(answer)}>
              {FIRM_CANVAS_COPY.tryAgain}
            </Button>
          )}
        </div>
      ) : null}

      {result?.status === "not_found" ? (
        <div className="text-(length:--type-body) text-foreground">
          <p>{FIRM_ASK_COPY.notFound}</p>
          {result.nearest ? <p className="mt-1 text-(length:--type-small) text-muted-foreground">{`${FIRM_ASK_COPY.nearest}: ${result.nearest}`}</p> : null}
        </div>
      ) : null}
      {result?.status === "about_people" ? <p className="text-(length:--type-body) text-foreground">{FIRM_ASK_COPY.aboutPeople}</p> : null}
      {result?.summary && done ? <p className="fc-line-in text-(length:--type-body) leading-relaxed text-foreground">{result.summary}</p> : null}

      {claims.length ? (
        <ol className="flex flex-col gap-3">
          {claims.map((claim, index) => {
            const source = result!.sources[claim.itemId];
            const visible = index < shown;
            return (
              <li
                key={`${claim.itemId}-${index}`}
                data-canvas-line=""
                data-board={claim.boardId}
                data-shown={visible ? "true" : "false"}
                aria-hidden={visible ? undefined : true}
                className="fc-line flex flex-col gap-1.5"
              >
                <p className="text-(length:--type-body) leading-relaxed text-foreground">
                  {claim.text}{" "}
                  {source ? (
                    <button
                      type="button"
                      tabIndex={visible ? 0 : -1}
                      onClick={() => onOpenSource(claim.itemId)}
                      aria-label={`${FIRM_CANVAS_COPY.source}: ${source.boardTitle}`}
                      className={cn(tagVariants({ tone: "accent" }), "align-[1px] whitespace-nowrap hover:underline")}
                    >
                      {source.boardTitle}
                    </button>
                  ) : null}
                </p>
                {claim.grade === "quoted" && visible ? (
                  <blockquote className="border-l-2 border-border pl-3 text-(length:--type-small) text-muted-foreground">{claim.quote}</blockquote>
                ) : null}
                {visible && done && source && source.type !== "outcome" ? <CiteThis quote={claim.quote} sourceItemId={claim.itemId} profileId={profileId} /> : null}
              </li>
            );
          })}
        </ol>
      ) : null}

      {done && result?.facts.length ? (
        <ul data-firm-facts className="flex flex-col gap-1 border-t border-border pt-3">
          {result.facts.map((fact) => (
            <li key={fact.boardId} className="text-(length:--type-small) text-muted-foreground">
              <span className="font-medium text-foreground">{fact.title}</span>
              {[fact.client, fact.weeks ? FIRM_ASK_COPY.weeks(fact.weeks) : null, fact.fee, fact.lead ? FIRM_ASK_COPY.lead(fact.lead) : null, fact.outcome]
                .filter(Boolean)
                .map((part) => ` · ${part}`)
                .join("")}
            </li>
          ))}
        </ul>
      ) : null}
      {done && result?.oneSource ? <p className="text-(length:--type-small) text-muted-foreground">{FIRM_ASK_COPY.oneSource}</p> : null}
      {done && result && result.status === "answered" ? (
        <p data-firm-coverage className="text-(length:--type-small) text-muted-foreground">
          {result.coverage}
        </p>
      ) : null}
    </div>
  );
}

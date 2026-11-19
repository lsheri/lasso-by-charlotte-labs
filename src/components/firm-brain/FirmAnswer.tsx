import { FIRM_ASK_COPY, type FirmAskResult } from "@/lib/firm-ask-shared";

import { CiteThis } from "./CiteThis";
import { FirmSourceCard } from "./FirmSourceCard";

/**
 * A firm answer: the summary (only when every claim held), each claim with its source, a facts strip per engagement
 * built by code, the coverage line, and what was read. "Not found" never stretches; "about people" shows engagements.
 */
export function FirmAnswer({
  result,
  onOpenSource,
  profileId,
}: {
  result: FirmAskResult;
  onOpenSource: (itemId: string) => void;
  /** With a profile, each citation of an item offers "Cite this". A close-out lesson is not an item, so it does not. */
  profileId?: string | null | undefined;
}) {
  // Work the firm marked as an exemplar is listed first; nothing else about the order changes.
  const readList = (ids: string[]) =>
    [...ids.filter((id) => result.sources[id]?.exemplar), ...ids.filter((id) => !result.sources[id]?.exemplar)].map((id) => result.sources[id]).filter(Boolean).map((source) => `${source!.title} (${source!.boardTitle})`);
  const full = readList(result.read.full);
  const summary = readList(result.read.summary);

  return (
    <div data-firm-answer={result.status} className="mt-4 flex flex-col gap-4">
      {result.status === "not_found" ? (
        <div>
          <p className="text-(length:--type-body) text-foreground">{FIRM_ASK_COPY.notFound}</p>
          {result.nearest ? (
            <p className="mt-1 text-(length:--type-small) text-muted-foreground">{`${FIRM_ASK_COPY.nearest}: ${result.nearest}`}</p>
          ) : null}
        </div>
      ) : null}
      {result.status === "about_people" ? <p className="text-(length:--type-body) text-foreground">{FIRM_ASK_COPY.aboutPeople}</p> : null}
      {result.summary ? <p className="text-(length:--type-lead) leading-relaxed text-foreground">{result.summary}</p> : null}

      {result.claims.length ? (
        <ol className="flex flex-col gap-3">
          {result.claims.map((claim, index) => {
            const source = result.sources[claim.itemId];
            return (
              <li key={`${claim.itemId}-${index}`} data-firm-claim className="flex flex-col gap-1.5">
                <p className="text-(length:--type-body) text-foreground">{claim.text}</p>
                {claim.grade === "quoted" ? (
                  <blockquote className="border-l-2 border-border pl-3 text-(length:--type-small) text-muted-foreground">{claim.quote}</blockquote>
                ) : null}
                {source ? <FirmSourceCard source={source} grade={claim.grade} onOpen={() => onOpenSource(claim.itemId)} /> : null}
                {source && source.type !== "outcome" ? <CiteThis quote={claim.quote} sourceItemId={claim.itemId} profileId={profileId} /> : null}
              </li>
            );
          })}
        </ol>
      ) : null}
      {result.oneSource ? <p className="text-(length:--type-small) text-muted-foreground">{FIRM_ASK_COPY.oneSource}</p> : null}

      {result.facts.length ? (
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

      <p data-firm-coverage className="font-mono text-(length:--type-label) uppercase tracking-[0.06em] text-muted-foreground">{result.coverage}</p>
      {full.length || summary.length ? (
        <details className="text-(length:--type-small) text-muted-foreground">
          <summary className="cursor-pointer">{FIRM_ASK_COPY.readTitle}</summary>
          {full.length ? (
            <p className="mt-1">
              <span className="font-medium text-foreground">{FIRM_ASK_COPY.readFull}: </span>
              {full.join("; ")}
            </p>
          ) : null}
          {summary.length ? (
            <p className="mt-1">
              <span className="font-medium text-foreground">{FIRM_ASK_COPY.readSummary}: </span>
              {summary.join("; ")}
            </p>
          ) : null}
        </details>
      ) : null}
    </div>
  );
}

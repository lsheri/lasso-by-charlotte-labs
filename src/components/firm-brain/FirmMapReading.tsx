import { FIRM_MAP_COPY, type MapReading, type MapThread } from "@/lib/firm-map-shared";
import { firmDate } from "@/lib/firm-ask-shared";
import { walkTagOfNode } from "@/lib/firm-walkthrough-shared";

import { FirmWalkthrough } from "./FirmWalkthrough";

const eyebrow =
  "font-mono text-(length:--type-label) uppercase tracking-wider text-muted-foreground";

function ThreadRows({
  threads,
  onFocus,
}: {
  threads: MapThread[];
  onFocus: (threadId: string | null) => void;
}) {
  return (
    <ul className="flex flex-col gap-1">
      {threads.map((thread) => (
        <li key={thread.id}>
          <button
            type="button"
            data-reading-thread={thread.id}
            onMouseEnter={() => onFocus(thread.id)}
            onMouseLeave={() => onFocus(null)}
            onFocus={() => onFocus(thread.id)}
            onBlur={() => onFocus(null)}
            className="flex w-full items-baseline justify-between gap-3 rounded-[var(--radius-control)] px-2 py-1.5 text-left hover:bg-accent-soft focus-visible:bg-accent-soft"
          >
            <span className="min-w-0">
              <span className="block text-(length:--type-body) text-foreground">{thread.name}</span>
              <span className="block text-(length:--type-small) text-muted-foreground">
                {thread.title}
              </span>
            </span>
            <span className="shrink-0 font-mono text-(length:--type-label) tabular-nums text-muted-foreground">
              {firmDate(thread.startedOn)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * The reading panel beside the map: what the selected point, held thread or last answer means, in plain words. It
 * names engagements, situations and methods only; counts are of engagements, never of people.
 *
 * A pinned situation or method also offers its walk-through ("How we do this"). Only a pinned point does: a point that
 * is merely under the mouse leaves the panel as soon as the mouse moves toward the button.
 */
export function FirmMapReading({
  reading,
  onFocus,
  pinned = null,
  profileId = null,
}: {
  reading: MapReading;
  onFocus: (threadId: string | null) => void;
  /** The point held by a tap or click, if any. */
  pinned?: string | null;
  profileId?: string | null | undefined;
}) {
  if (reading.kind === "overview") {
    const { totals } = reading;
    return (
      <div data-testid="firm-map-reading" data-reading="overview" className="flex flex-col gap-4">
        <div>
          <p className={eyebrow}>{FIRM_MAP_COPY.overviewEyebrow}</p>
          <h3 className="mt-1 text-(length:--type-lead) font-semibold text-foreground">
            {FIRM_MAP_COPY.overviewTitle}
          </h3>
        </div>
        <p className="text-(length:--type-body) text-muted-foreground">
          {FIRM_MAP_COPY.overviewBody}
        </p>
        <dl className="flex flex-wrap gap-6">
          {(
            [
              ["engagements", totals.engagements],
              ["methods", totals.methods],
              ["lessons", totals.lessons],
            ] as const
          ).map(([key, value]) => (
            <div key={key} data-total={key}>
              <dd className="text-(length:--type-title) font-semibold tabular-nums text-foreground">
                {value}
              </dd>
              <dt className="text-(length:--type-small) text-muted-foreground">
                {FIRM_MAP_COPY[key]}
              </dt>
            </div>
          ))}
        </dl>
      </div>
    );
  }

  if (reading.kind === "trace") {
    return (
      <div data-testid="firm-map-reading" data-reading="trace" className="flex flex-col gap-3">
        <div>
          <p className={eyebrow}>{FIRM_MAP_COPY.traceEyebrow}</p>
          <h3 className="mt-1 text-(length:--type-lead) font-semibold text-foreground">
            {FIRM_MAP_COPY.traceTitle(reading.threads.length)}
          </h3>
        </div>
        <p className="text-(length:--type-body) text-muted-foreground">{FIRM_MAP_COPY.traceBody}</p>
        <ThreadRows threads={reading.threads} onFocus={onFocus} />
      </div>
    );
  }

  if (reading.kind === "thread") {
    const { thread } = reading;
    return (
      <div data-testid="firm-map-reading" data-reading="thread" className="flex flex-col gap-3">
        <div>
          <p className={eyebrow}>{FIRM_MAP_COPY.kind.deck}</p>
          <h3 className="mt-1 text-(length:--type-lead) font-semibold text-foreground">
            {thread.name}
          </h3>
          <p className="text-(length:--type-small) text-muted-foreground">{`${thread.title} · ${firmDate(thread.startedOn)}`}</p>
        </div>
        <ol className="flex flex-col gap-1 text-(length:--type-body) text-foreground">
          <li>
            <span className={eyebrow}>{FIRM_MAP_COPY.kind.situation}</span> {thread.situationLabel}
          </li>
          {thread.methodLabels.map((label) => (
            <li key={label}>
              <span className={eyebrow}>{FIRM_MAP_COPY.kind.method}</span> {label}
            </li>
          ))}
          {thread.hasLesson ? (
            <li className="text-muted-foreground">{FIRM_MAP_COPY.lesson}</li>
          ) : null}
          {thread.hasDeck ? <li className="text-muted-foreground">{FIRM_MAP_COPY.deck}</li> : null}
        </ol>
      </div>
    );
  }

  const { node, threads, related } = reading;
  const total = threads.length;
  const walkTag = pinned === node.id ? walkTagOfNode(node.id) : null;
  return (
    <div data-testid="firm-map-reading" data-reading="node" className="flex flex-col gap-4">
      <div>
        <p className={eyebrow}>{FIRM_MAP_COPY.kind[node.kind]}</p>
        <h3 className="mt-1 text-(length:--type-lead) font-semibold text-foreground">
          {node.label}
        </h3>
      </div>
      <p className="text-(length:--type-body) text-muted-foreground">
        {node.kind === "situation"
          ? FIRM_MAP_COPY.situationBody(total)
          : FIRM_MAP_COPY.methodBody(total)}
      </p>
      {walkTag ? <FirmWalkthrough key={node.id} tag={walkTag} profileId={profileId} /> : null}
      {related.length ? (
        <section className="flex flex-col gap-2">
          <h4 className={eyebrow}>
            {node.kind === "situation"
              ? FIRM_MAP_COPY.relatedSituation
              : FIRM_MAP_COPY.relatedMethod}
          </h4>
          <ul className="flex flex-col gap-2">
            {related.map((row) => (
              <li key={row.label} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 flex-1 text-(length:--type-body) text-foreground">
                  {row.label}
                  <span className="mt-1 block h-1 overflow-hidden rounded-[var(--radius-control)] bg-muted">
                    <span
                      className="block h-full bg-foreground"
                      style={{ width: `${Math.round((row.count / total) * 100)}%` }}
                    />
                  </span>
                </span>
                <span className="shrink-0 font-mono text-(length:--type-label) tabular-nums text-muted-foreground">
                  {FIRM_MAP_COPY.of(row.count, total)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="flex flex-col gap-2">
        <h4 className={eyebrow}>{FIRM_MAP_COPY.openList}</h4>
        <ThreadRows threads={threads} onFocus={onFocus} />
      </section>
    </div>
  );
}

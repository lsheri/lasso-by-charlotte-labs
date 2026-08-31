import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";

import { CARD_FILE_FORMAT_ICON_SIZE, FileFormatIcon } from "@/components/work/FileFormatIcon";
import { deliverableTag } from "@/lib/deliverable-kinds";
import {
  PAST_WORK_EMPTY_LINE,
  PAST_WORK_FOOTER_LINE,
  PAST_WORK_HINT,
  PAST_WORK_LOOK_LABEL,
  PAST_WORK_PLACEHOLDER,
  PAST_WORK_RESULTS_LABEL,
  PAST_WORK_SUBMIT_LABEL,
  PAST_WORK_WHY_LABEL,
  type PastWorkCandidate,
  type PastWorkMatch,
} from "@/lib/past-work-shared";
import { searchPastWork } from "@/lib/past-work.functions";
import { openJourney } from "@/lib/journey-state";

type Answer = {
  matches: PastWorkMatch[];
  byId: Map<string, PastWorkCandidate>;
};

function Pending() {
  return (
    <span className="nb-dots" role="status" aria-label="Reading shipped work">
      <span className="nb-dot" />
      <span className="nb-dot" />
      <span className="nb-dot" />
    </span>
  );
}

/**
 * Pass 138: describe what you are working on, read shipped work like it. The
 * answer is ephemeral: nothing about the question is kept.
 */
export function PastWorkSearch() {
  const run = useServerFn(searchPastWork) as unknown as (input: {
    data: { description: string };
  }) => Promise<{ matches: PastWorkMatch[]; candidates: PastWorkCandidate[] }>;

  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<Answer | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const text = description.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const result = await run({ data: { description: text } });
      setAnswer({
        matches: result.matches,
        byId: new Map(result.candidates.map((c) => [c.work_item_id, c] as const)),
      });
    } catch {
      setAnswer({ matches: [], byId: new Map() });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section data-testid="past-work-search">
      <form onSubmit={onSubmit} className="flex flex-col gap-2">
        <div className="flex items-center gap-2 rounded-sm border border-[var(--nb-rule)] bg-background px-3 py-2">
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={PAST_WORK_PLACEHOLDER}
            aria-label={PAST_WORK_PLACEHOLDER}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {busy ? (
            <Pending />
          ) : (
            <button
              type="submit"
              className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--nb-green)]"
            >
              {PAST_WORK_SUBMIT_LABEL}
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{PAST_WORK_HINT}</p>
      </form>

      {answer ? (
        <div className="mt-4">
          {answer.matches.length === 0 ? (
            <p className="text-sm text-muted-foreground">{PAST_WORK_EMPTY_LINE}</p>
          ) : (
            <>
              <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                {PAST_WORK_RESULTS_LABEL}
              </div>
              <ul className="mt-2 flex flex-col gap-3">
                {answer.matches.map((match) => {
                  const card = answer.byId.get(match.work_item_id);
                  const kindTag = deliverableTag(
                    card ? { deliverable_kind: card.deliverable_kind } : null,
                    card?.kind,
                  );
                  return (
                    <li
                      key={match.work_item_id}
                      className="rounded-sm border border-[var(--nb-rule)] bg-background p-3"
                    >
                      <span className="flex items-center gap-2.5">
                        <FileFormatIcon
                          item={
                            card
                              ? {
                                  meta: { file_format: card.file_format },
                                  source_meta: {
                                    mime_type: card.mime_type,
                                    filename: card.filename,
                                  },
                                  title: card.title,
                                }
                              : null
                          }
                          size={CARD_FILE_FORMAT_ICON_SIZE}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            openJourney({
                              anchorId: match.work_item_id,
                              anchorTitle: card?.title ?? "",
                              engagementId: card?.engagement_id ?? "",
                            })
                          }
                          className="min-w-0 text-left text-sm font-medium underline-offset-2 hover:underline"
                        >
                          {card?.title || "Shipped work"}
                        </button>
                      </span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0 leading-[1.35]">
                        <span
                          data-testid={`past-work-kind-${match.work_item_id}`}
                          className="rounded-sm bg-[var(--nb-grey-1)] px-1 py-px font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--nb-graphite)]"
                        >
                          {kindTag}
                        </span>
                        {card?.client_label || card?.engagement_code ? (
                          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--nb-soft)]">
                            {card.client_label ?? ""}
                            {card.client_label && card.engagement_code ? " · " : ""}
                            <span className="font-semibold text-[var(--nb-green)]">
                              {card.engagement_code ?? ""}
                            </span>
                          </span>
                        ) : null}
                      </span>
                      {card?.engagement_id ? (
                        <div className="mt-0.5 leading-[1.35]">
                          <Link
                            to="/engagements/$id"
                            params={{ id: card.engagement_id }}
                            className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--nb-mid)] underline-offset-2 hover:underline"
                          >
                            {[card.engagement_code, card.engagement_title]
                              .filter(Boolean)
                              .join(" ") || "Engagement"}
                          </Link>
                        </div>
                      ) : null}
                      <p className="mt-2 text-sm">
                        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                          {PAST_WORK_WHY_LABEL}
                        </span>
                        <br />
                        {match.why}
                      </p>
                      {match.look_at ? (
                        <p className="mt-2 text-sm">
                          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                            {PAST_WORK_LOOK_LABEL}
                          </span>
                          <br />
                          {match.look_at}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            {PAST_WORK_FOOTER_LINE}
          </p>
        </div>
      ) : null}
    </section>
  );
}

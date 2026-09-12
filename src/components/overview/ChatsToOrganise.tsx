import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import { ClaimToClient } from "@/components/work/ClaimToClient";
import { SourceMark, VendorMark } from "@/components/work/SourceMark";
import { stampDate } from "@/components/work/card-stamp";
import { noteHue, notePaper } from "@/components/work/note-paper";
import { useMappingSuggestions } from "@/hooks/use-mapping-suggestions";
import { useNoteLive } from "@/hooks/use-note-live";
import type { MappingSuggestion } from "@/lib/mapping-shared";
import type { WorkItemRow } from "@/lib/work-types";

/** The most a person can usefully scan at a glance on the overview. */
const QUEUE_CAP = 4;

function NoteRow({
  item,
  action,
}: {
  item: WorkItemRow;
  /** Line three: the next act this card offers. */
  action: ReactNode;
}) {
  const live = useNoteLive<HTMLDivElement>();

  return (
    <div
      ref={live}
      className="nb-paper"
      data-paper-state="unmapped"
      style={{ ...notePaper(item.id), ...noteHue(null) }}
    >
      <div className="nb-paper-body">
        {/* Line one: where it came from and when it landed. */}
        <div className="flex items-center gap-1.5">
          <SourceMark item={item} size={14} disc />
          <span className="min-w-0 truncate font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
            <VendorMark item={item} />
            {item.source_vendor ? (
              <>
                {" · "}
                {stampDate(item.captured_at)}
              </>
            ) : (
              <>{stampDate(item.captured_at)}</>
            )}
          </span>
        </div>

        {/* Line two: the title. */}
        <p
          title={item.title}
          className="mt-1 line-clamp-2 break-words text-[13px] leading-[18px] text-foreground"
        >
          {item.title}
        </p>

        {/* Line three: the next act, chosen by the section. */}
        <div className="mt-2">{action}</div>
      </div>
    </div>
  );
}

function Queue({
  title,
  count,
  note,
  items,
  remainderTestId,
  headerAction,
  cardAction,
}: {
  title: string;
  count: number;
  note: string;
  items: WorkItemRow[];
  remainderTestId: string;
  headerAction?: ReactNode;
  cardAction: (item: WorkItemRow) => ReactNode;
}) {
  const shown = items.slice(0, QUEUE_CAP);
  const rest = items.length - shown.length;

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-[16px] font-semibold leading-[22px] text-foreground">
            {title} ({count})
          </h2>
          <p className="mt-0.5 text-[11.5px] leading-[17px] text-muted-foreground">{note}</p>
        </div>
        {headerAction}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {shown.map((item) => (
          <NoteRow key={item.id} item={item} action={cardAction(item)} />
        ))}
      </div>

      {rest > 0 ? (
        <p
          className="mt-3 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground"
          data-testid={remainderTestId}
        >
          {rest} more in the pile
        </p>
      ) : null}
    </>
  );
}

/**
 * The queue of unmapped conversations at the top of /overview, split by degree
 * of claim. Pieces with no client yet get the cheap act, naming whose work it
 * is. Pieces already claimed to a client get the suggestion job, which needs a
 * client on the item to have anything to work with.
 *
 * It renders from data already on the page; the only server call it makes is
 * the explicit suggestion job, triggered by the button on the second section.
 */
export function ChatsToOrganise({ items }: { items: WorkItemRow[] }) {
  const { active, taskLabels, suggesting, acceptPending, suggest, accept } =
    useMappingSuggestions();

  const unmapped = items
    .filter((item) => item.visibility === "unmapped")
    .sort((a, b) => (b.captured_at ?? "").localeCompare(a.captured_at ?? ""));
  const unclaimed = unmapped.filter((item) => !item.client_id);
  const awaiting = unmapped.filter((item) => Boolean(item.client_id));

  if (unclaimed.length === 0 && awaiting.length === 0) return null;

  return (
    <>
      {unclaimed.length > 0 ? (
        <section className="mt-2" data-testid="overview-chats-to-organise">
          <Queue
            title="Not claimed yet"
            count={unclaimed.length}
            note="These landed on their own. Say whose work it is and the rest gets easier."
            items={unclaimed}
            remainderTestId="overview-chats-remainder"
            cardAction={(item) => (
              <ClaimToClient
                item={item}
                surface="overview"
                emphasis="lead"
                label="Say whose this is"
              />
            )}
          />
        </section>
      ) : null}

      {awaiting.length > 0 ? (
        <section className="mt-2" data-testid="overview-chats-awaiting">
          <Queue
            title="Waiting on a workstream"
            count={awaiting.length}
            note="You have said whose these are. They still need a place in the work."
            items={awaiting}
            remainderTestId="overview-chats-awaiting-remainder"
            headerAction={
              <button
                type="button"
                onClick={() => void suggest()}
                disabled={suggesting}
                className="nb-pencil-cta inline-flex items-center justify-center rounded-[var(--radius)] border px-3 py-1.5 text-[11.5px] font-medium transition-all disabled:opacity-50"
              >
                {suggesting ? "Thinking…" : "Suggest where these go"}
              </button>
            }
            cardAction={(item) => {
              const suggestion = active.find((s) => s.work_item_id === item.id);
              const suggestedLabel = suggestion ? taskLabels?.[suggestion.task_id] : undefined;
              return suggestedLabel ? (
                <SuggestionChip
                  label={suggestedLabel}
                  disabled={acceptPending}
                  onAccept={() =>
                    void accept(suggestion!, {
                      type: item.type ?? "ai_thread",
                      source: item.source ?? "import",
                    })
                  }
                />
              ) : (
                <Link
                  to="/work"
                  className="inline-flex items-center text-[11.5px] font-medium text-accent-deep hover:underline"
                >
                  File it
                </Link>
              );
            }}
          />
        </section>
      ) : null}
    </>
  );
}

function SuggestionChip({
  label,
  disabled,
  onAccept,
}: {
  label: string;
  disabled: boolean;
  onAccept: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onAccept}
      className="inline-flex max-w-full items-center rounded-full border border-border bg-secondary px-2 py-1 text-left font-mono text-[10px] uppercase tracking-[0.06em] text-foreground transition-colors hover:border-foreground disabled:opacity-50"
      title={label}
    >
      <span className="truncate">{label}</span>
    </button>
  );
}

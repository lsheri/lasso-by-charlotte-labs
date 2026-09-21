import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import { ClaimToClient } from "@/components/work/ClaimToClient";
import { ConversationCard } from "@/components/work/ConversationCard";
import { WorkNote } from "@/components/work/WorkNote";
import { useMappingSuggestions } from "@/hooks/use-mapping-suggestions";
import { orderByWorkDate } from "@/lib/work-order";
import {
  entryHead,
  entryItems,
  entryKey,
  groupConversations,
  isConversationGroup,
  type ConversationGroup,
  type WorkItemRow,
} from "@/lib/work-types";

/** The most a person can usefully scan at a glance on the overview. */
const QUEUE_CAP = 4;

type Entry = WorkItemRow | ConversationGroup;

function Queue({
  title,
  count,
  note,
  entries,
  remainderTestId,
  headerAction,
  cardAction,
  onOpen,
}: {
  title?: string;
  count?: number;
  note?: string;
  entries: Entry[];
  remainderTestId: string;
  headerAction?: ReactNode;
  cardAction: (entry: Entry) => ReactNode;
  onOpen?: ((item: WorkItemRow, entry: Entry) => void) | undefined;
}) {
  const shown = entries.slice(0, QUEUE_CAP);
  const rest = entries.length - shown.length;

  return (
    <>
      {title || headerAction ? (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          {title ? (
            <div>
              <h2 className="text-[16px] font-semibold leading-[22px] text-foreground">
                {title} ({count})
              </h2>
              {note ? (
                <p className="mt-0.5 nb-type-small leading-[17px] text-muted-foreground">{note}</p>
              ) : null}
            </div>
          ) : null}
          {headerAction}
        </div>
      ) : null}

      <div className="nb-paper-wall">
        {shown.map((entry) =>
          isConversationGroup(entry) ? (
            // P1: one pushed conversation, one card, every artifact inside it.
            <ConversationCard
              key={entry.key}
              group={entry}
              variant="unmapped"
              dense
              onOpen={(item) => onOpen?.(item, entry)}
              actions={null}
              primaryAction={cardAction(entry)}
            />
          ) : (
            <WorkNote
              key={entry.id}
              item={entry}
              {...(onOpen ? { onOpen: () => onOpen(entry, entry) } : {})}
              actions={cardAction(entry)}
            />
          ),
        )}
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
export function ChatsToOrganise({
  items,
  onOpen,
}: {
  items: WorkItemRow[];
  /** Opens a piece of work, using the page's own reading panel. */
  onOpen?: ((item: WorkItemRow, entry: Entry) => void) | undefined;
}) {
  const { active, taskLabels, suggesting, acceptPending, suggest, accept } =
    useMappingSuggestions();

  const unmapped = orderByWorkDate(items.filter((item) => item.visibility === "unmapped"));
  // P1: group first, then split. A push is one entry wherever it lands.
  const entries = groupConversations(unmapped);
  const unclaimed = entries.filter((entry) => !entryHead(entry).client_id);
  const awaiting = entries.filter((entry) => Boolean(entryHead(entry).client_id));

  if (unclaimed.length === 0 && awaiting.length === 0) return null;

  return (
    <>
      {unclaimed.length > 0 ? (
        <section className="mt-2" data-testid="overview-chats-to-organise">
          {/* I1: the Unmapped filter chip above already names this set, so the
              heading said it twice. The teaching sentence moved to that
              filter's empty state. */}
          <Queue
            entries={unclaimed}
            remainderTestId="overview-chats-remainder"
            onOpen={onOpen}
            cardAction={(entry) => (
              <ClaimToClient
                item={entryHead(entry)}
                items={entryItems(entry)}
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
            entries={awaiting}
            remainderTestId="overview-chats-awaiting-remainder"
            onOpen={onOpen}
            headerAction={
              <button
                type="button"
                onClick={() => void suggest()}
                disabled={suggesting}
                className="nb-pencil-cta inline-flex items-center justify-center rounded-[var(--radius)] border px-3 py-1.5 nb-type-small font-medium transition-all disabled:opacity-50"
              >
                {suggesting ? "Thinking…" : "Suggest where these go"}
              </button>
            }
            cardAction={(entry) => {
              const item = entryHead(entry);
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
                  className="inline-flex items-center nb-type-small font-medium text-accent-deep hover:underline"
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

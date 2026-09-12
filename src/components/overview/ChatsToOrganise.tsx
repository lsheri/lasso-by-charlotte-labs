import { Link } from "@tanstack/react-router";

import { SourceMark, VendorMark } from "@/components/work/SourceMark";
import { stampDate } from "@/components/work/card-stamp";
import { noteHue, notePaper } from "@/components/work/note-paper";
import { useMappingSuggestions } from "@/hooks/use-mapping-suggestions";
import { useNoteLive } from "@/hooks/use-note-live";
import type { WorkItemRow } from "@/lib/work-types";

/** The most a person can usefully scan at a glance on the overview. */
const QUEUE_CAP = 4;

function NoteRow({
  item,
}: {
  item: WorkItemRow;
}) {
  const { active, taskLabels, acceptPending, accept } = useMappingSuggestions();
  const live = useNoteLive<HTMLDivElement>();

  const suggestion = active.find((s) => s.work_item_id === item.id);
  const suggestedLabel = suggestion ? taskLabels?.[suggestion.task_id] : null;

  return (
    <div
      ref={live}
      className="nb-note"
      data-note-state="unmapped"
      style={{ ...notePaper(item.id), ...noteHue(null) }}
    >
      <div className="nb-note-body">
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

        {/* Line three: accept the suggestion, or link to the work page. */}
        <div className="mt-2">
          {suggestedLabel ? (
            <button
              type="button"
              disabled={acceptPending}
              onClick={() =>
                void accept(suggestion, {
                  type: item.type ?? "ai_thread",
                  source: item.source ?? "import",
                })
              }
              className="inline-flex max-w-full items-center rounded-full border border-border bg-secondary px-2 py-1 text-left font-mono text-[10px] uppercase tracking-[0.06em] text-foreground transition-colors hover:border-foreground disabled:opacity-50"
              title={suggestedLabel}
            >
              <span className="truncate">{suggestedLabel}</span>
            </button>
          ) : (
            <Link
              to="/work"
              className="inline-flex items-center text-[11.5px] font-medium text-accent-deep hover:underline"
            >
              File it
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The queue of unmapped conversations at the top of /overview.
 *
 * It renders from data already on the page; the only server call it makes is
 * the explicit suggestion job, triggered by the button below.
 */
export function ChatsToOrganise({ items }: { items: WorkItemRow[] }) {
  const { suggesting, suggest } = useMappingSuggestions();

  const unmapped = items
    .filter((item) => item.visibility === "unmapped")
    .sort((a, b) => (b.captured_at ?? "").localeCompare(a.captured_at ?? ""));

  if (unmapped.length === 0) return null;

  const shown = unmapped.slice(0, QUEUE_CAP);
  const rest = unmapped.length - shown.length;

  return (
    <section className="mt-2" data-testid="overview-chats-to-organise">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-[16px] font-semibold leading-[22px] text-foreground">
            Chats to organise ({unmapped.length})
          </h2>
          <p className="mt-0.5 text-[11.5px] leading-[17px] text-muted-foreground">
            Conversations that landed on their own and are not filed yet.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void suggest()}
          disabled={suggesting}
          className="nb-pencil-cta inline-flex items-center justify-center rounded-[var(--radius)] border px-3 py-1.5 text-[11.5px] font-medium transition-all disabled:opacity-50"
        >
          {suggesting ? "Thinking…" : "Suggest where these go"}
        </button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {shown.map((item) => (
          <NoteRow key={item.id} item={item} />
        ))}
      </div>

      {rest > 0 ? (
        <p
          className="mt-3 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground"
          data-testid="overview-chats-remainder"
        >
          {rest} more in the pile
        </p>
      ) : null}
    </section>
  );
}

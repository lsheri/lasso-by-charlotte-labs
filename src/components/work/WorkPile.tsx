import { useRef, useState } from "react";

import { BUCKETS, bucketFor, type BucketKey } from "@/components/work/work-buckets";
import { SCATTER_CAP, scatterFor } from "@/components/work/pile-scatter";
import { SourceMark, sourceVendorKey } from "@/components/work/SourceMark";
import { TypeIcon } from "@/components/work/TypeIcon";
import {
  isConversationGroup,
  type ConversationGroup,
  type WorkItemRow,
} from "@/lib/work-types";

export type WorkEntry = WorkItemRow | ConversationGroup;

/** The item that gives an entry its identity: a conversation reads as its head. */
function headOf(entry: WorkEntry): WorkItemRow {
  return isConversationGroup(entry) ? (entry.transcript ?? entry.items[0]!) : entry;
}

function keyOf(entry: WorkEntry): string {
  return isConversationGroup(entry) ? entry.key : entry.id;
}

/**
 * One piece of unmapped work as a small sheet of paper: its name clamped to two
 * lines, and the mark that says where it came from (the LLM's logo for a
 * conversation, the type glyph otherwise).
 */
function PaperCard({ entry, onClick }: { entry: WorkEntry; onClick: () => void }) {
  const head = headOf(entry);
  const { dx, dy, rot } = scatterFor(keyOf(entry));
  // The brand mark is the truth about where the work came from; the type glyph
  // is the honest fallback when we cannot name a vendor.
  const brand = <SourceMark item={head} size={14} />;
  return (
    <button
      type="button"
      onClick={onClick}
      className="nb-paper"
      style={
        {
          "--nb-dx": `${dx}px`,
          "--nb-dy": `${dy}px`,
          "--nb-rot": `${rot}deg`,
        } as React.CSSProperties
      }
    >
      <span className="nb-paper-mark">
        {sourceVendorKey(head) ? brand : <TypeIcon item={head} size="sm" />}
      </span>
      <span className="nb-paper-title">{head.title}</span>
    </button>
  );
}


/**
 * The unmapped set, two ways of looking at the same work: loose paper on quad
 * ruling (the default) and the type matrix. Clicking a paper opens that piece
 * of work; the toggle is the only thing that changes the view.
 */
export function WorkPile({
  entries,
  renderEntry,
  onOpenEntry,
  forceMatrix = false,
}: {
  entries: WorkEntry[];
  renderEntry: (entry: WorkEntry) => React.ReactNode;
  /** Opens a piece of work from the pile, without changing the view. */
  onOpenEntry?: (entry: WorkEntry) => void;
  /** Select mode and live suggestions need the rows themselves on screen. */
  forceMatrix?: boolean;
}) {

  const [view, setView] = useState<"pile" | "matrix">("pile");
  const shown = forceMatrix ? "matrix" : view;
  const startY = useRef<number | null>(null);
  const startX = useRef<number | null>(null);

  const grouped = BUCKETS.map((bucket) => ({
    bucket,
    entries: entries.filter((entry) => bucketFor(headOf(entry).type).key === bucket.key),
  })).filter((group) => group.entries.length > 0);

  const counts = new Map<BucketKey, number>();
  for (const group of grouped) counts.set(group.bucket.key, group.entries.length);

  const papers = entries.slice(0, SCATTER_CAP);
  const overflow = entries.length - papers.length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="nb-seg" role="group" aria-label="Unmapped view">
          <button
            type="button"
            aria-pressed={shown === "pile"}
            onClick={() => setView("pile")}
            className="nb-seg-item"
          >
            Pile
          </button>
          <button
            type="button"
            aria-pressed={shown === "matrix"}
            onClick={() => setView("matrix")}
            className="nb-seg-item"
          >
            Matrix
          </button>
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          {entries.length} unmapped
        </p>
      </div>

      {shown === "pile" ? (
        <div
          className="nb-quad rounded-[var(--radius)] border border-border p-4 sm:p-6"
          onPointerDown={(event) => {
            startY.current = event.clientY;
            startX.current = event.clientX;
          }}
          onPointerUp={(event) => {
            const y0 = startY.current;
            const x0 = startX.current;
            startY.current = null;
            startX.current = null;
            if (y0 === null || x0 === null) return;
            const dy = y0 - event.clientY;
            const dx = Math.abs(event.clientX - x0);
            // Dominant-axis check: an ambiguous drag belongs to the page.
            if (dy > 40 && dy > dx) setView("matrix");
          }}
        >
          <div
            className="nb-scatter"
            data-scatter="1"
            role="group"
            aria-label={`Unmapped work, ${entries.length} item${
              entries.length === 1 ? "" : "s"
            }. Hover to organise, or open as matrix.`}
          >
            {papers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing waiting.</p>
            ) : (
              papers.map((entry) => (
                <PaperCard key={keyOf(entry)} entry={entry} onClick={() => setView("matrix")} />
              ))
            )}
            {overflow > 0 ? (
              <button type="button" onClick={() => setView("matrix")} className="nb-paper nb-paper-more">
                <span className="nb-paper-title">+ {overflow} more</span>
              </button>
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {grouped.map(({ bucket }) => (
              <span
                key={bucket.key}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]"
                style={{ color: bucket.textColor }}
              >
                <span
                  aria-hidden
                  className="grid h-4 w-4 place-items-center rounded-[3px] text-[9px] font-semibold text-[var(--nb-white)]"
                  style={{ backgroundColor: bucket.color }}
                >
                  {bucket.letter}
                </span>
                {bucket.label} · {counts.get(bucket.key) ?? 0}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {grouped.map(({ bucket, entries: bucketEntries }) => (
            <section key={bucket.key} className="min-w-0">
              <h3 className="nb-matrix-head flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="grid h-4 w-4 place-items-center rounded-[3px] text-[9px] font-semibold text-[var(--nb-white)]"
                  style={{ backgroundColor: bucket.color }}
                >
                  {bucket.letter}
                </span>
                <span style={{ color: bucket.textColor }}>{bucket.label}</span>
                <span className="count-pill ml-1">{bucketEntries.length}</span>
              </h3>
              <div className="mt-2 space-y-2">
                {bucketEntries.map((entry) => (
                  <div key={keyOf(entry)}>{renderEntry(entry)}</div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

import { useRef, useState } from "react";

import { BUCKETS, bucketFor, type BucketKey } from "@/components/work/work-buckets";
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

/** Shallow-3D stack: a few sheets, all under 8 degrees. */
const SHEETS = 5;
const ROTATIONS = ["0deg", "-1.4deg", "2.1deg", "-2.8deg", "3.6deg"];

/**
 * The unmapped set as a pile of paper on quad ruling, resolving into a type
 * matrix. The segmented toggle and the swipe-up gesture do exactly the same
 * thing, so the gesture is never the only way through.
 */
export function WorkPile({
  entries,
  renderEntry,
}: {
  entries: WorkEntry[];
  renderEntry: (entry: WorkEntry) => React.ReactNode;
}) {
  const [view, setView] = useState<"pile" | "matrix">("pile");
  const startY = useRef<number | null>(null);
  const startX = useRef<number | null>(null);

  const grouped = BUCKETS.map((bucket) => ({
    bucket,
    entries: entries.filter((entry) => bucketFor(headOf(entry).type).key === bucket.key),
  })).filter((group) => group.entries.length > 0);

  const counts = new Map<BucketKey, number>();
  for (const group of grouped) counts.set(group.bucket.key, group.entries.length);

  const top = entries.slice(0, SHEETS);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="nb-seg" role="group" aria-label="Unmapped view">
          <button
            type="button"
            aria-pressed={view === "pile"}
            onClick={() => setView("pile")}
            className="nb-seg-item"
          >
            Pile
          </button>
          <button
            type="button"
            aria-pressed={view === "matrix"}
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

      {view === "pile" ? (
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
          <button
            type="button"
            className="nb-pile"
            onClick={() => setView("matrix")}
            aria-label={`Unmapped work, ${entries.length} item${
              entries.length === 1 ? "" : "s"
            }. Open as matrix.`}
          >
            <span className="relative block" style={{ minHeight: `${72 + SHEETS * 4}px` }}>
              {top
                .slice(1)
                .reverse()
                .map((entry, index) => {
                  const depth = top.length - 1 - index;
                  return (
                    <span
                      key={keyOf(entry)}
                      aria-hidden
                      data-stacked="1"
                      className="nb-pile-card"
                      style={
                        {
                          "--nb-i": depth,
                          "--nb-rot": ROTATIONS[depth] ?? "0deg",
                        } as React.CSSProperties
                      }
                    />
                  );
                })}
              <span data-stacked="0" className="nb-pile-card block px-4 py-4">
                <span className="block truncate text-sm font-medium text-foreground">
                  {top[0] ? headOf(top[0]).title : "Nothing waiting"}
                </span>
                <span className="mt-2 block font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  {entries.length > SHEETS
                    ? `+ ${entries.length - SHEETS} more · tap to sort by type`
                    : "Tap to sort by type"}
                </span>
              </span>
            </span>
          </button>
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
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
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

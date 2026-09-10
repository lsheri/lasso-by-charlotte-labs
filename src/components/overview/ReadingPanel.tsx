import { ToneCard } from "@/components/notebook/ToneCard";
import { SectionHeader } from "@/components/notebook/SectionHeader";
import { formatDate } from "@/lib/work-types";
import type { WorkItemRow } from "@/lib/work-types";

/**
 * Figma 21:2, "What Lasso is reading". The most recent pieces that arrived
 * from a connected tool, said out loud.
 *
 * Presentational only: it owns no hook and no query, so the page's hook list
 * is untouched. The caller passes the rows it already has.
 *
 * Deliberate deviation from the frame: Figma shows a turn count per row
 * ("21 turns"). work_items carries no turn count, so the count would be
 * invented. The capture date is true and takes its place.
 */

/** "GOOGLE DRIVE" from a vendor or source string. */
function vendorLabel(vendor: string | null | undefined, source: string | null | undefined): string {
  const raw = vendor || source || "";
  return raw.replace(/^connector:/, "").replace(/[_-]+/g, " ").trim().toUpperCase();
}

export function ReadingPanel({ items }: { items: WorkItemRow[] }) {
  if (items.length === 0) return null;

  const count = items.length;
  const label = `READING ${count} RECENT ${count === 1 ? "PIECE" : "PIECES"}`;

  return (
    <section className="mt-10" data-testid="overview-reading">
      <SectionHeader title="What Lasso is reading" />
      <ToneCard tone="paper" label={label} className="w-[560px] max-w-full">
        <ul className="mt-1 flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-baseline justify-between gap-4">
              <span className="min-w-0 truncate text-[12px] leading-[18px] text-foreground">
                {vendorLabel(item.source_vendor, item.source)
                  ? `${vendorLabel(item.source_vendor, item.source)} · ${item.title}`
                  : item.title}
              </span>
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-soft">
                {formatDate(item.captured_at)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11.5px] leading-[17px] text-muted-foreground">
          Nothing enters your record until you ask a tool to send it.
        </p>
      </ToneCard>
    </section>
  );
}

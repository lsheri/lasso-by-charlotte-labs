import { ChevronRight } from "lucide-react";
import { useState } from "react";

import { ThreadViewerById } from "@/components/work/ThreadViewerById";
import { vendorLabel } from "@/lib/conversation-shared";
import { SOURCE_GROUPS, type ContextSource } from "@/lib/reflect-shared";
import { UNMATCHED_QUOTE_NOTE } from "@/lib/quote-check";
import { hueStyles, vendorHue, workIdentity } from "@/lib/work-identity";
import type { WorkType } from "@/lib/work-types";

function SourceRow({ source, onOpen }: { source: ContextSource; onOpen: () => void }) {
  const identity = workIdentity({ type: source.type as WorkType, source_meta: null });
  const Icon = identity.icon;
  const styles = hueStyles(identity.hue);
  const vHue = vendorHue(source.source_vendor);
  const vendorStyles = vHue ? hueStyles(vHue) : null;
  return (
    <li className="flex items-center gap-2">
      <span
        className="flex size-5 shrink-0 items-center justify-center rounded-[5px] border"
        style={{ color: styles.color, background: styles.background, borderColor: styles.border }}
      >
        <Icon className="h-3 w-3" aria-hidden />
      </span>
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 truncate text-left text-xs text-foreground hover:underline"
      >
        {source.title}
      </button>
      <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
        {identity.label}
      </span>
      {source.source_vendor ? (
        <span
          className="shrink-0 rounded-full border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]"
          style={
            vendorStyles
              ? {
                  color: vendorStyles.color,
                  background: vendorStyles.background,
                  borderColor: vendorStyles.border,
                }
              : undefined
          }
        >
          {vendorLabel(source.source_vendor)}
        </span>
      ) : null}
    </li>
  );
}

/**
 * The pilot promise, made visible in the moment: exactly which pieces of work
 * an answer was built from, and how deeply each one was read. Collapsed by
 * default, and absent entirely when nothing was recorded.
 */
export function AnswerSources({
  sources,
  unmatchedQuotes = 0,
}: {
  sources: ContextSource[];
  unmatchedQuotes?: number;
}) {
  const [open, setOpen] = useState(false);
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronRight
          className={
            open ? "h-3 w-3 rotate-90 transition-transform" : "h-3 w-3 transition-transform"
          }
          aria-hidden
        />
        What I read for this answer
      </button>

      {open ? <SourceList sources={sources} /> : null}

      {unmatchedQuotes > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">{UNMATCHED_QUOTE_NOTE}</p>
      ) : null}
    </div>
  );
}

function SourceList({ sources }: { sources: ContextSource[] }) {
  const [openItem, setOpenItem] = useState<string | null>(null);
  return (
    <div className="mt-2 space-y-3 rounded-[var(--radius-md)] border border-border bg-secondary/40 px-3 py-3">
      {SOURCE_GROUPS.map((group) => {
        const rows = sources.filter((source) => source.depth === group.depth);
        if (rows.length === 0) return null;
        return (
          <div key={group.depth}>
            <p className="micro-label">{group.label}</p>
            <ul className="mt-1.5 space-y-1.5">
              {rows.map((source) => (
                <SourceRow
                  key={`${group.depth}-${source.id}`}
                  source={source}
                  onOpen={() => setOpenItem(source.id)}
                />
              ))}
            </ul>
          </div>
        );
      })}
      <ThreadViewerById workItemId={openItem} onClose={() => setOpenItem(null)} />
    </div>
  );
}

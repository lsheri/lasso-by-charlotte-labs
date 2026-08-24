import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

import { ChatUrlLink } from "@/components/work/ChatUrlLink";
import { SourceMark } from "@/components/work/SourceMark";
import type { AuditPaneItem } from "@/lib/span-provenance.functions";

/**
 * The upstream spine: the engagement's other work, oldest first, each one
 * collapsed to its title, tool and honest date line until a person opens it.
 */
export function UpstreamPane({
  items,
  baseline,
  focus,
}: {
  items: AuditPaneItem[];
  baseline: { id: string; title: string }[];
  /** The source a stitch chip pointed at: item id, and a turn id when it has one. */
  focus: { itemId: string; turnId: string | null; token: number } | null;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!focus) return;
    setOpen((prev) => new Set(prev).add(focus.itemId));
    const id = window.setTimeout(() => {
      const target = document.getElementById(
        focus.turnId ? `audit-turn-${focus.turnId}` : `audit-item-${focus.itemId}`,
      );
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
      target?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    }, 40);
    return () => window.clearTimeout(id);
  }, [focus]);

  return (
    <div className="space-y-3">
      <p className="micro-label micro-label-ai">What came before</p>
      {baseline.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {baseline.map((entry) => (
            <span
              key={entry.id}
              className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              Linked: {entry.title}
            </span>
          ))}
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          There is no other work mapped into this engagement yet, so there is nothing to trace back
          to.
        </p>
      ) : null}

      <ul className="space-y-2">
        {items.map((item) => {
          const isOpen = open.has(item.id);
          return (
            <li
              key={item.id}
              id={`audit-item-${item.id}`}
              className="rounded-[var(--radius-md)] border border-border bg-card"
            >
              <button
                type="button"
                onClick={() =>
                  setOpen((prev) => {
                    const next = new Set(prev);
                    if (next.has(item.id)) next.delete(item.id);
                    else next.add(item.id);
                    return next;
                  })
                }
                className="flex w-full items-start gap-2 px-3 py-2.5 text-left"
              >
                {isOpen ? (
                  <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                ) : (
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <SourceMark item={{ source_vendor: item.source_vendor }} />
                    <span className="min-w-0 truncate">{item.title}</span>
                  </span>
                  <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                    {item.type} · {item.date_line}
                  </span>
                </span>
              </button>

              {isOpen ? (
                <div className="border-t border-border px-3 py-3">
                  <ChatUrlLink item={{ source_meta: { url: item.source_url } } as never} />
                  {item.turns.length > 0 ? (
                    <ul className="mt-2 space-y-2">
                      {item.turns.map((turn) => (
                        <li
                          key={turn.id}
                          id={`audit-turn-${turn.id}`}
                          className="rounded-[var(--radius-md)] border-l-2 border-border bg-secondary/40 px-3 py-2"
                        >
                          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                            Turn {turn.turn_no} · {turn.role}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                            {turn.content}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : item.text ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{item.text}</p>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {item.text_note ?? "Lasso could not read this file's contents."}
                    </p>
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

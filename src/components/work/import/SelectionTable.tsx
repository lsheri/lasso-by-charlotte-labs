import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ParsedConversation } from "@/lib/import-parsers";

function dayOf(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

function rangeLabel(conv: ParsedConversation): string {
  const start = dayOf(conv.first_ts);
  const end = dayOf(conv.last_ts);
  if (!start) return "no timestamps";
  return start === end ? start : `${start} → ${end}`;
}

export function SelectionTable({
  conversations,
  selected,
  onChange,
}: {
  conversations: ParsedConversation[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return conversations;
    return conversations.filter((c) => c.title.toLowerCase().includes(needle));
  }, [conversations, search]);

  function setAll(ids: string[], on: boolean) {
    const next = new Set(selected);
    for (const id of ids) {
      if (on) next.add(id);
      else next.delete(id);
    }
    onChange(next);
  }

  function selectRange() {
    const ids = conversations
      .filter((c) => {
        const day = dayOf(c.first_ts);
        if (!day) return false;
        if (from && day < from) return false;
        if (to && day > to) return false;
        return true;
      })
      .map((c) => c.orig_id);
    setAll(ids, true);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-foreground">
        Choose what to bring into Lasso. Everything you leave unchecked stays on your computer. It
        is not uploaded, and Lasso never sees it.
      </p>

      <div className="rounded-[var(--radius)] border border-accent/40 bg-accent-soft p-4">
        <span className="micro-label">Select all from ___ to ___</span>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="range-from" className="micro-label">
              From
            </Label>
            <Input
              id="range-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-[150px] bg-card"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="range-to" className="micro-label">
              To
            </Label>
            <Input
              id="range-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-[150px] bg-card"
            />
          </div>
          <Button type="button" onClick={selectRange}>
            Select this range
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search titles (stays on your computer)"
          aria-label="Search titles"
          className="max-w-xs"
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() =>
              setAll(
                visible.map((c) => c.orig_id),
                true,
              )
            }
            className="text-xs font-medium text-accent-deep hover:opacity-70"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={() => onChange(new Set())}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Select none
          </button>
          <span
            data-testid="selection-counter"
            className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground"
          >
            {selected.size} of {conversations.length} selected
          </span>
        </div>
      </div>

      <div className="max-h-[45vh] overflow-y-auto rounded-[var(--radius)] border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-secondary">
            <tr className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              <th className="w-10 px-3 py-2" scope="col">
                <span className="sr-only">Include</span>
              </th>
              <th className="px-3 py-2" scope="col">
                Title
              </th>
              <th className="w-44 px-3 py-2" scope="col">
                Dates
              </th>
              <th className="w-24 px-3 py-2" scope="col">
                Messages
              </th>
              <th className="w-32 px-3 py-2" scope="col">
                Model
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((conv) => (
              <tr key={conv.orig_id} className="border-t border-border align-top">
                <td className="px-3 py-2">
                  <Checkbox
                    checked={selected.has(conv.orig_id)}
                    aria-label={`Include ${conv.title}`}
                    onCheckedChange={(value) => setAll([conv.orig_id], value === true)}
                  />
                </td>
                <td className="px-3 py-2">
                  <span className="text-foreground">{conv.title}</span>
                  {conv.warnings.map((warning) => (
                    <span
                      key={warning}
                      className="ml-2 inline-block rounded-full border border-border bg-secondary px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground"
                    >
                      {warning}
                    </span>
                  ))}
                </td>
                <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                  {rangeLabel(conv)}
                </td>
                <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                  {conv.turns.length}
                </td>
                <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                  {conv.models.join(", ") || "—"}
                </td>
              </tr>
            ))}
            {visible.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-sm text-muted-foreground">
                  No conversations match that search.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

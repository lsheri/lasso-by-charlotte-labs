import { useState } from "react";

import { LEDGER_COPY, ledgerRowLine, type LedgerFigureLine, type LedgerRow, type LedgerSourceLink } from "@/lib/proposal-ledger-shared";

/**
 * 19 Nov, proposal ledger: the figures of a "Value so far" line, each one a button that opens the ledger rows behind
 * it (date and kind, with a link to the draft or the Red pen run where the reader can open it). Shared by the board
 * line and the firm card so a number is traced the same way in both. Plain values in, no loading here.
 */
export function ProposalLedgerFigures({
  lines,
  rows,
  sources,
  onOpenSource,
}: {
  lines: readonly LedgerFigureLine[];
  rows: readonly LedgerRow[];
  sources?: Readonly<Record<string, LedgerSourceLink>> | undefined;
  onOpenSource?: ((link: LedgerSourceLink) => void) | undefined;
}) {
  const [open, setOpen] = useState<string | null>(null);
  if (!lines.length) return null;
  const byId = new Map(rows.map((row) => [row.id, row]));
  return (
    <ul data-ledger-figures className="flex flex-col gap-1">
      {lines.map((line) => {
        const behind = line.rowIds.map((id) => byId.get(id)).filter((row): row is LedgerRow => Boolean(row));
        const shown = open === line.key;
        return (
          <li key={line.key} data-ledger-figure={line.key}>
            <button
              type="button"
              aria-expanded={shown}
              title={LEDGER_COPY.trace}
              onClick={() => setOpen(shown ? null : line.key)}
              className="text-left text-(length:--type-small) text-foreground underline decoration-border underline-offset-2"
            >
              {line.text}
            </button>
            {shown ? (
              <ul data-ledger-trace={line.key} aria-label={LEDGER_COPY.trace} className="mt-1 flex flex-col gap-0.5 border-l-2 border-border pl-2">
                {behind.length === 0 ? <li className="text-(length:--type-small) text-muted-foreground">{LEDGER_COPY.noRows}</li> : null}
                {behind.map((row) => {
                  const link = sources?.[row.id];
                  return (
                    <li key={row.id} data-ledger-row={row.id} className="text-(length:--type-small) text-muted-foreground">
                      {ledgerRowLine(row)}
                      {link && onOpenSource ? (
                        <>
                          {" · "}
                          <button type="button" className="underline" onClick={() => onOpenSource(link)}>
                            {link.as === "draft" ? LEDGER_COPY.openDraft : LEDGER_COPY.openRedPen}
                          </button>
                        </>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

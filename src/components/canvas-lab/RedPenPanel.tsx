import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { firmDate } from "@/lib/firm-ask-shared";
import { RED_PEN_COPY, RED_PEN_ORDER, type RedPenClaim, type RedPenGrade, type RedPenResult } from "@/lib/red-pen-shared";
import { latestRedPen, runRedPenFn } from "@/lib/red-pen.functions";

const HINT: Record<RedPenGrade, string | null> = { unsupported: RED_PEN_COPY.unsupportedHint, weak: RED_PEN_COPY.weakHint, sourced: null };

function ClaimRow({ claim, onOpened }: { claim: RedPenClaim; onOpened: () => void }) {
  return (
    <li data-red-pen-claim={claim.grade} className="rounded-[var(--radius)] border border-border bg-background p-3">
      <p className="font-mono text-(length:--type-label) uppercase tracking-[0.06em] text-muted-foreground">
        {[claim.slide ? RED_PEN_COPY.slide(claim.slide) : null, RED_PEN_COPY[claim.grade]].filter(Boolean).join(" · ")}
      </p>
      <p className="mt-1 text-(length:--type-body) text-foreground">{claim.snippet}</p>
      {claim.quote && claim.sourceTitle ? (
        <details className="mt-1 text-(length:--type-small) text-muted-foreground" onToggle={(event) => (event.currentTarget.open ? onOpened() : undefined)}>
          <summary className="cursor-pointer">{claim.sourceTitle}</summary>
          <blockquote className="mt-1 border-l-2 border-border pl-2">{claim.quote}</blockquote>
          {claim.note ? <p className="mt-1">{claim.note}</p> : null}
        </details>
      ) : HINT[claim.grade] ? (
        <p className="mt-1 text-(length:--type-small) text-muted-foreground">{HINT[claim.grade]}</p>
      ) : null}
    </li>
  );
}

/**
 * 17 Nov, firm brain PR 6: the red pen for one deliverable, as a dialog (its own file, since nothing renders
 * CanvasLabPage in tests). Shows the last check if there is one, and runs a new one on request. Unsupported claims
 * first, then weak, then sourced.
 */
export function RedPenPanel({
  itemId,
  title,
  profileId,
  orgId,
  onClose,
}: {
  itemId: string | null;
  title: string;
  profileId: string | null | undefined;
  orgId: string | null | undefined;
  onClose: () => void;
}) {
  const latest = useServerFn(latestRedPen);
  const run = useServerFn(runRedPenFn);
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);
  const [failed, setFailed] = useState(false);
  const key = ["red-pen", itemId] as const;
  const query = useQuery({
    queryKey: key,
    enabled: Boolean(itemId),
    queryFn: () => latest({ data: { item_id: itemId!, profile_id: profileId ?? null } }),
  });
  const result: RedPenResult | null | undefined = query.data;

  async function check() {
    if (!itemId) return;
    setRunning(true);
    setFailed(false);
    try {
      queryClient.setQueryData(key, await run({ data: { item_id: itemId, profile_id: profileId ?? null } }));
    } catch {
      setFailed(true);
    } finally {
      setRunning(false);
    }
  }

  const note = (grade: RedPenGrade) => {
    if (orgId) void import("@/lib/telemetry").then(({ logEvent }) => logEvent("red_pen.claim_opened", orgId, { grade })).catch(() => {});
  };

  return (
    <Dialog open={Boolean(itemId)} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent data-testid="red-pen" className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{`${RED_PEN_COPY.title}: ${title}`}</DialogTitle>
          <DialogDescription>{RED_PEN_COPY.intro}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="ink" disabled={running || query.isLoading} onClick={() => void check()}>
            {running ? RED_PEN_COPY.running : result ? RED_PEN_COPY.rerun : RED_PEN_COPY.run}
          </Button>
          {result ? (
            <span data-red-pen-summary className="text-(length:--type-small) text-muted-foreground">
              {`${RED_PEN_COPY.summary(result.counts)} · ${RED_PEN_COPY.checked(firmDate(result.checkedAt))}`}
            </span>
          ) : null}
        </div>
        {failed || query.isError ? <p className="text-(length:--type-small) text-destructive">{RED_PEN_COPY.error}</p> : null}
        {result && !running ? (
          result.claims.length === 0 ? (
            <p className="text-(length:--type-body) text-foreground">{RED_PEN_COPY.none}</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {RED_PEN_ORDER.flatMap((grade) => result.claims.filter((claim) => claim.grade === grade)).map((claim, index) => (
                <ClaimRow key={`${claim.snippet}-${index}`} claim={claim} onOpened={() => note(claim.grade)} />
              ))}
            </ol>
          )
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FIRM_ASK_COPY, FIRM_TYPE_LABELS, firmDate } from "@/lib/firm-ask-shared";
import { keepOutOfFirmAnswers, previewFirmSource } from "@/lib/firm-ask.functions";
import { EXEMPLAR_COPY } from "@/lib/manager-tools-shared";

import { ExemplarBadge } from "./ExemplarBadge";

/**
 * A read-only preview of one source in a firm answer. The firm reader serves it, so nothing appears that the asker
 * could not read: summary-only items show their index card, and proposal fees are withheld except for admins and
 * leads. The item's author or the board's owner can keep it out of firm answers from here. Work marked as an exemplar
 * carries the mark, and admins and leads set or remove it here; it never says who marked it.
 */
export function FirmSourcePreview({
  itemId,
  profileId,
  onClose,
}: {
  itemId: string | null;
  profileId: string | null | undefined;
  onClose: () => void;
}) {
  const preview = useServerFn(previewFirmSource);
  const keepOut = useServerFn(keepOutOfFirmAnswers);
  const queryClient = useQueryClient();
  const [keptOut, setKeptOut] = useState(false);
  const [keeping, setKeeping] = useState(false);
  const [marking, setMarking] = useState(false);
  const markingNow = useRef(false);
  const [markProblem, setMarkProblem] = useState<string | null>(null);
  // The item on screen now, so an answer that returns after the preview closed or moved on says nothing.
  const shown = useRef(itemId);
  shown.current = itemId;
  const query = useQuery({
    queryKey: ["firm-source", itemId, profileId],
    enabled: Boolean(itemId),
    staleTime: 60_000,
    queryFn: () => preview({ data: { item_id: itemId!, profile_id: profileId ?? null } }),
  });
  const source = query.data;

  async function keep() {
    if (!itemId) return;
    setKeeping(true);
    try {
      await keepOut({ data: { item_id: itemId, profile_id: profileId ?? null } });
      setKeptOut(true);
      void queryClient.invalidateQueries({ queryKey: ["firm-source", itemId] });
    } finally {
      setKeeping(false);
    }
  }

  async function toggleExemplar(marked: boolean) {
    // One request at a time: a double click sends one.
    if (!itemId || markingNow.current) return;
    markingNow.current = true;
    setMarking(true);
    setMarkProblem(null);
    try {
      // Loaded on use: only admins and leads ever reach this.
      const { markExemplarFn, unmarkExemplarFn } = await import("@/lib/manager-tools.functions");
      const input = { data: { item_id: itemId, profile_id: profileId ?? null } };
      const result = marked ? await unmarkExemplarFn(input) : await markExemplarFn(input);
      if (result.ok) await queryClient.invalidateQueries({ queryKey: ["firm-source", itemId] });
      else if (shown.current === itemId) setMarkProblem(result.refusal);
    } catch {
      if (shown.current === itemId) setMarkProblem(EXEMPLAR_COPY.failed);
    } finally {
      markingNow.current = false;
      setMarking(false);
    }
  }

  return (
    <Dialog
      open={Boolean(itemId)}
      onOpenChange={(open) => {
        if (!open) {
          setKeptOut(false);
          setMarkProblem(null);
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{source?.title ?? FIRM_ASK_COPY.title}</DialogTitle>
          <DialogDescription>
            {source
              ? [source.boardTitle, FIRM_TYPE_LABELS[source.type] ?? source.type, source.date ? firmDate(source.date) : null, source.shownOn ? `${FIRM_ASK_COPY.shown}, ${firmDate(source.shownOn)}` : null]
                  .filter(Boolean)
                  .join(" · ")
              : FIRM_ASK_COPY.pending}
          </DialogDescription>
        </DialogHeader>
        {query.isError ? <p className="text-(length:--type-body) text-destructive">{FIRM_ASK_COPY.error}</p> : null}
        {source ? (
          <>
            {source.exemplar ? <ExemplarBadge className="self-start" /> : null}
            {source.grade === "summary" ? <p className="text-(length:--type-small) text-muted-foreground">{FIRM_ASK_COPY.previewSummary}</p> : null}
            <pre data-firm-preview-text className="whitespace-pre-wrap break-words font-sans text-(length:--type-body) leading-relaxed text-foreground">
              {source.text}
            </pre>
            {source.canMarkExemplar ? (
              <Button type="button" variant="outline" disabled={marking} data-exemplar-toggle onClick={() => void toggleExemplar(source.exemplar)}>
                {source.exemplar ? EXEMPLAR_COPY.unmark : EXEMPLAR_COPY.mark}
              </Button>
            ) : null}
            {markProblem ? (
              <p role="alert" className="text-(length:--type-small) text-destructive">
                {markProblem}
              </p>
            ) : null}
            {source.canKeepOut ? (
              keptOut ? (
                <p role="status" className="text-(length:--type-small) text-muted-foreground">{FIRM_ASK_COPY.keptOut}</p>
              ) : (
                <Button type="button" variant="outline" disabled={keeping} onClick={() => void keep()}>
                  {FIRM_ASK_COPY.keepOut}
                </Button>
              )
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

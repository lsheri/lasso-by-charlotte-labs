import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";

import { FirmSourcePreview } from "@/components/firm-brain/FirmSourcePreview";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { READING_LIST_COPY, type ReadingList, type ReadingPin, type ReadingWrite } from "@/lib/manager-tools-shared";
import { pinReadingThreadFn, readingListFn, unpinReadingThreadFn } from "@/lib/manager-tools.functions";

/**
 * 19 Nov, Firm Brain Build Spec step 8: a board's reading list (its own file, since nothing renders CanvasLabPage in
 * tests). Up to three engagements shared with the firm, pinned for the people on this board. Admins, leads and the
 * board's owner add and remove; everyone else on the board reads. Each entry opens the firm reader's own preview of
 * that engagement's source, so nothing opens that the reader could not already read. Never says who pinned.
 * Only the signed-in board renders it: never shared, demo, tour, firm or rollup surfaces.
 */
export function ReadingListDialog({
  engagementId,
  profileId,
  open,
  onClose,
}: {
  engagementId: string;
  profileId: string | null | undefined;
  open: boolean;
  onClose: () => void;
}) {
  const load = useServerFn(readingListFn);
  const pin = useServerFn(pinReadingThreadFn);
  const unpin = useServerFn(unpinReadingThreadFn);
  const [list, setList] = useState<ReadingList | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [choice, setChoice] = useState("");
  const [openItem, setOpenItem] = useState<string | null>(null);
  // Each opening gets a number. An answer from an earlier opening, or one that lands after closing, is dropped.
  const visit = useRef(0);
  const writing = useRef(false);

  useEffect(() => {
    visit.current += 1;
    writing.current = false;
    setList(null);
    setLoadFailed(false);
    setProblem(null);
    setBusy(false);
    setChoice("");
    setOpenItem(null);
    if (!open) return;
    const mine = visit.current;
    load({ data: { board_id: engagementId, profile_id: profileId ?? null } }).then(
      (next) => {
        if (visit.current === mine) setList(next);
      },
      () => {
        if (visit.current === mine) setLoadFailed(true);
      },
    );
  }, [open, engagementId, profileId, load]);

  async function write(run: () => Promise<ReadingWrite>) {
    // One write at a time: a double click sends one request.
    if (writing.current) return;
    writing.current = true;
    const mine = visit.current;
    setBusy(true);
    setProblem(null);
    try {
      const result = await run();
      if (visit.current !== mine) return;
      if (result.ok) {
        setList(result.list);
        setChoice("");
      } else {
        setProblem(result.refusal);
      }
    } catch {
      if (visit.current === mine) setProblem(READING_LIST_COPY.failed);
    } finally {
      if (visit.current === mine) {
        writing.current = false;
        setBusy(false);
      }
    }
  }

  const add = () => {
    if (!choice) return;
    void write(() => pin({ data: { board_id: engagementId, thread_id: choice, profile_id: profileId ?? null } }));
  };
  const remove = (entry: ReadingPin) =>
    void write(() => unpin({ data: { board_id: engagementId, thread_id: entry.threadId, profile_id: profileId ?? null } }));

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
        <DialogContent className="sm:max-w-md" data-testid="reading-list">
          <DialogHeader>
            <DialogTitle>{READING_LIST_COPY.title}</DialogTitle>
            <DialogDescription>{READING_LIST_COPY.helper}</DialogDescription>
          </DialogHeader>

          {loadFailed ? (
            <p role="alert" className="text-(length:--type-small) text-destructive">
              {READING_LIST_COPY.loadFailed}
            </p>
          ) : !list ? (
            <p role="status" className="text-(length:--type-small) text-muted-foreground">
              {READING_LIST_COPY.loading}
            </p>
          ) : (
            <>
              {list.pins.length === 0 ? (
                <p data-reading-empty className="text-(length:--type-small) text-muted-foreground">
                  {list.canPin ? READING_LIST_COPY.emptyCanPin : READING_LIST_COPY.empty}
                </p>
              ) : (
                <ol className="flex flex-col gap-2">
                  {list.pins.map((entry) => (
                    <li key={entry.threadId} data-reading-pin={entry.slot} className="flex items-start justify-between gap-3 rounded-[var(--radius)] border border-border bg-background p-3">
                      <div className="min-w-0">
                        <p className="truncate text-(length:--type-body) font-medium text-foreground">{entry.title}</p>
                        <p className="text-(length:--type-small) text-muted-foreground">{[entry.client, entry.situation].filter(Boolean).join(" · ")}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {entry.sourceItemId ? (
                          <Button type="button" size="sm" variant="outline" aria-label={READING_LIST_COPY.openLabel(entry.title)} onClick={() => setOpenItem(entry.sourceItemId)}>
                            {READING_LIST_COPY.open}
                          </Button>
                        ) : null}
                        {list.canPin ? (
                          <Button type="button" size="sm" variant="ghost" disabled={busy} aria-label={READING_LIST_COPY.removeLabel(entry.title)} onClick={() => remove(entry)}>
                            {READING_LIST_COPY.remove}
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              )}

              {list.canPin ? (
                list.full ? (
                  <p data-reading-full className="text-(length:--type-small) text-muted-foreground">
                    {READING_LIST_COPY.full}
                  </p>
                ) : list.choices.length === 0 ? (
                  <p className="text-(length:--type-small) text-muted-foreground">{READING_LIST_COPY.nothingToAdd}</p>
                ) : (
                  <form
                    className="flex items-end gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      add();
                    }}
                  >
                    <label className="block min-w-0 flex-1 space-y-1 text-sm">
                      <span>{READING_LIST_COPY.addLabel}</span>
                      <NativeSelect disabled={busy} value={choice} onChange={(event) => setChoice(event.target.value)}>
                        <option value="">{READING_LIST_COPY.choose}</option>
                        {list.choices.map((entry) => (
                          <option key={entry.threadId} value={entry.threadId}>
                            {entry.client ? `${entry.title} (${entry.client})` : entry.title}
                          </option>
                        ))}
                      </NativeSelect>
                    </label>
                    <Button type="submit" disabled={busy || !choice}>
                      {busy ? READING_LIST_COPY.adding : READING_LIST_COPY.add}
                    </Button>
                  </form>
                )
              ) : null}
            </>
          )}

          {problem ? (
            <p role="alert" className="text-(length:--type-small) text-destructive">
              {problem}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {READING_LIST_COPY.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <FirmSourcePreview itemId={open ? openItem : null} profileId={profileId} onClose={() => setOpenItem(null)} />
    </>
  );
}

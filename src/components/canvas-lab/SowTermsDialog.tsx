import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MAX_FEE_CHARS, MAX_WEEKS, SOW_TERMS_COPY, validateSowTerms } from "@/lib/sow-terms-shared";
import { readSowTermsFn, saveSowTermsFn, suggestSowTermsFn } from "@/lib/sow-terms.functions";

/**
 * 18 Nov, firm brain: a SOW's fee terms, set by an admin or lead (its own file, since nothing renders CanvasLabPage in
 * tests). "Read from the document" fills the fields only with words found in the SOW; nothing is stored until Save.
 */
export function SowTermsDialog({
  itemId,
  title,
  profileId,
  onClose,
}: {
  itemId: string | null;
  title: string;
  profileId: string | null | undefined;
  onClose: () => void;
}) {
  const read = useServerFn(readSowTermsFn);
  const suggest = useServerFn(suggestSowTermsFn);
  const save = useServerFn(saveSowTermsFn);
  const [feeText, setFeeText] = useState("");
  const [weeks, setWeeks] = useState("");
  const [hasTerms, setHasTerms] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState<"load" | "suggest" | "save" | null>(null);

  useEffect(() => {
    setFeeText("");
    setWeeks("");
    setHasTerms(false);
    setNote(null);
    setProblem(null);
    if (!itemId) return;
    let live = true;
    setBusy("load");
    read({ data: { item_id: itemId, profile_id: profileId ?? null } })
      .then((terms) => {
        if (!live || !terms) return;
        setFeeText(terms.fee_text);
        setWeeks(terms.weeks ? String(terms.weeks) : "");
        setHasTerms(true);
      })
      .catch(() => {})
      .finally(() => live && setBusy(null));
    return () => {
      live = false;
    };
  }, [itemId, profileId, read]);

  async function fill() {
    if (!itemId) return;
    setBusy("suggest");
    setProblem(null);
    try {
      const found = await suggest({ data: { item_id: itemId, profile_id: profileId ?? null } });
      if (!found.feeText && !found.weeks) {
        setNote(SOW_TERMS_COPY.nothingFound);
        return;
      }
      if (found.feeText) setFeeText(found.feeText);
      if (found.weeks) setWeeks(found.weeks);
      setNote(SOW_TERMS_COPY.suggested);
    } catch {
      setProblem(SOW_TERMS_COPY.suggestFailed);
    } finally {
      setBusy(null);
    }
  }

  async function commit(clear: boolean) {
    if (!itemId) return;
    if (!clear) {
      const invalid = validateSowTerms({ feeText, weeks });
      if (invalid) {
        setProblem(invalid);
        return;
      }
    }
    setBusy("save");
    setProblem(null);
    try {
      await save({ data: { item_id: itemId, profile_id: profileId ?? null, fee_text: feeText, weeks, clear } });
      onClose();
    } catch {
      setProblem(SOW_TERMS_COPY.failed);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={Boolean(itemId)} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="sm:max-w-md" data-testid="sow-terms" onClick={(event) => event.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{SOW_TERMS_COPY.title}</DialogTitle>
          <DialogDescription>{SOW_TERMS_COPY.helper}</DialogDescription>
        </DialogHeader>
        <p className="truncate text-(length:--type-small) text-muted-foreground">{title}</p>
        <form
          className="space-y-3"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void commit(false);
          }}
        >
          <label className="block space-y-1 text-sm">
            <span>{SOW_TERMS_COPY.feeLabel}</span>
            <Input value={feeText} disabled={busy === "load"} maxLength={MAX_FEE_CHARS} placeholder={SOW_TERMS_COPY.feePlaceholder} onChange={(event) => setFeeText(event.target.value)} />
          </label>
          <label className="block space-y-1 text-sm">
            <span>{SOW_TERMS_COPY.weeksLabel}</span>
            <Input type="number" inputMode="numeric" disabled={busy === "load"} min={1} max={MAX_WEEKS} value={weeks} onChange={(event) => setWeeks(event.target.value)} />
          </label>
          <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => void fill()}>
            {busy === "suggest" ? SOW_TERMS_COPY.suggesting : SOW_TERMS_COPY.suggest}
          </Button>
          {note ? (
            <p className="text-(length:--type-small) text-muted-foreground" data-sow-terms-note>
              {note}
            </p>
          ) : null}
          {problem ? (
            <p role="alert" className="text-(length:--type-small) text-destructive">
              {problem}
            </p>
          ) : null}
          <DialogFooter className="gap-2 sm:justify-between">
            {hasTerms ? (
              <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => void commit(true)}>
                {SOW_TERMS_COPY.clear}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                {SOW_TERMS_COPY.cancel}
              </Button>
              <Button type="submit" disabled={busy !== null}>
                {SOW_TERMS_COPY.save}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

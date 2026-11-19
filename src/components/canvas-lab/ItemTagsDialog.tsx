import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useBrandCopy } from "@/components/skin/use-skin";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import {
  METHOD_LABELS,
  METHODS,
  ROLE_LABELS,
  ROLES,
  SITUATION_LABELS,
  SITUATIONS,
  STAGE_LABELS,
  STAGES,
  type Method,
} from "@/lib/engagement-tags";
import { ITEM_TAGS_COPY, type ItemTagsView } from "@/lib/extract-tags-shared";
import { readItemTagsFn, saveItemTagsFn } from "@/lib/item-tags.functions";

type Draft = { method: Method[]; call_role: string; stage: string; situation: string };

const EMPTY: Draft = { method: [], call_role: "", stage: "", situation: "" };

function draftOf(view: ItemTagsView): Draft {
  return { method: view.method, call_role: view.call_role ?? "", stage: view.stage ?? "", situation: view.situation ?? "" };
}

/**
 * 18 Nov, firm brain step 5: the board lead or an admin corrects an item's tags (its own file, since nothing renders
 * CanvasLabPage in tests). Every choice comes from the fixed lists; the server checks who is asking and checks the
 * values again. Fields stay locked until the saved tags arrive, and a refused save keeps the dialog open.
 */
export function ItemTagsDialog({
  itemId,
  title,
  profileId,
  onClose,
  onSaved,
}: {
  itemId: string | null;
  title: string;
  profileId: string | null | undefined;
  onClose: () => void;
  onSaved?: ((tags: ItemTagsView) => void) | undefined;
}) {
  const read = useServerFn(readItemTagsFn);
  const save = useServerFn(saveItemTagsFn);
  // The copy is written as Lasso; the name follows the look.
  const copy = useBrandCopy();
  const [view, setView] = useState<ItemTagsView | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Which opening of the dialog a request belongs to: an answer for an earlier opening, or a closed dialog, is dropped.
  const opening = useRef(0);
  // Set before the first await, so a second click in the same tick cannot send a second save.
  const sending = useRef(false);

  useEffect(() => {
    opening.current += 1;
    const mine = opening.current;
    sending.current = false;
    setView(null);
    setDraft(EMPTY);
    setProblem(null);
    setBusy(false);
    if (!itemId) return;
    read({ data: { item_id: itemId, profile_id: profileId ?? null } }).then(
      (tags) => {
        if (opening.current !== mine) return;
        setView(tags);
        setDraft(draftOf(tags));
      },
      () => {
        if (opening.current === mine) setProblem(ITEM_TAGS_COPY.loadFailed);
      },
    );
  }, [itemId, profileId, read]);

  async function commit(clear: boolean) {
    if (!itemId || !view || sending.current) return;
    sending.current = true;
    const mine = opening.current;
    setBusy(true);
    setProblem(null);
    try {
      const saved = await save({
        data: {
          item_id: itemId,
          profile_id: profileId ?? null,
          method: draft.method,
          call_role: draft.call_role || null,
          stage: draft.stage || null,
          situation: draft.situation || null,
          clear,
        },
      });
      // Closed, or opened on another item, while the save was away: nothing here belongs to that answer any more.
      if (opening.current !== mine) return;
      onSaved?.(saved);
      onClose();
    } catch {
      if (opening.current === mine) setProblem(ITEM_TAGS_COPY.failed);
    } finally {
      if (opening.current === mine) {
        sending.current = false;
        setBusy(false);
      }
    }
  }

  const locked = !view || busy;
  const toggle = (method: Method, on: boolean) =>
    setDraft((current) => ({ ...current, method: METHODS.filter((entry) => (entry === method ? on : current.method.includes(entry))) }));

  return (
    <Dialog open={Boolean(itemId)} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="sm:max-w-lg" data-testid="item-tags" onClick={(event) => event.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{ITEM_TAGS_COPY.title}</DialogTitle>
          <DialogDescription>{copy(ITEM_TAGS_COPY.helper)}</DialogDescription>
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
          <fieldset className="space-y-2 text-sm" disabled={locked}>
            <legend className="mb-1">{ITEM_TAGS_COPY.methodLabel}</legend>
            <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
              {METHODS.map((method) => (
                <label key={method} className="flex items-center gap-2">
                  <Checkbox
                    checked={draft.method.includes(method)}
                    disabled={locked}
                    onCheckedChange={(checked) => toggle(method, checked === true)}
                    aria-label={METHOD_LABELS[method]}
                  />
                  <span>{METHOD_LABELS[method]}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {view?.fields.callRole ? (
            <label className="block space-y-1 text-sm">
              <span>{ITEM_TAGS_COPY.roleLabel}</span>
              <NativeSelect disabled={locked} value={draft.call_role} onChange={(event) => setDraft({ ...draft, call_role: event.target.value })}>
                <option value="">{ITEM_TAGS_COPY.none}</option>
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </NativeSelect>
            </label>
          ) : null}
          {view?.fields.stage ? (
            <label className="block space-y-1 text-sm">
              <span>{ITEM_TAGS_COPY.stageLabel}</span>
              <NativeSelect disabled={locked} value={draft.stage} onChange={(event) => setDraft({ ...draft, stage: event.target.value })}>
                <option value="">{ITEM_TAGS_COPY.none}</option>
                {STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {STAGE_LABELS[stage]}
                  </option>
                ))}
              </NativeSelect>
            </label>
          ) : null}
          {view?.fields.situation ? (
            <label className="block space-y-1 text-sm">
              <span>{ITEM_TAGS_COPY.situationLabel}</span>
              <NativeSelect disabled={locked} value={draft.situation} onChange={(event) => setDraft({ ...draft, situation: event.target.value })}>
                <option value="">{ITEM_TAGS_COPY.none}</option>
                {SITUATIONS.map((situation) => (
                  <option key={situation} value={situation}>
                    {SITUATION_LABELS[situation]}
                  </option>
                ))}
              </NativeSelect>
            </label>
          ) : null}
          {!view && !problem && itemId ? <p className="text-(length:--type-small) text-muted-foreground">{ITEM_TAGS_COPY.loading}</p> : null}
          {view?.corrected ? (
            <p className="text-(length:--type-small) text-muted-foreground" data-item-tags-note>
              {ITEM_TAGS_COPY.correctedNote}
            </p>
          ) : null}
          {problem ? (
            <p role="alert" className="text-(length:--type-small) text-destructive">
              {problem}
            </p>
          ) : null}
          <DialogFooter className="gap-2 sm:justify-between">
            {view?.corrected ? (
              <Button type="button" variant="ghost" disabled={locked} onClick={() => void commit(true)}>
                {copy(ITEM_TAGS_COPY.reset)}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                {ITEM_TAGS_COPY.cancel}
              </Button>
              <Button type="submit" disabled={locked}>
                {ITEM_TAGS_COPY.save}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

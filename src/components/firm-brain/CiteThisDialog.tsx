import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { useWorkItems } from "@/hooks/use-work-items";
import { CITE_COPY, CITE_TARGETS_MAX } from "@/lib/firm-cite-shared";
import { citeFirmLine } from "@/lib/firm-cite.functions";
import { displayName } from "@/lib/work-item-name";

export type CiteTarget = { id: string; title: string };

/** The plain line for a refused or failed cite, from what the server said. */
function failureLine(error: unknown): string {
  if (error instanceof Response) {
    if (error.status === 403) return CITE_COPY.refused;
    if (error.status === 404) return CITE_COPY.gone;
    if (error.status === 422) return CITE_COPY.notFound;
    if (error.status === 409) return CITE_COPY.full;
  }
  return CITE_COPY.error;
}

/**
 * The dialog behind "Cite this": the line, a choice of the person's own items, and Add. Plain values in, so it is
 * rendered in tests without a database. The server finds the words in the source again and checks the item is the
 * caller's; a refusal or a failure keeps the dialog open with a plain line. A reply that arrives after the dialog was
 * closed changes nothing on screen.
 */
export function CiteThisDialog({
  open,
  onOpenChange,
  quote,
  sourceItemId,
  profileId,
  targets,
  targetsLoading,
  targetsFailed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: string;
  sourceItemId: string;
  profileId: string | null | undefined;
  targets: CiteTarget[];
  targetsLoading: boolean;
  targetsFailed: boolean;
}) {
  const cite = useServerFn(citeFirmLine);
  const queryClient = useQueryClient();
  const [targetId, setTargetId] = useState("");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const busy = useRef(false);
  /** Bumped on every close, so a reply for an earlier opening is ignored. */
  const visit = useRef(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  function close(next: boolean) {
    if (!next) {
      visit.current += 1;
      setFailure(null);
      setDone(false);
      setPending(false);
      setTargetId("");
    }
    onOpenChange(next);
  }

  async function add() {
    // The ref, not the state, stops a double press: two clicks in one tick both see the old state.
    if (busy.current || !targetId) return;
    busy.current = true;
    const mine = visit.current;
    setPending(true);
    setFailure(null);
    try {
      await cite({
        data: {
          target_item_id: targetId,
          source_item_id: sourceItemId,
          quote,
          profile_id: profileId ?? null,
        },
      });
      void queryClient.invalidateQueries({ queryKey: ["firm-citations", targetId] });
      void queryClient.invalidateQueries({ queryKey: ["work-items"] });
      if (alive.current && mine === visit.current) setDone(true);
    } catch (error) {
      if (alive.current && mine === visit.current) setFailure(failureLine(error));
    } finally {
      busy.current = false;
      if (alive.current && mine === visit.current) setPending(false);
    }
  }

  // Lock the choice until the person's items have arrived, so a late load never changes what they picked.
  const locked = targetsLoading || pending || done;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-lg" data-testid="cite-this-dialog">
        <DialogHeader>
          <DialogTitle>{CITE_COPY.title}</DialogTitle>
          <DialogDescription>{CITE_COPY.hint}</DialogDescription>
        </DialogHeader>
        <blockquote
          data-cite-quote
          className="border-l-2 border-border pl-3 text-(length:--type-small) text-muted-foreground"
        >
          {quote}
        </blockquote>
        {targetsFailed ? (
          <p role="alert" className="text-(length:--type-small) text-destructive">
            {CITE_COPY.targetsError}
          </p>
        ) : !targetsLoading && !targets.length ? (
          <p className="text-(length:--type-small) text-muted-foreground">{CITE_COPY.noTargets}</p>
        ) : (
          <label className="flex flex-col gap-1 text-(length:--type-small) text-muted-foreground">
            {CITE_COPY.targetLabel}
            <NativeSelect
              data-testid="cite-this-target"
              value={targetId}
              disabled={locked}
              onChange={(event) => {
                setTargetId(event.target.value);
                setFailure(null);
              }}
            >
              <option value="">{CITE_COPY.pickTarget}</option>
              {targets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.title}
                </option>
              ))}
            </NativeSelect>
          </label>
        )}
        {failure ? (
          <p role="alert" className="text-(length:--type-small) text-destructive">
            {failure}
          </p>
        ) : null}
        {done ? (
          <p role="status" className="text-(length:--type-small) text-foreground">
            {CITE_COPY.done}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => close(false)}>
            {done ? CITE_COPY.close : CITE_COPY.cancel}
          </Button>
          {done ? null : (
            <Button
              type="button"
              variant="ink"
              data-testid="cite-this-submit"
              disabled={locked || !targetId}
              onClick={() => void add()}
            >
              {CITE_COPY.submit}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Loads the person's own recent items only once the dialog is open, then hands plain values to the dialog. */
export function CiteThisLoaded(props: {
  quote: string;
  sourceItemId: string;
  profileId: string | null | undefined;
  onClose: () => void;
}) {
  const work = useWorkItems();
  const targets: CiteTarget[] = (work.data?.items ?? [])
    .filter((item) => Boolean(props.profileId) && item.owner_id === props.profileId)
    .slice(0, CITE_TARGETS_MAX)
    .map((item) => ({ id: item.id, title: displayName(item) || "Untitled" }));
  return (
    <CiteThisDialog
      open
      onOpenChange={(next) => {
        if (!next) props.onClose();
      }}
      quote={props.quote}
      sourceItemId={props.sourceItemId}
      profileId={props.profileId}
      targets={targets}
      targetsLoading={work.isLoading}
      targetsFailed={work.isError}
    />
  );
}

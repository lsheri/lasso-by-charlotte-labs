import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { METHOD_LABELS, type Method } from "@/lib/engagement-tags";
import { canAskTheFirm } from "@/lib/firm-ask-shared";
import { setWalkOffer } from "@/lib/firm-cite.functions";
import { getFirmJuniorTags } from "@/lib/firm-junior.functions";
import { WALK_OFFER_COPY, walkOfferFor } from "@/lib/walk-offer-shared";

import { FirmWalkthrough } from "./FirmWalkthrough";

type OfferProfile = {
  id?: string | null;
  role?: string | null;
  has_firm_view?: boolean | null;
  org_type?: string | null;
};

type OfferItem = {
  id: string;
  type: string;
  title?: string | null | undefined;
  display_title?: string | null | undefined;
  owner_id?: string | null | undefined;
  meta?: unknown;
};

/**
 * The once-only offer in the signed-in item reader: a call the person owns, titled like an interview, offers the
 * firm's walk-through for that kind of call. It shows only to the owner, and only when the
 * firm has shared work on that method (so the line is true). "Read it" opens the walk-through in a dialog; "Not now"
 * dismisses it. Either way the choice is saved on the person's own item, so it never shows again on any device. The
 * title is read here in the browser to pick a method from the fixed list and is sent nowhere.
 */
export function WalkOffer({
  item,
  profile,
}: {
  item: OfferItem;
  profile: OfferProfile | null | undefined;
}) {
  const loadTags = useServerFn(getFirmJuniorTags);
  const save = useServerFn(setWalkOffer);
  const queryClient = useQueryClient();
  /** Set once the person has opened or dismissed it here, before the saved item has been read again. */
  const [settled, setSettled] = useState(false);
  /** The method being read. Kept here because the saved item stops offering one the moment it is marked opened. */
  const [reading, setReading] = useState<Method | null>(null);
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const method = canAskTheFirm(profile) ? walkOfferFor(item, profile) : null;
  const tags = useQuery({
    queryKey: ["firm-junior-tags", profile?.id ?? null],
    enabled: Boolean(method) && !settled,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: () => loadTags({ data: { profile_id: profile?.id ?? null } }),
  });
  const firmHasIt = Boolean(method && tags.data?.methods.some((row) => row.tag === method));

  async function settle(state: "opened" | "dismissed") {
    // The ref, not the state, stops a double press.
    if (busy.current || !method) return;
    busy.current = true;
    setFailed(false);
    if (state === "opened") setReading(method);
    try {
      await save({ data: { item_id: item.id, state, profile_id: profile?.id ?? null } });
      if (alive.current) setSettled(true);
      void queryClient.invalidateQueries({ queryKey: ["work-items"] });
    } catch {
      // The walk-through still opens; the offer stays so the person can dismiss it once saving works.
      if (alive.current) setFailed(true);
    } finally {
      busy.current = false;
    }
  }

  const offer = firmHasIt && !settled;
  if (!offer && !reading) return null;

  return (
    <>
      {offer ? (
        <div
          data-testid="walk-offer"
          className="mt-3 flex flex-wrap items-center gap-2 rounded-[var(--radius)] border border-border bg-accent-soft px-3 py-2"
        >
          <p className="min-w-0 flex-1 text-(length:--type-small) text-foreground">{WALK_OFFER_COPY.line}</p>
          <Button type="button" variant="outline" size="sm" data-walk-offer-read onClick={() => void settle("opened")}>
            {WALK_OFFER_COPY.read}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-walk-offer-dismiss
            aria-label={WALK_OFFER_COPY.dismissLabel}
            onClick={() => void settle("dismissed")}
          >
            {WALK_OFFER_COPY.dismiss}
          </Button>
          {failed ? (
            <p role="alert" className="w-full text-(length:--type-small) text-destructive">
              {WALK_OFFER_COPY.error}
            </p>
          ) : null}
        </div>
      ) : null}
      <Dialog
        open={reading !== null}
        onOpenChange={(open) => {
          if (!open) setReading(null);
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{reading ? WALK_OFFER_COPY.dialogTitle(METHOD_LABELS[reading]) : null}</DialogTitle>
            <DialogDescription>{WALK_OFFER_COPY.dialogHint}</DialogDescription>
          </DialogHeader>
          {reading ? (
            <FirmWalkthrough tag={{ kind: "method", tag: reading }} profileId={profile?.id} autoOpen />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

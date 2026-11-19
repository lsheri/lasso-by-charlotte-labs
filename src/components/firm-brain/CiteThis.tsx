import { lazy, Suspense, useState } from "react";

import { Button } from "@/components/ui/button";
import { CITE_COPY } from "@/lib/firm-cite-shared";

/** The dialog, its server call and the read of the person's items arrive only when the button is pressed. */
const CiteThisLoaded = lazy(() =>
  import("./CiteThisDialog").then((module) => ({ default: module.CiteThisLoaded })),
);

/**
 * "Cite this" under a quote from the firm's past work: a walk-through quote, an Ask the firm citation or a Prepare me
 * line. Adds the line, with a reference to its source, to an item the person owns. It renders nothing without a
 * profile, and it loads nothing until it is pressed.
 */
export function CiteThis({
  quote,
  sourceItemId,
  profileId,
}: {
  quote: string;
  sourceItemId: string;
  profileId: string | null | undefined;
}) {
  const [open, setOpen] = useState(false);
  if (!profileId) return null;
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        data-cite-this
        className="self-start"
        onClick={() => setOpen(true)}
      >
        {CITE_COPY.action}
      </Button>
      {open ? (
        <Suspense fallback={null}>
          <CiteThisLoaded
            quote={quote}
            sourceItemId={sourceItemId}
            profileId={profileId}
            onClose={() => setOpen(false)}
          />
        </Suspense>
      ) : null}
    </>
  );
}

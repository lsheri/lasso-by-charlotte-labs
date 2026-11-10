import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { draftLineage, getDeliverableEvidence, reviewLink } from "@/lib/lineage.functions";

export const TRAIL_SOURCES_COPY = {
  heading: "Possible sources",
  find: "Find possible sources",
  finding: "Reading the other work filed here",
  // The drafter reads the work filed with this board's engagement (lineage.server.ts), not only what is drawn on it.
  fine: "Lasso reads the other work filed here and suggests only what shares wording or names it. Nothing joins the trail until you link it.",
  none: "Nothing else filed here shares wording with this piece.",
  link: "Link it",
  dismiss: "Not this",
  failed: "That did not work. Try again in a moment.",
} as const;

/**
 * T4 (Trail): suggestions, never claims. "Find possible sources" runs the existing evidence-only drafter
 * (draftLineage: shared wording or a named artefact, never topic or timing), and each draft waits here with
 * its one-line reason until the owner links it (it joins the trail as confirmed) or says Not this (it is
 * kept as discarded and not suggested again). Owner only, and deliverables only, because the drafter is.
 */
export function TrailSources({
  workItemId,
  profileId,
  onChanged,
}: {
  workItemId: string;
  profileId: string | null;
  onChanged: () => void;
}) {
  const load = useServerFn(getDeliverableEvidence);
  const draft = useServerFn(draftLineage);
  const review = useServerFn(reviewLink);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<"finding" | string | null>(null);
  const [searched, setSearched] = useState(false);
  const [failed, setFailed] = useState(false);
  const key = ["trail-sources", workItemId, profileId];
  const { data } = useQuery({
    queryKey: key,
    enabled: Boolean(profileId),
    queryFn: () => load({ data: { work_item_id: workItemId, profile_id: profileId ?? undefined } }),
  });
  const drafts = (data?.links ?? []).filter((link) => link.status === "draft");

  async function find() {
    if (busy) return;
    setBusy("finding");
    setFailed(false);
    try {
      await draft({ data: { work_item_id: workItemId, profile_id: profileId ?? undefined } });
      await queryClient.invalidateQueries({ queryKey: key });
      setSearched(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  }

  async function decide(linkId: string, action: "confirmed" | "discarded") {
    if (busy) return;
    setBusy(linkId);
    setFailed(false);
    try {
      await review({ data: { link_id: linkId, action, profile_id: profileId ?? undefined, surface: "trail" } });
      await queryClient.invalidateQueries({ queryKey: key });
      if (action === "confirmed") onChanged();
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="lift-trail-section lift-trail-sources" data-testid="trail-sources">
      {drafts.length > 0 ? (
        <>
          <h3 className="lift-trail-heading">{TRAIL_SOURCES_COPY.heading}</h3>
          <ul className="lift-trail-list">
            {drafts.map((link) => (
              <li key={link.id} className="lift-trail-suggestion" data-testid="trail-suggestion">
                <span className="lift-trail-title">{link.item.title}</span>
                {link.rationale ? <span className="lift-trail-how">{link.rationale}</span> : null}
                <span className="lift-trail-actions">
                  <button type="button" className="lift-trail-accept" disabled={busy !== null} onClick={() => void decide(link.id, "confirmed")}>
                    {TRAIL_SOURCES_COPY.link}
                  </button>
                  <button type="button" className="lift-trail-dismiss" disabled={busy !== null} onClick={() => void decide(link.id, "discarded")}>
                    {TRAIL_SOURCES_COPY.dismiss}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <button type="button" className="lift-trail-find" disabled={busy !== null} onClick={() => void find()}>
            {busy === "finding" ? TRAIL_SOURCES_COPY.finding : TRAIL_SOURCES_COPY.find}
          </button>
          {searched && busy === null ? <p className="lift-trail-empty">{TRAIL_SOURCES_COPY.none}</p> : <p className="lift-trail-rule">{TRAIL_SOURCES_COPY.fine}</p>}
        </>
      )}
      {failed ? <p className="lift-trail-empty" role="status">{TRAIL_SOURCES_COPY.failed}</p> : null}
    </section>
  );
}

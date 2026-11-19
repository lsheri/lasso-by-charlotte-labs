import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useFeatureFlag } from "@/hooks/use-feature-flag";
import { canAskTheFirm, FIRM_TYPE_LABELS, firmDate } from "@/lib/firm-ask-shared";
import { citationsOf, CITE_COPY } from "@/lib/firm-cite-shared";
import { getFirmCitations, removeFirmCitation } from "@/lib/firm-cite.functions";

import { FirmSourcePreview } from "./FirmSourcePreview";

type ReaderProfile = {
  id?: string | null;
  role?: string | null;
  has_firm_view?: boolean | null;
  org_type?: string | null;
};

/**
 * The lines an item's owner cited from the firm's past work, under the item in the signed-in reader. Only the owner
 * sees them, and the server checks that again. Every line is checked against the firm reader each time the reader
 * opens: while its source is shared it shows its words and a link that opens the same read-only preview as an Ask the
 * firm citation; once the source's board is no longer shared it shows only "A cited source is no longer shared", with
 * no words and no link. Nothing is asked for an item with no cited lines.
 */
export function ItemCitations({
  item,
  profile,
}: {
  item: { id: string; owner_id?: string | null | undefined; meta?: unknown };
  profile: ReaderProfile | null | undefined;
}) {
  const flagOn = useFeatureFlag("company-brain");
  const load = useServerFn(getFirmCitations);
  const remove = useServerFn(removeFirmCitation);
  const queryClient = useQueryClient();
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [removeFailed, setRemoveFailed] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const busy = useRef(false);

  const owner = Boolean(profile?.id) && item.owner_id === profile?.id;
  const stored = citationsOf(item.meta).length;
  const show = owner && canAskTheFirm(flagOn, profile) && stored > 0;
  const query = useQuery({
    queryKey: ["firm-citations", item.id, profile?.id ?? null, stored],
    enabled: show,
    // Checked against sharing every time the reader opens.
    staleTime: 0,
    gcTime: 0,
    retry: false,
    queryFn: () => load({ data: { item_id: item.id, profile_id: profile?.id ?? null } }),
  });

  if (!show) return null;
  // A guest or someone outside a company workspace: the server says no, so the section goes away.
  if (query.error instanceof Response && query.error.status === 403) return null;
  const lines = query.data ?? [];
  if (query.isSuccess && !lines.length) return null;

  async function take(citationId: string) {
    if (busy.current) return;
    busy.current = true;
    setRemoving(citationId);
    setRemoveFailed(false);
    try {
      await remove({ data: { item_id: item.id, citation_id: citationId, profile_id: profile?.id ?? null } });
      await queryClient.invalidateQueries({ queryKey: ["firm-citations", item.id] });
      void queryClient.invalidateQueries({ queryKey: ["work-items"] });
    } catch {
      setRemoveFailed(true);
    } finally {
      busy.current = false;
      setRemoving(null);
    }
  }

  return (
    <section data-testid="item-citations" aria-labelledby={`item-citations-${item.id}`} className="mt-6 flex flex-col gap-3 border-t border-border pt-4">
      <div>
        <h3 id={`item-citations-${item.id}`} className="font-mono text-(length:--type-label) uppercase tracking-wider text-muted-foreground">
          {CITE_COPY.listTitle}
        </h3>
        <p className="text-(length:--type-small) text-muted-foreground">{CITE_COPY.ownerOnly}</p>
      </div>
      {query.isError ? (
        <p role="alert" className="text-(length:--type-small) text-destructive">
          {CITE_COPY.loadError}
        </p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {lines.map((line) => (
          <li key={line.id} data-cited-line={line.state} className="flex flex-col gap-1">
            {line.state === "live" ? (
              <>
                <blockquote className="border-l-2 border-border pl-3 text-(length:--type-body) text-foreground">
                  {line.quote}
                </blockquote>
                <p className="text-(length:--type-small) text-muted-foreground">
                  {[line.engagement, FIRM_TYPE_LABELS[line.type] ?? line.type, firmDate(line.date)].join(" · ")}
                </p>
              </>
            ) : (
              <p className="text-(length:--type-body) text-muted-foreground">{CITE_COPY.unshared}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {line.state === "live" ? (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  data-cited-open={line.sourceItemId}
                  className="px-0"
                  onClick={() => setOpenItem(line.sourceItemId)}
                >
                  {CITE_COPY.open}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                data-cited-remove={line.id}
                aria-label={CITE_COPY.removeLabel}
                disabled={removing !== null}
                onClick={() => void take(line.id)}
              >
                {CITE_COPY.remove}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {removeFailed ? (
        <p role="alert" className="text-(length:--type-small) text-destructive">
          {CITE_COPY.removeError}
        </p>
      ) : null}
      <FirmSourcePreview itemId={openItem} profileId={profile?.id} onClose={() => setOpenItem(null)} />
    </section>
  );
}

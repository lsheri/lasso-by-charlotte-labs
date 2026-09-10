import { useCallback, useEffect, useState } from "react";

import { useNavigate } from "@tanstack/react-router";

import { ArchiveChat } from "@/components/archive/ArchiveChat";
import { ArchiveSpine, type ArchiveSpineGroup } from "@/components/archive/ArchiveSpine";
import { PastWorkSearch } from "@/components/archive/PastWorkSearch";
import { PageHeader } from "@/components/layout/PageHeader";
import { ToneCard } from "@/components/notebook/ToneCard";
import { useProfile } from "@/hooks/use-profile";
import { useShippedWork } from "@/hooks/use-shipped-work";
import { ARCHIVE_SUBHEAD } from "@/lib/archive-search-shared";
import { PAST_WORK_GROUP_LABEL } from "@/lib/past-work-shared";

/**
 * The learning archive. Members and admins can read it: shipped work, the
 * pile, and one question box over the whole of it. Coaches are engagement-
 * scoped guests, so they are redirected to their coaching view. No counts per
 * person, ever.
 */
export function ArchivePage() {
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const { data, isLoading } = useShippedWork();
  const [searching, setSearching] = useState(false);

  // Coaches are engagement-scoped guests; the firm archive is firm-internal.
  const isCoach = profile?.role === "coach";
  useEffect(() => {
    if (isCoach) navigate({ to: "/coaching" });
  }, [isCoach, navigate]);

  const onResultsChange = useCallback((open: boolean) => setSearching(open), []);

  if (!profile || isCoach) return null;

  // Ship date is the only order the archive keeps.
  const cards = [...(data ?? [])].sort((a, b) => b.shipped_at.localeCompare(a.shipped_at));
  const groups = cards.reduce<ArchiveSpineGroup[]>((all, card) => {
    const key = card.engagement_id ?? "without-engagement";
    const existing = all.find((group) => group.key === key);
    if (existing) existing.cards.push(card);
    else all.push({ key, cards: [card] });
    return all;
  }, []);

  return (
    <div data-testid="archive-page">
      <p className="micro-label">{PAST_WORK_GROUP_LABEL}</p>
      <div className="mt-1">
        <PageHeader title="Past work" italicWord="work" subtitle={ARCHIVE_SUBHEAD} />
      </div>

      <div className="mt-5">
        <PastWorkSearch />
      </div>

      <div className="mt-5">
        {isCoach ? null : <ArchiveChat cards={cards} onResultsChange={onResultsChange} />}
      </div>

      <div className="mt-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Reading shipped work.</p>
        ) : (
          <ArchiveSpine groups={groups} hidden={searching} />
        )}
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <ToneCard tone="record" label="WHAT STAYS WHEN AN ENGAGEMENT CLOSES">
          <p>
            The artifacts, the record of how each was made, every check and who ran it, and the
            reusable processes.
          </p>
        </ToneCard>
        <ToneCard tone="paper" label="WHAT CHANGES">
          <p>
            Read only from here. Coaches keep exactly the access they already had. Closing gives
            nobody new access.
          </p>
        </ToneCard>
      </div>

      <p className="mt-5 font-hand text-[16px] text-green">closed, not gone</p>
    </div>
  );
}

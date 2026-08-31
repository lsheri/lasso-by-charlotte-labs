import { useCallback, useEffect, useState } from "react";

import { useNavigate } from "@tanstack/react-router";

import { ArchiveChat } from "@/components/archive/ArchiveChat";
import { PastWorkSearch } from "@/components/archive/PastWorkSearch";
import { ArchivePile } from "@/components/archive/ArchivePile";
import { useProfile } from "@/hooks/use-profile";
import { useShippedWork } from "@/hooks/use-shipped-work";
import { ARCHIVE_SUBHEAD } from "@/lib/archive-search-shared";
import { PAST_WORK_GROUP_LABEL, PAST_WORK_NAV_LABEL } from "@/lib/past-work-shared";

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

  return (
    <div data-testid="archive-page">
      <header className="mb-8">
        <p className="micro-label">{PAST_WORK_GROUP_LABEL}</p>
        <h1 className="page-title mt-1">{PAST_WORK_NAV_LABEL}</h1>
        <p className="mt-1.5 max-w-[60ch] text-sm text-muted-foreground">{ARCHIVE_SUBHEAD}</p>
      </header>

      <div className="mt-5">
        <PastWorkSearch />
      </div>

      <div className="mt-5">
        {isCoach ? null : <ArchiveChat cards={cards} onResultsChange={onResultsChange} />}
      </div>

      <div className="mt-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Reading the archive.</p>
        ) : (
          <ArchivePile cards={cards} hidden={searching} />
        )}
      </div>
    </div>
  );
}

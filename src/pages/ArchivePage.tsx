import { useCallback, useState } from "react";

import { ArchiveChat } from "@/components/archive/ArchiveChat";
import { PastWorkSearch } from "@/components/archive/PastWorkSearch";
import { ArchivePile } from "@/components/archive/ArchivePile";
import { GraphiteRule } from "@/components/notebook/marks";
import { useProfile } from "@/hooks/use-profile";
import { useShippedWork } from "@/hooks/use-shipped-work";
import { ARCHIVE_SUBHEAD, ARCHIVE_TITLE } from "@/lib/archive-search-shared";

/**
 * The learning archive. Every member can read it: shipped work, the pile, and
 * one question box over the whole of it. No counts per person, ever.
 */
export function ArchivePage() {
  const { data: profile } = useProfile();
  const { data, isLoading } = useShippedWork();
  const [searching, setSearching] = useState(false);

  // Pass 138: shipped work is consented by construction, so every role may
  // read it. The older archive question box stays members only.
  const isCoach = profile?.role === "coach";

  const onResultsChange = useCallback((open: boolean) => setSearching(open), []);

  if (!profile) return null;

  // Ship date is the only order the archive keeps.
  const cards = [...(data ?? [])].sort((a, b) => b.shipped_at.localeCompare(a.shipped_at));

  return (
    <div data-testid="archive-page">
      <h1 className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
        {ARCHIVE_TITLE}
      </h1>
      <div className="nb-rule-draw">
        <GraphiteRule className="mt-1 h-[6px] w-full text-muted-foreground" />
      </div>
      <p className="mt-2 max-w-[60ch] text-sm text-muted-foreground">{ARCHIVE_SUBHEAD}</p>

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

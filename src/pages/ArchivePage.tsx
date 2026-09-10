import { useCallback, useEffect, useState } from "react";

import { useNavigate } from "@tanstack/react-router";

import { ArchiveChat } from "@/components/archive/ArchiveChat";
import { ArchiveSpine, type ArchiveSpineGroup } from "@/components/archive/ArchiveSpine";
import { PastWorkSearch } from "@/components/archive/PastWorkSearch";
import { PageHeader } from "@/components/layout/PageHeader";
import { ToneCard } from "@/components/notebook/ToneCard";
import { useProfile } from "@/hooks/use-profile";
import { useShippedWork } from "@/hooks/use-shipped-work";

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

  // Figma 29:833 subtitle: "Three closed engagements · 41 pieces of work ·
  // nothing here is deleted". Every clause here is counted off the cards this
  // page already holds.
  const subtitle = [
    `${groups.length} closed engagement${groups.length === 1 ? "" : "s"}`,
    `${cards.length} piece${cards.length === 1 ? "" : "s"} of work`,
    "nothing here is deleted",
  ].join(" · ");

  return (
    <div data-testid="archive-page">
      {/* Figma 29:833 leads with the title itself. The group stamp that used to
          sit above it is the sidebar's word for this page, and saying it twice
          on the same screen is noise. */}
      <PageHeader title="Past" italicWord="work" subtitle={subtitle} />

      {/*
        The frame runs the spine down the left at about two thirds and stacks
        the standing notes beside it. Below `lg` they go back to one column, so
        the notes follow the work rather than crowding it.
      */}
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <PastWorkSearch />

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

          {/* The frame foots the spine with this, not the page. */}
          <p className="mt-6 font-hand text-[16px] text-green">closed, not gone</p>
        </div>

        <aside className="space-y-4">
          <ToneCard tone="record" label="WHAT STAYS WHEN AN ENGAGEMENT CLOSES">
            {/* The frame ticks these off one by one. It is the same promise the
                paragraph made, said so you can check it item by item. */}
            <ul className="mt-1 space-y-1.5">
              {[
                "The artifacts, exactly as they were",
                "The record of how each one was made",
                "Every check, and who ran it",
                "The processes other people now reuse",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <span aria-hidden className="mt-[2px] shrink-0 text-green">
                    ✓
                  </span>
                  <span className="text-foreground">{line}</span>
                </li>
              ))}
            </ul>
          </ToneCard>

          <ToneCard tone="paper" label="WHAT CHANGES">
            <p className="leading-[19px] text-foreground">
              The engagement becomes read-only. Nobody can add to it, including you.
            </p>
            <p className="mt-2 leading-[19px]">
              Coaches keep exactly the access they already had. Closing gives nobody new access.
            </p>
          </ToneCard>

          {/*
            Figma 29:833's third note is "TAKE IT WITH YOU", offering to export a
            closed engagement as a folder of artifacts plus one receipt per piece
            of work. Nothing in the app exports an engagement, so the card says
            what is true today rather than offering a control that does nothing.
          */}
          <ToneCard tone="paper" label="TAKE IT WITH YOU">
            <p className="leading-[19px]">
              Every piece here opens to the process behind it, and each one can be taken back by
              the person who shipped it. Exporting a whole closed engagement as one folder is not
              built yet.
            </p>
          </ToneCard>
        </aside>
      </div>
    </div>
  );
}

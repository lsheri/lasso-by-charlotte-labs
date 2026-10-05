import { useCallback, useEffect, useState } from "react";

import { useNavigate } from "@tanstack/react-router";

import { ArchiveChat } from "@/components/archive/ArchiveChat";
import { ArchivedSection } from "@/components/archive/ArchivedSection";
import { ArchiveSpine, type ArchiveSpineGroup } from "@/components/archive/ArchiveSpine";
import { PastWorkSearch } from "@/components/archive/PastWorkSearch";
import { PageHeader } from "@/components/layout/PageHeader";
import { ToneCard } from "@/components/notebook/ToneCard";
import { useProfile } from "@/hooks/use-profile";
import { useShippedWork } from "@/hooks/use-shipped-work";
import { usesGuestNav } from "@/lib/role-access";

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
  const guest = usesGuestNav(profile);
  useEffect(() => {
    if (guest) navigate({ to: "/coaching" });
  }, [guest, navigate]);

  const onResultsChange = useCallback((open: boolean) => setSearching(open), []);

  if (!profile || guest) return null;

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
    `${groups.length} closed workboard${groups.length === 1 ? "" : "s"}`,
    `${cards.length} piece${cards.length === 1 ? "" : "s"} of work`,
    "nothing here is deleted",
  ].join(" · ");

  return (
    <div data-testid="archive-page">
      <PageHeader title="Look" italicWord="back" subtitle={null} />

      <section data-testid="shipped-work-section">
        <h2 className="font-mono text-[0.894rem] font-medium uppercase tracking-[0.12em] text-[var(--nb-mid)]">
          Shipped work
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
        <div className="mt-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Reading shipped work.</p>
          ) : (
            <ArchiveSpine groups={groups} hidden={searching} />
          )}
        </div>
        <p className="mt-6 font-hand text-[16px] text-green">closed, not gone</p>
      </section>

      <ArchivedSection />

      <section className="mt-6 rounded-lg border border-graphite bg-card p-5">
        <h2 className="font-mono text-[0.894rem] font-medium uppercase tracking-[0.12em] text-[var(--nb-mid)]">
          ASK PAST WORK
        </h2>

        <p className="mt-2 text-[13px] text-muted-foreground">
          Describe what you are working on and find shipped work like it.
        </p>
        <PastWorkSearch />

        {!guest && (
          <>
            <div className="my-4 border-t border-rule" />
            <p className="text-[13px] text-muted-foreground">
              Or ask how the firm does something, and read the answer out of shipped work.
            </p>
            <ArchiveChat cards={cards} onResultsChange={onResultsChange} />
          </>
        )}
      </section>

      <aside className="mt-6 grid gap-4 lg:grid-cols-3">
          <ToneCard tone="record" label="WHAT STAYS WHEN AN Workboard CLOSES">
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
              The workboard becomes read-only. Nobody can add to it, including you.
            </p>
            <p className="mt-2 leading-[19px]">
              Closing changes nobody's access. It adds no one.
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
              the person who shipped it. Exporting a whole closed workboard as one folder is not
              built yet.
            </p>
          </ToneCard>
      </aside>
    </div>
  );
}

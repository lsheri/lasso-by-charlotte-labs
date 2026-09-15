import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { SectionHeader } from "@/components/notebook/SectionHeader";
import { useAffiliation } from "@/hooks/use-affiliation";
import { useEngagements } from "@/hooks/use-engagements";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { noteDisclosureReadFn } from "@/lib/affiliation.functions";

/**
 * Pass 186: the person's own view of what an affiliated school can see.
 * Counts only, never content, and only their own numbers. Nothing here is
 * a measure of the person.
 */

/** Distinct vendors across this person's own work, and how many pieces. */
function useOwnWorkShape(profileId: string | undefined) {
  return useQuery({
    queryKey: ["affiliation-work-shape", profileId],
    enabled: Boolean(profileId),
    staleTime: 60_000,
    queryFn: async (): Promise<{ tools: number; kept: number }> => {
      try {
        const { data, error } = await supabase
          .from("work_items")
          .select("source_vendor")
          .eq("owner_id", profileId as string);
        if (error) return { tools: 0, kept: 0 };
        const rows = (data ?? []) as { source_vendor: string | null }[];
        const vendors = new Set(rows.map((r) => r.source_vendor).filter(Boolean));
        return { tools: vendors.size, kept: rows.length };
      } catch {
        return { tools: 0, kept: 0 };
      }
    },
  });
}

function Figure({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="text-[26px] leading-none">{value}</div>
      <div className="mt-2 font-mono text-[9px] uppercase text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

export function AffiliationPage() {
  const { data: affiliation } = useAffiliation();
  const institution = affiliation?.institution ?? null;
  const { data: profile } = useProfile();
  const { data: engagements } = useEngagements(profile?.id);
  const { data: shape } = useOwnWorkShape(institution ? profile?.id : undefined);

  // One read of the page, once per mount, and only when affiliated.
  const noteRead = useServerFn(noteDisclosureReadFn);
  const noted = useRef(false);
  useEffect(() => {
    if (!institution || noted.current) return;
    noted.current = true;
    void noteRead({ data: { institution: institution.slug, profile_id: profile?.id } }).catch(() => {});
  }, [institution, noteRead]);

  if (!institution) {
    return (
      <div className="page">
        <p className="text-sm text-muted-foreground">
          This workspace is not linked to a school.
        </p>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title="What"
        italicWord={institution.name}
        subtitle="Read this any time. It is the whole list."
      />

      <section className="mb-10">
        <SectionHeader title="What goes up" />
        <p className="mb-5 text-sm text-muted-foreground">Counts, never content.</p>
        <div className="flex gap-12">
          <Figure value={(engagements ?? []).length} label="projects" />
          <Figure value={shape?.tools ?? 0} label="tools that have sent work" />
          <Figure value={shape?.kept ?? 0} label="pieces of work kept" />
        </div>
      </section>

      <section className="mb-10">
        <SectionHeader title="What stays put" />
        <p className="mb-4 text-sm text-muted-foreground">
          None of this leaves your account.
        </p>
        <ul className="flex flex-col gap-1.5 text-[13px]">
          <li>The titles of your work</li>
          <li>What you asked, in every conversation</li>
          <li>Your documents and transcripts</li>
          <li>Your canvas, and what you connected to what</li>
          <li>Anything you wrote in a brief</li>
        </ul>
      </section>

      <section className="mb-10">
        <SectionHeader title="What you chose to share" />
        <p className="mb-4 text-sm text-muted-foreground">
          One piece at a time, and only when you say so.
        </p>
        <p className="text-sm text-muted-foreground">
          You have not shared anything with {institution.name}.
        </p>
      </section>

      <p className="font-hand text-[16px] text-green">
        your record is yours, and it leaves with you
      </p>
    </div>
  );
}

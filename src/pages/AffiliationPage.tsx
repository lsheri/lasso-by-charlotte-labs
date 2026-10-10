import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { SectionHeader } from "@/components/notebook/SectionHeader";
import { Button } from "@/components/ui/button";
import { useAffiliation } from "@/hooks/use-affiliation";
import { useEngagements } from "@/hooks/use-engagements";
import { isBusinessOrg, useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { noteDisclosureReadFn } from "@/lib/affiliation.functions";
import { listMyPartnerShares, listSharedEngagements, unshareEngagement } from "@/lib/partner-share";

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

type AffiliationContentProps = {
  institutionName: string;
  projectCount: number;
  toolCount: number;
  keptCount: number;
  sharedCount: number;
  sharedBoards?: { linkId: string; engagementId: string; title: string }[];
  sharingPending?: boolean;
  sharingFailed?: boolean;
};

function SharedBoardRow({ board }: { board: { linkId: string; engagementId: string; title: string } }) {
  const queryClient = useQueryClient();
  const [problem, setProblem] = useState<string | null>(null);
  const stop = useMutation({
    mutationFn: () => unshareEngagement(board.linkId, board.engagementId),
    onMutate: () => setProblem(null),
    onError: () => setProblem("That did not change. Try again."),
    onSuccess: async () => {
      setProblem(null);
      await queryClient.invalidateQueries({ queryKey: ["partner-share-engagements", board.linkId] });
      await queryClient.invalidateQueries({ queryKey: ["affiliation-shared-boards"] });
    },
  });

  return (
    <li className="flex flex-col gap-1 rounded-md border border-border p-2">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 break-words text-sm text-foreground">{board.title}</span>
        <Button size="sm" variant="ghost" className="shrink-0" disabled={stop.isPending} onClick={() => stop.mutate()}>
          Stop sharing
        </Button>
      </div>
      {problem ? <p className="nb-type-small text-foreground" role="alert">{problem}</p> : null}
    </li>
  );
}

export function WhatGoesUpSection({ projectCount, toolCount, keptCount }: Pick<AffiliationContentProps, "projectCount" | "toolCount" | "keptCount">) {
  return (
    <section className="mb-10" data-testid="affiliation-counts">
      <SectionHeader title="What goes up" />
      <p className="mb-5 text-sm text-muted-foreground">Counts, never content.</p>
      <div className="flex gap-12">
        <Figure value={projectCount} label="projects" />
        <Figure value={toolCount} label="tools that have sent work" />
        <Figure value={keptCount} label="pieces of work kept" />
      </div>
    </section>
  );
}

export function SharedWithSection({ institutionName, sharedCount, sharedBoards = [], sharingPending = false, sharingFailed = false }: Pick<AffiliationContentProps, "institutionName" | "sharedCount" | "sharedBoards" | "sharingPending" | "sharingFailed">) {
  const nothingShared = sharedCount === 0;
  return (
    <section className="mb-10" data-testid="affiliation-sharing">
      {sharingPending ? (
        <p className="text-sm text-muted-foreground">Reading shared boards.</p>
      ) : sharingFailed ? (
        <p className="text-sm text-foreground" role="alert">Shared boards could not be read. Try again.</p>
      ) : nothingShared ? (
        <>
          <SectionHeader title={`Nothing has been shared with ${institutionName}.`} />
          <p className="text-sm text-muted-foreground">
            This workspace is linked to them. They see nothing until you share something, one piece at a time.
          </p>
        </>
      ) : (
        <>
          <SectionHeader title={`${institutionName} can open these boards.`} />
          <ul className="mb-4 space-y-2">
            {sharedBoards.map((board) => (
              <SharedBoardRow key={`${board.linkId}:${board.engagementId}`} board={board} />
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            They see the work you have placed on each one, and nothing you have not placed.
          </p>
        </>
      )}
    </section>
  );
}

export function WhatStaysPutSection({ sharedCount, sharingPending = false, sharingFailed = false }: Pick<AffiliationContentProps, "sharedCount" | "sharingPending" | "sharingFailed">) {
  const nothingShared = sharedCount === 0;
  return (
      <section className="mb-10">
        <SectionHeader title="What stays put" />
        <p className="mb-4 text-sm text-muted-foreground">
          {nothingShared && !sharingPending && !sharingFailed ? "None of this leaves your account." : "Anything you have not placed on a shared board stays in your account."}
        </p>
        <ul className="flex flex-col gap-1.5 text-[13px]">
          <li>The titles of your work</li>
          <li>What you asked, in every conversation</li>
          <li>Your documents and transcripts</li>
          <li>Your canvas, and what you connected to what</li>
          <li>Anything you wrote in a brief</li>
        </ul>
      </section>
  );
}

export function AffiliationContent(props: AffiliationContentProps) {
  const { institutionName, sharedCount } = props;
  const nothingShared = sharedCount === 0;
  const sharing = <SharedWithSection {...props} />;
  return (
    <>
      <PageHeader
        title="What"
        italicWord={institutionName}
        subtitle="Read this any time. It is the whole list."
      />

      {nothingShared ? sharing : null}
      <WhatGoesUpSection {...props} />

      <WhatStaysPutSection {...props} />

      {nothingShared ? null : sharing}

      <p className="font-hand text-[16px] text-green">
        your record is yours, and it leaves with you
      </p>
    </>
  );
}

export function useSharedBoards(enabled = true) {
  const { data: affiliation } = useAffiliation();
  const institution = affiliation?.institution ?? null;
  const { data: profile } = useProfile();
  const { data: engagements } = useEngagements(enabled ? profile?.id : undefined);
  const { data: shape } = useOwnWorkShape(enabled && institution ? profile?.id : undefined);
  const shared = useQuery({
    queryKey: ["affiliation-shared-boards", profile?.id, institution?.id],
    enabled: Boolean(enabled && profile?.id && institution),
    staleTime: 5_000,
    queryFn: async () => {
      if (!profile?.id || !institution) return [];
      const sponsors = (await listMyPartnerShares(profile.id)).filter((share) => share.institutionId === institution.id);
      const boards = await Promise.all(sponsors.map(async (share) =>
        (await listSharedEngagements(share.linkId)).map((engagementId) => ({ linkId: share.linkId, engagementId })),
      ));
      return boards.flat();
    },
  });
  const sharedBoards = (shared.data ?? []).map((board) => ({
    ...board,
    title: engagements?.find((engagement) => engagement.id === board.engagementId)?.title ?? "A board you are no longer on",
  }));

  // One read of the page, once per mount, and only when affiliated.
  const noteRead = useServerFn(noteDisclosureReadFn);
  const noted = useRef(false);
  useEffect(() => {
    if (!enabled || !institution || noted.current) return;
    noted.current = true;
    void noteRead({ data: { institution: institution.slug, profile_id: profile?.id } }).catch(() => {});
  }, [enabled, institution, noteRead]);

  return {
    institution,
    projectCount: (engagements ?? []).length,
    toolCount: shape?.tools ?? 0,
    keptCount: shape?.kept ?? 0,
    sharedBoards,
    sharedCount: sharedBoards.length,
    sharingPending: shared.isPending,
    sharingFailed: shared.isError,
  };
}

export function AffiliationPage() {
  const { data: profile } = useProfile();
  const business = isBusinessOrg(profile);
  const { institution, sharedBoards, ...sections } = useSharedBoards(business);

  if (!business) {
    return (
      <div className="page">
        <p className="text-sm text-muted-foreground">
          This has moved. Everything you have shared, and who can see it, is on one page now.
        </p>
        <Link to="/members" className="text-sm text-green">Who you share with</Link>
      </div>
    );
  }

  if (!institution) {
    return (
      <div className="page">
        <p className="text-sm text-muted-foreground">
          This workspace is not linked to a school or a partner.
        </p>
      </div>
    );
  }

  return (
    <div className="page">
      <AffiliationContent
        institutionName={institution.name}
        {...sections}
        sharedCount={sharedBoards.length}
        sharedBoards={sharedBoards}
      />
    </div>
  );
}

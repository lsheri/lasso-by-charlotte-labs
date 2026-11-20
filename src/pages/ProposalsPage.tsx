import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { NewProposalDialog } from "@/components/proposals/NewProposalDialog";
import { ProposalDesk } from "@/components/proposals/ProposalDesk";
import { RosterPanel } from "@/components/roster/RosterPanel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCaptureFiles } from "@/components/work/use-capture-files";
import { useProfile } from "@/hooks/use-profile";
import { DESK_COPY, seesAllProposals, type DeskClient, type DeskList } from "@/lib/proposal-desk-shared";
import { createProposalFn, listProposalClientsFn, listProposalsFn, setProposalSentFn, winProposalFn } from "@/lib/proposal-desk.functions";
import { profileHasFirmView } from "@/lib/workspace-capabilities";

/**
 * 20 Nov 2026, the Proposal Desk (Liam, D-34 and D-38): the Proposals page, on for every company workspace. The
 * edge of the feature: it owns the reads, the upload and the create call, and hands plain values to the dashboard
 * and the intake dialog. The People tab is the roster panel (its own files and server functions); it is for admins
 * and leads, so nobody else is shown the tab, and the roster's server functions refuse them in any case.
 */
export function ProposalsPage() {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { captureWithResult } = useCaptureFiles();
  const [open, setOpen] = useState(false);
  const allowed = profileHasFirmView(profile) && profile?.role !== "coach" && !profile?.is_guest;
  const profileId = allowed ? profile?.id : undefined;
  const showPeople = allowed && seesAllProposals(profile?.role);

  const desk = useQuery({
    queryKey: ["proposal-desk", profileId],
    enabled: Boolean(profileId),
    staleTime: 30_000,
    retry: false,
    queryFn: (): Promise<DeskList> => listProposalsFn({ data: { profile_id: profileId as string } }),
  });
  const clients = useQuery({
    queryKey: ["proposal-desk-clients", profileId],
    enabled: Boolean(profileId) && open,
    staleTime: 30_000,
    retry: false,
    queryFn: (): Promise<DeskClient[]> => listProposalClientsFn({ data: { profile_id: profileId as string } }),
  });

  if (profile && !allowed) {
    return (
      <div>
        <PageHeader title={DESK_COPY.title} subtitle={DESK_COPY.notHere} />
      </div>
    );
  }

  return (
    <div className="pb-16" data-testid="proposals-page">
      <PageHeader
        title={DESK_COPY.title}
        subtitle={DESK_COPY.subtitle}
        action={
          <Button type="button" disabled={!profileId} onClick={() => setOpen(true)}>
            {DESK_COPY.newProposal}
          </Button>
        }
      />
      <Tabs defaultValue="proposals">
        <TabsList>
          <TabsTrigger value="proposals">{DESK_COPY.tabs.proposals}</TabsTrigger>
          {showPeople ? <TabsTrigger value="people">{DESK_COPY.tabs.people}</TabsTrigger> : null}
        </TabsList>
        <TabsContent value="proposals" className="pt-4">
          {desk.error ? (
            <p role="alert" className="text-sm text-destructive">
              {DESK_COPY.loadFailed}{" "}
              <button type="button" className="underline" onClick={() => void desk.refetch()}>
                {DESK_COPY.retry}
              </button>
            </p>
          ) : null}
          {desk.isLoading ? <p className="text-sm text-muted-foreground">{DESK_COPY.loading}</p> : null}
          {desk.data ? (
            <ProposalDesk
              data={desk.data}
              onSent={async (proposalId, sent) => {
                const result = await setProposalSentFn({ data: { profile_id: profileId as string, proposal_id: proposalId, sent } });
                if (result.ok) await queryClient.invalidateQueries({ queryKey: ["proposal-desk"] });
                return result;
              }}
              onWin={async (proposalId) => {
                const result = await winProposalFn({ data: { profile_id: profileId as string, proposal_id: proposalId } });
                if (result.ok) {
                  void queryClient.invalidateQueries({ queryKey: ["proposal-desk"] });
                  void queryClient.invalidateQueries({ queryKey: ["engagements"] });
                  await navigate({ to: "/engagements/$id/canvas-lab", params: { id: result.engagementId } });
                }
                return result;
              }}
            />
          ) : null}
        </TabsContent>
        {showPeople ? (
          <TabsContent value="people" className="pt-4">
            <RosterPanel profileId={profileId} />
          </TabsContent>
        ) : null}
      </Tabs>

      <NewProposalDialog
        open={open}
        onOpenChange={setOpen}
        clients={clients.data}
        clientsLoading={clients.isLoading}
        profileId={profileId}
        capture={(files) => captureWithResult(files, { channel: "upload" })}
        create={(input) => createProposalFn({ data: input })}
        onCreated={() => {
          void queryClient.invalidateQueries({ queryKey: ["proposal-desk"] });
          void queryClient.invalidateQueries({ queryKey: ["proposal-desk-clients"] });
          void queryClient.invalidateQueries({ queryKey: ["clients"] });
        }}
      />
    </div>
  );
}

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { DemoTextNumberCard } from "@/components/proposals/DemoTextNumberCard";
import { NewProposalDialog } from "@/components/proposals/NewProposalDialog";
import { ProposalDesk } from "@/components/proposals/ProposalDesk";
import { ProposalDeskSkeleton } from "@/components/proposals/ProposalDeskSkeleton";
import { useProposalDesk } from "@/components/proposals/use-proposal-desk";
import { RosterPanel } from "@/components/roster/RosterPanel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCaptureFiles } from "@/components/work/use-capture-files";
import { useProfile } from "@/hooks/use-profile";
import { useBrandCopy } from "@/components/skin/use-skin";
import { DESK_COPY, deskViewFromSearch, seesAllProposals, type DeskClient } from "@/lib/proposal-desk-shared";
import { deleteWorkItem } from "@/lib/work-remove.functions";
import { askLeadFn, askPreviewFn, practiceReplyFn } from "@/lib/lead-ask.functions";
import { closeProposalFn, createProposalFn, listProposalClientsFn, setProposalLeadFn, setProposalSentFn, winProposalFn } from "@/lib/proposal-desk.functions";
import { listRosterFn } from "@/lib/roster.functions";
import { wonTextBody } from "@/lib/won-text-shared";
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
  // "See all" on Home carries the view chosen there. Read once from the address, so the chips stay in charge after.
  const [initialView] = useState(() => deskViewFromSearch(new URLSearchParams(globalThis.location?.search ?? "").get("view")) ?? undefined);
  const allowed = profileHasFirmView(profile) && profile?.role !== "coach" && !profile?.is_guest;
  const profileId = allowed ? profile?.id : undefined;
  const showPeople = allowed && seesAllProposals(profile?.role);

  const desk = useProposalDesk(profileId);
  const clients = useQuery({
    queryKey: ["proposal-desk-clients", profileId],
    enabled: Boolean(profileId) && open,
    staleTime: 30_000,
    retry: false,
    queryFn: (): Promise<DeskClient[]> => listProposalClientsFn({ data: { profile_id: profileId as string } }),
  });

  // The roster names the lead on each row and fills the pick list. Its server function refuses anyone but an admin or a lead.
  const roster = useQuery({
    queryKey: ["proposal-desk-roster", profileId],
    enabled: Boolean(profileId) && showPeople,
    staleTime: 30_000,
    retry: false,
    queryFn: () => listRosterFn({ data: { profile_id: profileId as string } }),
  });
  const brand = useBrandCopy();

  if (profile && !allowed) {
    return (
      <div>
        <PageHeader title={DESK_COPY.title} subtitle={profile.role === "coach" && profileHasFirmView(profile) ? DESK_COPY.notHereCoach : DESK_COPY.notHere} />
      </div>
    );
  }

  return (
    <div className="pb-16" data-testid="proposals-page">
      <PageHeader
        title={DESK_COPY.title}
        subtitle={DESK_COPY.subtitle}
        action={
          // D-86: quiet, so the one filled button on the page is always the most urgent next step.
          <Button type="button" variant="outline" disabled={!profileId} onClick={() => setOpen(true)}>
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
          {desk.isLoading ? <ProposalDeskSkeleton /> : null}
          {desk.data ? (
            <ProposalDesk
              data={desk.data}
              initialView={initialView}
              roster={roster.data?.allowed ? roster.data.contacts : undefined}
              leadWords={wonTextBody({ brandName: brand("Lasso"), firmName: profile?.org_name ?? "" })}
              onLead={async (proposalId, contactId) => {
                const result = await setProposalLeadFn({ data: { profile_id: profileId as string, proposal_id: proposalId, lead_contact_id: contactId } });
                if (result.ok) {
                  await queryClient.invalidateQueries({ queryKey: ["proposal-desk"] });
                  void roster.refetch();
                }
                return result;
              }}
              ask={{
                preview: (proposalId, contactId) => askPreviewFn({ data: { profile_id: profileId as string, proposal_id: proposalId, lead_contact_id: contactId ?? null } }),
                send: async (proposalId, pressId) => {
                  const result = await askLeadFn({ data: { profile_id: profileId as string, proposal_id: proposalId, press_id: pressId } });
                  await queryClient.invalidateQueries({ queryKey: ["proposal-desk"] });
                  return result;
                },
                practiceReply: async (proposalId, reply) => {
                  const result = await practiceReplyFn({ data: { profile_id: profileId as string, proposal_id: proposalId, reply } });
                  await queryClient.invalidateQueries({ queryKey: ["proposal-desk"] });
                  return result;
                },
              }}
              onClose={async (proposalId, change) => {
                const result = await closeProposalFn({ data: { profile_id: profileId as string, proposal_id: proposalId, change } });
                if (result.ok) await queryClient.invalidateQueries({ queryKey: ["proposal-desk"] });
                return result;
              }}
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
            <DemoTextNumberCard profileId={profileId} />
          </TabsContent>
        ) : null}
      </Tabs>

      <NewProposalDialog
        open={open}
        onOpenChange={setOpen}
        clients={clients.data}
        clientsLoading={clients.isLoading}
        canAddClient={desk.data?.canAddClient ?? false}
        profileId={profileId}
        capture={(files) => captureWithResult(files, { channel: "upload" })}
        discard={async (ids) => {
          await Promise.all(ids.map((id) => deleteWorkItem({ data: { work_item_id: id, profile_id: profileId ?? null } })));
        }}
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

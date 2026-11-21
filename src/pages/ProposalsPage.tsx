import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { DemoTextNumberCard } from "@/components/proposals/DemoTextNumberCard";
import { NewProposalDialog } from "@/components/proposals/NewProposalDialog";
import { ProposalDesk } from "@/components/proposals/ProposalDesk";
import { useProposalDesk } from "@/components/proposals/use-proposal-desk";
import { RosterPanel } from "@/components/roster/RosterPanel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCaptureFiles } from "@/components/work/use-capture-files";
import { SkeletonFrame } from "@/components/ui/skeleton-frame";
import { useProfile } from "@/hooks/use-profile";
import { useBrandCopy } from "@/components/skin/use-skin";
import { afterCreate, DESK_COPY, deskLinkFromSearch, deskViewFromSearch, seesAllProposals, type DeskClient, type DeskList } from "@/lib/proposal-desk-shared";
import { deleteWorkItem } from "@/lib/work-remove.functions";
import { askLeadFn, askPreviewFn, practiceReplyFn, recordAnswerFn } from "@/lib/lead-ask.functions";
import { closeProposalFn, createProposalFn, listProposalClientsFn, setProposalLeadFn, setProposalSentFn, winProposalFn } from "@/lib/proposal-desk.functions";
import { linkTeammateFn, listRosterFn } from "@/lib/roster.functions";
import { sendLeadDocsFn } from "@/lib/lead-view.functions";
import { wonTextBody } from "@/lib/won-text-shared";
import { morph } from "@/lib/view-morph";
import { profileHasFirmView } from "@/lib/workspace-capabilities";

/**
 * 20 Nov 2026, the Proposal Desk (Liam, D-34 and D-38): the Proposals page, on for every company workspace. The
 * edge of the feature: it owns the reads, the upload and the create call, and hands plain values to the dashboard
 * and the intake dialog. The People tab is the roster panel (its own files and server functions); it is for admins
 * and leads, so nobody else is shown the tab, and the roster's server functions refuse them in any case.
 */
/** Brings the proposal a link named into view once the list is there, and marks it for a moment. */
function useLinkedRow(id: string | undefined, ready: boolean) {
  const done = useRef(false);
  useEffect(() => {
    if (!id || !ready || done.current) return;
    const row = document.querySelector<HTMLElement>(`[data-proposal-row="${id}"]`);
    if (!row) return;
    done.current = true;
    row.setAttribute("data-linked", "true");
    row.scrollIntoView?.({ block: "center", behavior: "smooth" });
    const timer = window.setTimeout(() => row.removeAttribute("data-linked"), 2400);
    return () => window.clearTimeout(timer);
  }, [id, ready]);
}

export function ProposalsPage() {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { captureWithResult } = useCaptureFiles();
  const [open, setOpen] = useState(false);
  // "See all" on Home carries the view chosen there. Read once from the address, so the chips stay in charge after.
  const [initialView] = useState(() => deskViewFromSearch(new URLSearchParams(globalThis.location?.search ?? "").get("view")) ?? undefined);
  // 21 Nov (D-82): an admin's Home links here to one proposal, to its lead sheet, or to People. Read once, like the view.
  const [link] = useState(() => deskLinkFromSearch(new URLSearchParams(globalThis.location?.search ?? "")));
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
  const [startLead, setStartLead] = useState<string | null>(link.lead ?? null);
  // The sheet a link opened is not a proposal just started, so it does not say so.
  const [leadFromLink, setLeadFromLink] = useState(Boolean(link.lead));
  // A proposal that saved but is not in the list yet (QA M1). Cleared by itself once a read shows it.
  const [notShown, setNotShown] = useState<{ id: string; title: string } | null>(null);
  const lastTitle = useRef("");
  const missing = notShown !== null && !desk.data?.proposals.some((proposal) => proposal.id === notShown.id) ? notShown : null;
  // Who may pick a lead: the server says so for the desk, and the people list was readable.
  const mayPickLead = Boolean(desk.data?.canPickLead && roster.data?.allowed);
  useLinkedRow(link.proposal, Boolean(desk.data));

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
      <Tabs defaultValue={link.tab === "people" && showPeople ? "people" : "proposals"}>
        <TabsList>
          <TabsTrigger value="proposals">{DESK_COPY.tabs.proposals}</TabsTrigger>
          {showPeople ? <TabsTrigger value="people">{DESK_COPY.tabs.people}</TabsTrigger> : null}
        </TabsList>
        <TabsContent value="proposals" className="pt-4">
          {missing ? (
            <p role="alert" data-proposal-started-not-shown className="text-sm text-foreground">
              {DESK_COPY.startedNotRefreshed}{" "}
              <button type="button" className="underline" onClick={() => void desk.refetch()}>
                {DESK_COPY.retry}
              </button>
            </p>
          ) : desk.error ? (
            <p role="alert" className="text-sm text-destructive">
              {DESK_COPY.loadFailed}{" "}
              <button type="button" className="underline" onClick={() => void desk.refetch()}>
                {DESK_COPY.retry}
              </button>
            </p>
          ) : null}
          {desk.isLoading ? <SkeletonFrame shape="rows" count={6} label={DESK_COPY.loading} testId="proposals-skeleton" /> : null}
          {desk.data ? (
            <ProposalDesk
              data={desk.data}
              initialView={initialView}
              startLead={startLead}
              startLeadFresh={!leadFromLink}
              onStartLeadDone={() => {
                setStartLead(null);
                setLeadFromLink(false);
              }}
              roster={roster.data?.allowed ? roster.data.contacts : undefined}
              teammates={roster.data?.allowed ? roster.data.teammates : undefined}
              onSendDocs={async (proposalId, send) => {
                const result = await sendLeadDocsFn({ data: { profile_id: profileId as string, proposal_id: proposalId, send } });
                if (result.ok) await queryClient.invalidateQueries({ queryKey: ["proposal-desk"] });
                return result;
              }}
              linkTeammate={async (teammateId, contactId) => {
                const result = await linkTeammateFn({ data: { profile_id: profileId as string, teammate_id: teammateId, contact_id: contactId ?? null } });
                if (result.ok) void roster.refetch();
                return result;
              }}
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
                recordAnswer: async (proposalId, reply) => {
                  const result = await recordAnswerFn({ data: { profile_id: profileId as string, proposal_id: proposalId, press_id: crypto.randomUUID(), reply } });
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
        clientsOff={desk.data?.clientsOff ?? false}
        profileId={profileId}
        capture={(files) => captureWithResult(files, { channel: "upload" })}
        discard={async (ids) => {
          await Promise.all(ids.map((id) => deleteWorkItem({ data: { work_item_id: id, profile_id: profileId ?? null } })));
        }}
        create={async (input) => {
          const result = await createProposalFn({ data: input });
          if (result.ok) lastTitle.current = input.title;
          return result;
        }}
        recent={missing ? missing.title : undefined}
        onCreated={async (id) => {
          void queryClient.invalidateQueries({ queryKey: ["proposal-desk-clients"] });
          void queryClient.invalidateQueries({ queryKey: ["clients"] });
          // 21 Nov 2026 (Liam): making a proposal begins lead picking. The desk is read again first, so the new
          // row is there for the sheet; then the form morphs into the sheet. Only for people who may pick a lead.
          await queryClient.invalidateQueries({ queryKey: ["proposal-desk"] });
          const next = afterCreate(queryClient.getQueryData<DeskList>(["proposal-desk", profileId]), id, mayPickLead);
          // QA M1: if the new row is not in the list, say it was started, and open nothing by itself later.
          setStartLead(null);
          setLeadFromLink(false);
          if (next === "notRefreshed") setNotShown({ id, title: lastTitle.current });
          else if (next === "sheet") await morph(() => { setOpen(false); setStartLead(id); });
        }}
      />
    </div>
  );
}

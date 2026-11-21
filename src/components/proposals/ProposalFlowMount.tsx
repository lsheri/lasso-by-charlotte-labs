import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { useBrand } from "@/components/skin/use-skin";
import { useCaptureFiles } from "@/components/work/use-capture-files";
import { useReducedMotion } from "@/hooks/use-motion";
import { briefAdminsFn, passBriefFn, readBriefFn } from "@/lib/brief-read.functions";
import { sendLeadDocsFn } from "@/lib/lead-view.functions";
import { createProposalFn, listProposalClientsFn } from "@/lib/proposal-desk.functions";
import { deleteWorkItem } from "@/lib/work-remove.functions";

import { ProposalFlow } from "./ProposalFlow";
import { useProposalDesk } from "./use-proposal-desk";

/**
 * 21 Nov 2026, click path cards: the proposal step card as a page mounts it, with the same server calls the chat
 * makes (ChatPillMount): the brief read, New proposal's create, the pass to an admin, and Send the documents. Home's
 * "Start a proposal" and Proposals' "New proposal" both use it. It stays mounted, so a card closed by mistake keeps
 * what was typed.
 */
export function ProposalFlowMount({
  open,
  onOpenChange,
  profileId,
  mayStart,
  firmName,
  onProposals = false,
  onStarted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  mayStart: boolean;
  firmName: string;
  /** Already on Proposals: the last step closes onto the new row instead of going there. */
  onProposals?: boolean;
  onStarted?: (proposalId: string) => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const brand = useBrand();
  const reduceMotion = useReducedMotion();
  const { captureWithResult } = useCaptureFiles();
  // Nothing is read until the card is first opened, so Home asks for no proposals by itself (D-85).
  const [woken, setWoken] = useState(open);
  if (open && !woken) setWoken(true);
  const desk = useProposalDesk(mayStart && woken ? profileId : undefined);
  const goalHours = desk.data?.goalHours ?? 72;

  const tools = useMemo(
    () => ({
      profileId,
      goalHours,
      read: (text: string) => readBriefFn({ data: { profile_id: profileId, text } }),
      clients: () => listProposalClientsFn({ data: { profile_id: profileId } }),
      capture: (files: File[]) => captureWithResult(files, { channel: "upload" }),
      discard: async (ids: string[]) => {
        await Promise.all(ids.map((id) => deleteWorkItem({ data: { work_item_id: id, profile_id: profileId } })));
      },
      create: async (input: Parameters<typeof createProposalFn>[0]["data"]) => {
        const result = await createProposalFn({ data: input as never });
        if (result.ok) {
          void queryClient.invalidateQueries({ queryKey: ["proposal-desk-clients"] });
          void queryClient.invalidateQueries({ queryKey: ["clients"] });
          await queryClient.invalidateQueries({ queryKey: ["proposal-desk"] });
        }
        return result;
      },
    }),
    [profileId, goalHours, captureWithResult, queryClient],
  );
  const passTools = useMemo(
    () => ({
      admins: () => briefAdminsFn({ data: { profile_id: profileId } }),
      pass: (text: string) => passBriefFn({ data: { profile_id: profileId, text } }),
    }),
    [profileId],
  );

  return (
    <ProposalFlow
      open={open}
      woken={woken}
      cardKey={onProposals ? "proposal-flow:proposals" : "proposal-flow:home"}
      onOpenChange={onOpenChange}
      mayStart={mayStart}
      tools={tools}
      passTools={passTools}
      firmName={firmName}
      brandName={brand.name}
      reduceMotion={reduceMotion}
      sendDocs={async (proposalId, send) => {
        const result = await sendLeadDocsFn({ data: { profile_id: profileId, proposal_id: proposalId, send } });
        if (result.ok) await queryClient.invalidateQueries({ queryKey: ["proposal-desk"] });
        return result;
      }}
      onStarted={onStarted}
      onOpenProposal={
        onProposals
          ? undefined
          : (id) => void navigate({ to: "/proposals", search: { proposal: id } as never })
      }
    />
  );
}

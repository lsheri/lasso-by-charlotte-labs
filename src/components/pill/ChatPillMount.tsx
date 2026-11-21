import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { FirmSourcePreview } from "@/components/firm-brain/FirmSourcePreview";

import { useAskLassoHandler } from "@/components/reflect/ask-lasso-context";
import { useBrand } from "@/components/skin/use-skin";
import { useEngagementViews } from "@/hooks/use-engagement-views";
import { useEngagements } from "@/hooks/use-engagements";
import { useReducedMotion } from "@/hooks/use-motion";
import { useProfile } from "@/hooks/use-profile";
import { pillAccess, pillPlace, pillStarters } from "@/lib/chat-pill-shared";
import { emitClientEvent } from "@/lib/client-telemetry";
import { FIRM_ASK_QUESTION_MAX } from "@/lib/firm-ask-shared";
import { askTheFirm } from "@/lib/firm-ask.functions";
import { orderHomeGrid } from "@/lib/home-grid";
import { firstNameOf, handOffQuestion } from "@/lib/home-ask-shared";
import { useProposalDesk } from "@/components/proposals/use-proposal-desk";
import { useCaptureFiles } from "@/components/work/use-capture-files";
import { briefAdminsFn, passBriefFn, readBriefFn } from "@/lib/brief-read.functions";
import { mayStartInChat, PROPOSAL_CARD_COPY } from "@/lib/pill-proposal-shared";
import { createProposalFn, listProposalClientsFn } from "@/lib/proposal-desk.functions";
import { deleteWorkItem } from "@/lib/work-remove.functions";

import { ChatPill } from "./ChatPill";
import { landCard, liftCard } from "./fly-card";
import { PillBriefPass, PillProposalCard, type PassTools, type ProposalCardTools } from "./PillProposalCard";
import { PillLeadStep } from "./PillLeadStep";
import { PillUpNext } from "./PillUpNext";
import { useLed } from "@/components/home/use-led";

/**
 * 20 Nov 2026, chat pill: the pill as the app mounts it, once, in the app shell. It reads where the person is and who
 * they are, and asks the firm in the chat (PR 1b): the answer builds there with its sources, and "Open on the canvas"
 * carries that same answer to the Firm brain canvas beside its threads, never asked twice. On a board it opens the
 * board's own chat. Nothing about the question is kept or sent anywhere
 * but Ask the firm; the events say only which page the pill was opened on.
 */
export function ChatPillMount() {
  const { data: profile } = useProfile();
  const brand = useBrand();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const path = useRouterState({ select: (state) => state.location.pathname });
  const boardHandler = useAskLassoHandler();
  const ask = useServerFn(askTheFirm);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const place = pillPlace(path);
  const canAsk = pillAccess(profile) === "firm";
  const { data: engagements } = useEngagements(canAsk ? (profile?.id ?? undefined) : undefined);
  const { data: views } = useEngagementViews(canAsk ? (profile?.id ?? undefined) : undefined);
  const queryClient = useQueryClient();
  const { captureWithResult } = useCaptureFiles();
  const starts = canAsk && mayStartInChat(profile?.role);
  // Only for people who may start a proposal: the goal hours the card's clock line says.
  const desk = useProposalDesk(starts ? (profile?.id ?? undefined) : undefined);
  const goalHours = desk.data?.goalHours ?? 72;
  // PR 4b: the proposals this person leads, from the same cache entry as Home's Up next.
  const led = useLed(canAsk ? (profile?.id ?? undefined) : undefined);
  const pid = profile?.id ?? "";
  const firmName = profile?.org_name ?? "";
  const passTools = useMemo<PassTools>(
    () => ({
      admins: () => briefAdminsFn({ data: { profile_id: pid } }),
      pass: (text) => passBriefFn({ data: { profile_id: pid, text } }),
    }),
    [pid],
  );
  if (!profile?.id) return null;
  const viewed = new Map((views ?? []).map((row) => [row.engagement_id, row.last_viewed_at]));
  const recent = orderHomeGrid(
    (engagements ?? []).map((engagement) => ({
      title: engagement.title,
      lastViewedAt: viewed.get(engagement.id) ?? null,
    })),
  )[0];
  const profileId = profile.id;
  const cardTools = (tuck: () => void): ProposalCardTools => ({
    profileId,
    goalHours,
    read: (text) => readBriefFn({ data: { profile_id: profileId, text } }),
    clients: () => listProposalClientsFn({ data: { profile_id: profileId } }),
    capture: (files) => captureWithResult(files, { channel: "upload" }),
    discard: async (ids) => {
      await Promise.all(ids.map((id) => deleteWorkItem({ data: { work_item_id: id, profile_id: profileId } })));
    },
    create: async (input) => {
      const result = await createProposalFn({ data: input as never });
      if (result.ok) {
        // The new row must be in the desk the lead sheet and Proposals read.
        void queryClient.invalidateQueries({ queryKey: ["proposal-desk-clients"] });
        void queryClient.invalidateQueries({ queryKey: ["clients"] });
        await queryClient.invalidateQueries({ queryKey: ["proposal-desk"] });
      }
      return result;
    },
    leadStep: (proposalId, done) => <PillLeadStep proposalId={proposalId} profileId={profileId} firmName={firmName} onDone={done} />,
    land: async (source, proposalId, client) => {
      // The prototype's landing: a picture of the card is lifted, Proposals opens, the chat tucks away, and the card
      // flies into its new row. With reduced motion nothing travels; the toast still says where it is.
      const lifted = !reduceMotion && source ? liftCard(source) : null;
      if (place !== "proposals") await navigate({ to: "/proposals" });
      tuck();
      toast(PROPOSAL_CARD_COPY.landed(client));
      const find = () => document.querySelector<HTMLElement>(`[data-proposal-row="${proposalId}"]`);
      if (lifted) await landCard(lifted, find, 6000);
      const row = find();
      if (row) {
        row.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
        row.setAttribute("data-linked", "");
        window.setTimeout(() => row.removeAttribute("data-linked"), 2400);
      }
    },
  });

  return (
    <>
      <ChatPill
        brandName={brand.name}
        askLabel={brand.askLabel}
        firstName={firstNameOf(profile.display_name)}
        place={place}
        canAsk={canAsk}
        questionMax={FIRM_ASK_QUESTION_MAX}
        starters={canAsk ? pillStarters(profile.role, recent?.title) : []}
        boardChat={place === "board" ? boardHandler : null}
        reduceMotion={reduceMotion}
        upNext={<PillUpNext data={led.data} onOpen={() => void navigate({ to: "/" })} />}
        onOpened={(where) => emitClientEvent("pill.opened", { page: where })}
        onExpanded={(where) => emitClientEvent("pill.expanded", { page: where })}
        profileId={profileId}
        onAsk={(question, starter) => ask({ data: { question, starter, profile_id: profileId } })}
        onOpenSource={setOpenItem}
        brief={
          canAsk
            ? {
                render: (text, context) =>
                  starts ? (
                    <PillProposalCard text={text} tools={cardTools(context.tuck)} reduceMotion={reduceMotion} onAskInstead={context.askInstead} />
                  ) : (
                    <PillBriefPass text={text} tools={passTools} onAskInstead={context.askInstead} />
                  ),
              }
            : null
        }
        onOpenOnCanvas={async (question, result) => {
          // The canvas takes it once, for this person only, while it is fresh, with the answer it already has, so the
          // firm is not asked twice. Already on Firm brain, it hears at once.
          handOffQuestion(question, result, profileId, Date.now(), { fromHome: false });
          if (place !== "firm") await navigate({ to: "/firm-brain" });
        }}
      />
      <FirmSourcePreview
        itemId={openItem}
        profileId={profileId}
        onClose={() => setOpenItem(null)}
      />
    </>
  );
}

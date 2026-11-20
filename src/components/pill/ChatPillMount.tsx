import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { FirmSourcePreview } from "@/components/firm-brain/FirmSourcePreview";

import { useAskLassoHandler } from "@/components/reflect/ask-lasso-context";
import { useBrand } from "@/components/skin/use-skin";
import { useEngagementViews } from "@/hooks/use-engagement-views";
import { useEngagements } from "@/hooks/use-engagements";
import { useReducedMotion } from "@/hooks/use-motion";
import { useProfile } from "@/hooks/use-profile";
import { pillAccess, pillPlace } from "@/lib/chat-pill-shared";
import { emitClientEvent } from "@/lib/client-telemetry";
import { FIRM_ASK_QUESTION_MAX } from "@/lib/firm-ask-shared";
import { askTheFirm } from "@/lib/firm-ask.functions";
import { orderHomeGrid } from "@/lib/home-grid";
import { firstNameOf, handOffQuestion, homeStarters } from "@/lib/home-ask-shared";

import { ChatPill } from "./ChatPill";

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
  if (!profile?.id) return null;
  const viewed = new Map((views ?? []).map((row) => [row.engagement_id, row.last_viewed_at]));
  const recent = orderHomeGrid(
    (engagements ?? []).map((engagement) => ({
      title: engagement.title,
      lastViewedAt: viewed.get(engagement.id) ?? null,
    })),
  )[0];
  const profileId = profile.id;

  return (
    <>
      <ChatPill
        brandName={brand.name}
        askLabel={brand.askLabel}
        firstName={firstNameOf(profile.display_name)}
        place={place}
        canAsk={canAsk}
        questionMax={FIRM_ASK_QUESTION_MAX}
        starters={canAsk ? homeStarters(profile.role, recent?.title) : []}
        boardChat={place === "board" ? boardHandler : null}
        reduceMotion={reduceMotion}
        onOpened={(where) => emitClientEvent("pill.opened", { page: where })}
        onExpanded={(where) => emitClientEvent("pill.expanded", { page: where })}
        profileId={profileId}
        onAsk={(question) => ask({ data: { question, starter: null, profile_id: profileId } })}
        onOpenSource={setOpenItem}
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

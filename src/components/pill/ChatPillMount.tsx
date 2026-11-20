import { useNavigate, useRouterState } from "@tanstack/react-router";

import { useAskLassoHandler } from "@/components/reflect/ask-lasso-context";
import { useBrand } from "@/components/skin/use-skin";
import { useEngagementViews } from "@/hooks/use-engagement-views";
import { useEngagements } from "@/hooks/use-engagements";
import { useReducedMotion } from "@/hooks/use-motion";
import { useProfile } from "@/hooks/use-profile";
import { pillAccess, pillPlace } from "@/lib/chat-pill-shared";
import { emitClientEvent } from "@/lib/client-telemetry";
import { FIRM_ASK_QUESTION_MAX } from "@/lib/firm-ask-shared";
import { orderHomeGrid } from "@/lib/home-grid";
import { firstNameOf, handOffQuestion, homeStarters } from "@/lib/home-ask-shared";

import { ChatPill } from "./ChatPill";

/**
 * 20 Nov 2026, chat pill PR 1a: the pill as the app mounts it, once, in the app shell. It reads where the person is
 * and who they are, and asks the firm by handing the question to the Firm brain canvas (the answer builds there,
 * beside its threads). On a board it opens the board's own chat. Nothing about the question is kept or sent anywhere
 * but Ask the firm; the events say only which page the pill was opened on.
 */
export function ChatPillMount() {
  const { data: profile } = useProfile();
  const brand = useBrand();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const path = useRouterState({ select: (state) => state.location.pathname });
  const boardHandler = useAskLassoHandler();
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
      onAsk={async (question) => {
        // The canvas takes it once, for this person only, while it is fresh. Already on Firm brain, it hears at once.
        handOffQuestion(question, null, profileId, Date.now(), { fromHome: false });
        if (place !== "firm") await navigate({ to: "/firm-brain" });
        return { ok: true };
      }}
    />
  );
}

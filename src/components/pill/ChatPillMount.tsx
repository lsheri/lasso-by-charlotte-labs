import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { toast } from "sonner";

import { FirmSourcePreview } from "@/components/firm-brain/FirmSourcePreview";

import { useAskLassoHandler } from "@/components/reflect/ask-lasso-context";
import { useBrand } from "@/components/skin/use-skin";
import { useEngagementViews } from "@/hooks/use-engagement-views";
import { useEngagements } from "@/hooks/use-engagements";
import { useReducedMotion } from "@/hooks/use-motion";
import { useProfile } from "@/hooks/use-profile";
import {
  cornerOf,
  dockFor,
  dockSpots,
  nearestDock,
  PILL_COPY,
  PILL_DRAG_SLOP,
  PILL_HINTS,
  pillAccess,
  pillPlace,
  pillStarters,
  readDock,
  writeDock,
  type PillDock,
} from "@/lib/chat-pill-shared";
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
import { PillDockSpots, type DockSpot } from "./PillDockSpots";
import { PillLanding } from "./PillLanding";

/** 21 Nov 2026: the click-path step cards (Pane click-path-cards) say when one is open; the landing chat steps aside. */
export const STEP_CARD_EVENT = "lasso:step-card";
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
  // Phase 1c: where the pill sits, the person's own choice kept in this browser.
  const [saved, setSaved] = useState<PillDock | null>(null);
  const [width, setWidth] = useState(() => (typeof window === "undefined" ? 1280 : window.innerWidth));
  const [stepCard, setStepCard] = useState(false);
  const [startWith, setStartWith] = useState<{ id: number; text: string } | null>(null);
  const [moving, setMoving] = useState<{ picking: boolean; spots: DockSpot[]; active: PillDock | null } | null>(null);
  const press = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  useEffect(() => {
    if (pid) setSaved(readDock(typeof window === "undefined" ? null : window.localStorage, pid));
  }, [pid]);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    const onStep = (event: Event) => setStepCard(Boolean((event as CustomEvent<{ open?: boolean }>).detail?.open));
    window.addEventListener("resize", onResize);
    window.addEventListener(STEP_CARD_EVENT, onStep);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener(STEP_CARD_EVENT, onStep);
    };
  }, []);
  const onBoard = place === "board";
  const dock: PillDock = onBoard ? "bottom-right" : dockFor(saved, place, width);
  const landing = canAsk && place === "home" && dock === "center" && !stepCard;
  // Docked top right, the page keeps a strip clear at its top so the pill never sits on a page's own buttons.
  const topRight = !onBoard && !landing && dock === "top-right" && width >= 768;
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('[data-lasso="on"]');
    if (!root) return;
    if (topRight) root.setAttribute("data-pill-top", "");
    else root.removeAttribute("data-pill-top");
    return () => root.removeAttribute("data-pill-top");
  }, [topRight]);
  // The page goes soft behind the landing chat, with the shared focus blur (focus-blur-shared.ts).
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('[data-lasso="on"]');
    if (!root) return;
    if (landing) root.setAttribute("data-pill-landing", "");
    else root.removeAttribute("data-pill-landing");
    return () => root.removeAttribute("data-pill-landing");
  }, [landing]);

  const spotsNow = useCallback((): DockSpot[] => {
    const rail = document.querySelector<HTMLElement>(".lasso-sidebar-shell");
    return dockSpots({ width: window.innerWidth, height: window.innerHeight, railWidth: rail?.offsetWidth ?? 0 }, place === "home");
  }, [place]);
  const choose = useCallback(
    (next: PillDock) => {
      setSaved(next);
      if (pid) writeDock(window.localStorage, pid, next);
      setMoving(null);
    },
    [pid],
  );
  const onHandleDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button > 0) return;
      press.current = { x: event.clientX, y: event.clientY, moved: false };
      const move = (e: PointerEvent) => {
        const start = press.current;
        if (!start) return;
        if (!start.moved && Math.hypot(e.clientX - start.x, e.clientY - start.y) < PILL_DRAG_SLOP) return;
        start.moved = true;
        const spots = spotsNow();
        setMoving({ picking: false, spots, active: nearestDock({ x: e.clientX, y: e.clientY }, spots) });
      };
      const up = (e: PointerEvent) => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        const start = press.current;
        press.current = null;
        if (!start) return;
        const spots = spotsNow();
        // A drag drops into the nearest spot; a click opens the spots to pick from.
        if (start.moved) choose(nearestDock({ x: e.clientX, y: e.clientY }, spots));
        else setMoving({ picking: true, spots, active: null });
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [choose, spotsNow],
  );
  const spotsOn = width >= 640 && !onBoard;

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
        corner={cornerOf(dock)}
        hint={PILL_HINTS[place]}
        hidden={landing}
        startWith={startWith}
        onHandleDown={spotsOn ? onHandleDown : undefined}
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
      {landing ? (
        <PillLanding
          firstName={firstNameOf(profile.display_name)}
          welcome={PILL_COPY.welcomeFirm}
          hint={PILL_HINTS.home}
          onAsk={(text) => setStartWith({ id: Date.now(), text })}
          onHandleDown={onHandleDown}
          onHandleClick={() => undefined}
        />
      ) : null}
      {moving ? (
        <PillDockSpots spots={moving.spots} active={moving.active} current={dock} picking={moving.picking} onPick={choose} onClose={() => setMoving(null)} />
      ) : null}
      <FirmSourcePreview
        itemId={openItem}
        profileId={profileId}
        onClose={() => setOpenItem(null)}
      />
    </>
  );
}

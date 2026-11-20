import { useQuery } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useBrand } from "@/components/skin/use-skin";
import { FIRM_STORY_SCRIPT, type StoryPlace, type StoryRolePick } from "@/lib/firm-story-script";
import {
  FIRM_STORY_COPY,
  STORY_DONE,
  firstBeatFor,
  forgetOtherStoryBeats,
  invitedBySearch,
  isAtPlace,
  modeFromSearch,
  nextBeat,
  previousBeat,
  readStoredBeat,
  storyView,
  withProduct,
  writeStoredBeat,
  type StoryMode,
  type StoryReaction,
} from "@/lib/firm-story-shared";
import { firmStoryAccessFn } from "@/lib/firm-story.functions";
import { logEvent } from "@/lib/telemetry";

import { FirmStoryCard, type StoryWords } from "./FirmStoryCard";
import { FirmStorySpotlight } from "./FirmStorySpotlight";
import { useDialogOpen } from "./use-dialog-open";
import { useStoryLayout } from "./use-story-layout";

type StoryProfile = { id: string; org_id: string; demo_firm?: boolean | undefined } | null | undefined;

/**
 * The Kestrel Bay demo story, mounted once in the signed-in shell so it sits over the real surfaces: Home, Firm brain
 * and the proposal board. It can show only when the active profile is in the demo
 * firm's workspace, and the server agrees (firmStoryAccessFn). For everyone else it renders nothing and calls nothing.
 *
 * Even then the entry is opt-in: unless the address carries `?tour` or this person already started in this tab,
 * there is no start button, no request to the server and no watching of the page, so an ordinary demo of the firm
 * shows no trace of the story.
 *
 * The one thing it does for everyone: forget a story beat that someone else left in this tab's session storage.
 *
 * It writes no product rows. The beat number is kept in session storage; presenter mode, "exploring" and the taps on
 * a card live in memory. The firm_story.* events are emitted here and nowhere else.
 */
export function FirmStory({ profile }: { profile: StoryProfile }) {
  // The workspace's own demo marker (settings.demo_firm), never a fixed id; the server checks it again.
  const inDemoFirm = profile?.demo_firm === true;
  const profileId = profile?.id ?? null;
  const search = useRouterState({ select: (state) => state.location.searchStr ?? "" });

  // Whoever is signed in, in any workspace: a beat left in this tab by someone else is removed, never read.
  useEffect(() => {
    if (profileId) forgetOtherStoryBeats(profileId);
  }, [profileId]);

  // Opted in: the tour link was in the address at some point on this page, or this person's story was already under
  // way in this tab. It is remembered for that person only, and until the page is reloaded.
  const [optedIn, setOptedIn] = useState<string | null>(() => (profileId && hasOptedIn(profileId, here()) ? profileId : null));
  useEffect(() => {
    if (profileId && hasOptedIn(profileId, search)) setOptedIn(profileId);
  }, [search, profileId]);
  const invited = profileId !== null && optedIn === profileId;

  const readAccess = useServerFn(firmStoryAccessFn);
  const access = useQuery({
    queryKey: ["firm-story-access", profileId],
    // Not asked at all for a person who was not given the link and has not started.
    enabled: inDemoFirm && invited,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: () => readAccess({ data: { profile_id: profileId } }),
  });

  if (!inDemoFirm || !profile || !invited || !access.data?.allowed) return null;
  // Keyed by the person, so a change of profile starts from that person's own stored beat and nothing else.
  return <FirmStoryStage key={profile.id} profileId={profile.id} orgId={profile.org_id} window={access.data.window} boardId={access.data.boardId ?? null} />;
}

const here = () => globalThis.location?.search ?? "";
const hasOptedIn = (profileId: string, search: string) => invitedBySearch(search) || readStoredBeat(profileId) !== null;

/** Wide screens: the frame starts past the sidebar, by the sidebar's own width token, or past the board's 52px rail. */
const PAST_SIDEBAR = "md:pl-[calc(var(--nav-width)+0.875rem)]";
const PAST_BOARD_RAIL = "md:pl-[calc(52px+1rem)]";

export function FirmStoryStage({
  profileId,
  orgId,
  window: storyWindow,
  boardId = null,
}: {
  profileId: string;
  orgId: string;
  window: "partner" | "lead";
  /** The story board in this demo workspace, from the server; null when it is not there. */
  boardId?: string | null;
}) {
  const brand = useBrand();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  // The stage is mounted only for a person who opted in, so the page is watched for dialogs only for them.
  const dialogOpen = useDialogOpen(true);

  // Read in the first render, not in an effect: a reload mid-story must not paint the start button for a frame.
  const [beat, setBeatState] = useState<number | null>(() => readStoredBeat(profileId));
  const [exploring, setExploring] = useState(false);
  const [mode, setMode] = useState<StoryMode>(() => modeFromSearch(here()));
  const [reactions, setReactions] = useState<Record<number, StoryReaction>>({});
  const [rolePick, setRolePick] = useState<StoryRolePick | null>(null);

  // After End tour or Explore the pressed button is gone with its card: hand the keyboard to the button that
  // replaces it, so the next Tab does not start from the top of the page.
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const focusLauncher = useRef(false);
  useEffect(() => {
    if (!focusLauncher.current || !launcherRef.current) return;
    focusLauncher.current = false;
    launcherRef.current.focus();
  });

  const version = FIRM_STORY_SCRIPT.version;
  const emit = useCallback(
    (event: Parameters<typeof logEvent>[0], dims: Record<string, string | number>) => logEvent(event, orgId, { ...dims, script_version: version }),
    [orgId, version],
  );

  const goTo = useCallback(
    (place: StoryPlace | null) => {
      if (place === "home") void navigate({ to: "/home" });
      else if (place === "firm") void navigate({ to: "/firm-brain" });
      else if (place === "board" && boardId) void navigate({ to: "/engagements/$id/canvas-lab", params: { id: boardId } });
    },
    [navigate, boardId],
  );

  /** Stores a beat and, when this window plays it somewhere else, goes there. */
  const moveTo = useCallback(
    (n: number) => {
      writeStoredBeat(profileId, n);
      setBeatState(n);
      setExploring(false);
      const view = storyView(storyWindow, n);
      if (view.kind === "beat" && !isAtPlace(view.beat.place, globalThis.location?.pathname ?? "", boardId)) goTo(view.beat.place);
    },
    [goTo, profileId, storyWindow],
  );

  /** Ends the story in this tab: the beat is forgotten and the taps on the cards with it. The start button returns. */
  const end = useCallback(() => {
    writeStoredBeat(profileId, null);
    setBeatState(null);
    setExploring(false);
    setReactions({});
    setRolePick(null);
    focusLauncher.current = true;
  }, [profileId]);

  const view = storyView(storyWindow, beat);
  // The beat's target is brought into sight, and the card steps aside when it would cover it. Only while a beat with
  // a target is showing on its own page; otherwise the card stays in its usual place.
  const cardWrap = useRef<HTMLDivElement | null>(null);
  const pointing = view.kind === "beat" && view.beat.anchor && isAtPlace(view.beat.place, pathname, boardId) && !exploring && !dialogOpen;
  const layout = useStoryLayout(
    pointing ? view.beat.anchor : null,
    view.kind === "beat" ? view.beat.n : null,
    cardWrap,
    view.kind === "beat" && view.beat.phoneCardAtTop === true,
    view.kind === "beat" ? (view.beat.wideCardAt ?? null) : null,
  );
  // An open dialog wins: the card collapses, and the frame drops below the dialogs' layer, so every dialog and its
  // scrim sit over it wherever they are in the page. Otherwise it is above the board page, a full-screen layer.
  const layer = dialogOpen ? "z-(--layer-tabbar)" : "z-(--layer-ledger)";
  // Wide screens: bottom left, past the sidebar (or the board page's narrow rail), never over the sidebar's footer.
  const gutter = /\/canvas-lab(\/|$)/.test(pathname) ? PAST_BOARD_RAIL : PAST_SIDEBAR;
  const frame = `pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] ${layer} flex justify-center px-4 md:bottom-4 md:justify-start ${gutter} print:hidden`;

  if (view.kind === "idle" || exploring || dialogOpen) {
    const resuming = view.kind !== "idle";
    return (
      <div className={frame} data-testid="firm-story">
        <div className="pointer-events-auto flex items-center gap-1 rounded-[var(--radius)] bg-card">
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="firm-story-launcher"
            ref={launcherRef}
            onClick={() => {
              if (resuming) {
                setExploring(false);
                return;
              }
              emit("firm_story.started", { mode, window: storyWindow });
              setReactions({});
              setRolePick(null);
              moveTo(firstBeatFor(storyWindow));
            }}
          >
            {resuming ? FIRM_STORY_COPY.resume : FIRM_STORY_COPY.start}
          </Button>
          {resuming ? (
            <Button type="button" variant="ghost" size="sm" data-story-end onClick={end}>
              {FIRM_STORY_COPY.end}
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  const shown = view.kind === "beat" ? view.beat : view.kind === "handoff" ? view.to : null;
  const fill = (text: string) => withProduct(text, brand.name);
  const words: StoryWords = {
    demoLine: fill(FIRM_STORY_SCRIPT.demoLine),
    closing: fill(FIRM_STORY_SCRIPT.closing),
    rolePrompt: fill(FIRM_STORY_SCRIPT.rolePick.prompt),
    roleChoices: FIRM_STORY_SCRIPT.rolePick.choices,
    // A handoff names the other window's character; a beat shows its own words.
    title: view.kind === "handoff" ? view.to.youAre : fill(shown?.title ?? ""),
    caption: fill(shown?.caption ?? ""),
    notes: fill(shown?.notes ?? ""),
    question: fill(shown?.question ?? ""),
    ask: view.kind === "beat" && shown?.ask ? fill(shown.ask) : null,
  };
  const atPlace = view.kind !== "beat" || isAtPlace(view.beat.place, pathname, boardId);

  return (
    <>
      {view.kind === "beat" && view.beat.anchor && atPlace ? <FirmStorySpotlight anchor={view.beat.anchor} /> : null}
      <div className={frame} style={layout.style} data-testid="firm-story" data-story-placement={layout.placement}>
        <div ref={cardWrap} className="pointer-events-none w-full max-w-[26rem]">
          <FirmStoryCard
            view={view}
            words={words}
            mode={mode}
            goLabel={view.kind === "beat" && view.beat.place && !atPlace ? FIRM_STORY_COPY.open[view.beat.place] : null}
            reaction={view.kind === "beat" ? (reactions[view.beat.n] ?? null) : null}
            rolePick={rolePick}
            canGoBack={beat !== null && previousBeat(storyWindow, beat) !== beat}
            onMode={setMode}
            onGo={() => (view.kind === "beat" ? goTo(view.beat.place) : undefined)}
            onNext={() => {
              if (beat === null) return;
              const next = nextBeat(beat);
              if (next >= STORY_DONE) emit("firm_story.finished", { mode });
              moveTo(next);
            }}
            onBack={() => (beat === null ? undefined : moveTo(previousBeat(storyWindow, beat)))}
            onExplore={() => {
              if (shown) emit("firm_story.explored", { beat: shown.n, mode });
              focusLauncher.current = true;
              setExploring(true);
            }}
            onResumeHere={() => (view.kind === "handoff" && view.resumeAt !== null ? moveTo(view.resumeAt) : undefined)}
            onReact={(reaction) => {
              if (view.kind !== "beat" || reactions[view.beat.n] === reaction) return;
              setReactions((current) => ({ ...current, [view.beat.n]: reaction }));
              emit("firm_story.reacted", { beat: view.beat.n, reaction, mode });
            }}
            onRolePick={(pick) => {
              if (rolePick === pick) return;
              setRolePick(pick);
              emit("firm_story.role_picked", { role_pick: pick, mode });
            }}
            onEnd={end}
          />
        </div>
      </div>
    </>
  );
}

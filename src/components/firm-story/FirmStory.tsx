import { useQuery } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useBrand } from "@/components/skin/use-skin";
import { useFeatureFlag } from "@/hooks/use-feature-flag";
import { FIRM_STORY_SCRIPT, type StoryPlace, type StoryRolePick } from "@/lib/firm-story-script";
import {
  FIRM_STORY_COPY,
  KESTREL_BAY_ORG_ID,
  STORY_BOARD_ID,
  STORY_DONE,
  firstBeatFor,
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

type StoryProfile = { id: string; org_id: string } | null | undefined;

/**
 * The Kestrel Bay demo story, mounted once in the signed-in shell so it sits over the real surfaces: Home, the firm
 * view and the proposal board. It can show only when the company-brain flag is on, the active profile is in the demo
 * firm's workspace, and the server agrees (firmStoryAccessFn). For everyone else it renders nothing and calls nothing.
 *
 * Even then the entry is opt-in: there is no start button unless the address carries `?tour` or this person already
 * started in this tab, so an ordinary demo of the firm shows no trace of the story.
 *
 * It writes no product rows. The beat number is kept in session storage; presenter mode, "exploring" and the taps on
 * a card live in memory. The firm_story.* events are emitted here and nowhere else.
 */
export function FirmStory({ profile }: { profile: StoryProfile }) {
  const flag = useFeatureFlag("company-brain");
  const inDemoFirm = profile?.org_id === KESTREL_BAY_ORG_ID;
  const readAccess = useServerFn(firmStoryAccessFn);
  const access = useQuery({
    queryKey: ["firm-story-access", profile?.id ?? null],
    enabled: flag && inDemoFirm,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: () => readAccess({ data: { profile_id: profile?.id ?? null } }),
  });

  if (!flag || !inDemoFirm || !profile || !access.data?.allowed) return null;
  // Keyed by the person, so a change of profile starts from that person's own stored beat and nothing else.
  return <FirmStoryStage key={profile.id} profileId={profile.id} orgId={profile.org_id} window={access.data.window} />;
}

const here = () => globalThis.location?.search ?? "";

function FirmStoryStage({ profileId, orgId, window: storyWindow }: { profileId: string; orgId: string; window: "partner" | "lead" }) {
  const brand = useBrand();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const search = useRouterState({ select: (state) => state.location.searchStr ?? "" });
  const dialogOpen = useDialogOpen();

  // Read in the first render, not in an effect: a reload mid-story must not paint the start button for a frame.
  const [beat, setBeatState] = useState<number | null>(() => readStoredBeat(profileId));
  // Opted in: the tour link was in the address at some point on this page, or the story was already under way.
  const [invited, setInvited] = useState(() => invitedBySearch(here()) || readStoredBeat(profileId) !== null);
  const [exploring, setExploring] = useState(false);
  const [mode, setMode] = useState<StoryMode>(() => modeFromSearch(here()));
  const [reactions, setReactions] = useState<Record<number, StoryReaction>>({});
  const [rolePick, setRolePick] = useState<StoryRolePick | null>(null);

  useEffect(() => {
    if (invitedBySearch(search)) setInvited(true);
  }, [search]);

  const version = FIRM_STORY_SCRIPT.version;
  const emit = useCallback(
    (event: Parameters<typeof logEvent>[0], dims: Record<string, string | number>) => logEvent(event, orgId, { ...dims, script_version: version }),
    [orgId, version],
  );

  const goTo = useCallback(
    (place: StoryPlace | null) => {
      if (place === "home") void navigate({ to: "/home" });
      else if (place === "firm") void navigate({ to: "/firm" });
      else if (place === "board") void navigate({ to: "/engagements/$id/canvas-lab", params: { id: STORY_BOARD_ID } });
    },
    [navigate],
  );

  /** Stores a beat and, when this window plays it somewhere else, goes there. */
  const moveTo = useCallback(
    (n: number) => {
      writeStoredBeat(profileId, n);
      setBeatState(n);
      setExploring(false);
      const view = storyView(storyWindow, n);
      if (view.kind === "beat" && !isAtPlace(view.beat.place, globalThis.location?.pathname ?? "")) goTo(view.beat.place);
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
  }, [profileId]);

  const view = storyView(storyWindow, beat);
  if (view.kind === "idle" && !invited) return null;

  // An open dialog wins: the card collapses, and the frame drops to the dialogs' own layer, where the dialog and
  // its scrim (later in the page) sit over it. Otherwise it is above the board page, a full-screen layer of its own.
  const layer = dialogOpen ? "z-(--layer-backdrop)" : "z-(--layer-ledger)";
  // Wide screens: bottom left, past the sidebar (or the board page's narrow rail), never over the sidebar's footer.
  const gutter = /\/canvas-lab(\/|$)/.test(pathname) ? "md:pl-[4.25rem]" : "md:pl-[17rem]";
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
  const atPlace = view.kind !== "beat" || isAtPlace(view.beat.place, pathname);

  return (
    <>
      {view.kind === "beat" && view.beat.anchor && atPlace ? <FirmStorySpotlight anchor={view.beat.anchor} /> : null}
      <div className={frame} data-testid="firm-story">
        <div className="pointer-events-none w-full max-w-[26rem]">
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

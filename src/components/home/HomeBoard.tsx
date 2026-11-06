import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { BoardShell, type BoardShellFrame } from "@/components/board/BoardShell";
import { NewEngagementDialog } from "@/components/engagements/NewEngagementDialog";
import { HomeEngagementGrid, homeGridHeight } from "@/components/home/HomeEngagementGrid";
import { SHARED_WITH_YOU_COPY, useAcceptBoardShare, useSharedWithYou, type PendingInviteRow } from "@/components/layout/SharedWithYou";
import { LassoThinkingMark } from "@/components/reflect/LassoThinkingMark";
import { Button } from "@/components/ui/button";
import { useEngagements } from "@/hooks/use-engagements";
import { useEngagementViews } from "@/hooks/use-engagement-views";
import { useEngagementWorkCounts } from "@/hooks/use-engagement-work-counts";
import { useEngagementBoardPreviews } from "@/hooks/use-engagement-board-previews";
import { useProfile } from "@/hooks/use-profile";
import { useWorkItems } from "@/hooks/use-work-items";
import { emitClientEvent } from "@/lib/client-telemetry";
import { logEvent } from "@/lib/telemetry";
import type { HomeGridEngagement } from "@/lib/home-grid";
import { LOOP_SIZE_TITLE } from "@/lib/lasso-loop";

const HOME_VIEWPORT_SEED = { width: 980, height: 720 };
const BOARD_FIT_PADDING = 32;
export const HOME_CONTENT_WIDTH = 930;
const HOME_CONTENT_TOP = 186;
const HOME_FRAME_GAP = 24;
// Measured in Chromium at the 150% type and control sizes below.
export const HOME_HERO_CONTENT_HEIGHT = 286;
export const HOME_HERO_BOTTOM_MARGIN = 48;
export const HOME_HERO_FRAME_HEIGHT = HOME_CONTENT_TOP - BOARD_FIT_PADDING + HOME_HERO_CONTENT_HEIGHT + HOME_HERO_BOTTOM_MARGIN;

type HomeFrame = BoardShellFrame & { kind: "hero" | "grid" };

export function homeFramesForViewport(
  viewport: { width: number; height: number },
  cardCount: number,
  pendingHeight = 0,
): HomeFrame[] {
  const width = Math.max(1, viewport.width - BOARD_FIT_PADDING * 2);
  const hero: HomeFrame = {
    id: "home-hero",
    kind: "hero",
    x: BOARD_FIT_PADDING,
    y: BOARD_FIT_PADDING,
    width,
    height: HOME_HERO_FRAME_HEIGHT,
  };
  const grid: HomeFrame = {
    id: "home-grid",
    kind: "grid",
    x: BOARD_FIT_PADDING,
    y: hero.y + hero.height + HOME_FRAME_GAP,
    width,
    height: homeGridHeight(cardCount, width) + (cardCount > 0 ? 12 : 0) + (pendingHeight > 0 ? pendingHeight + HOME_FRAME_GAP : 0),
  };
  return [hero, grid];
}

export function ideasMailto(idea: string): string {
  const params = new URLSearchParams({ subject: "Lasso product idea", body: idea });
  return `mailto:liam@charlotte-labs.com?${params.toString()}`;
}

export function openIdeasMailClient(idea: string): void {
  window.location.assign(ideasMailto(idea));
}

export const CONNECT_PROMPT_LINE = "Lasso fills from the AI tools you already use. Connect one to bring in your first piece of work.";

/** NAV-1d: true only once the work count is known and is zero, read the way use-nav-ctx.ts reads it. */
export function useShowConnectPrompt(): boolean {
  const { data: work } = useWorkItems();
  return work ? work.items.length === 0 : false;
}

/** NAV-1d: the empty-workspace connect prompt. Renders nothing unless the work count is known and zero. */
export function ConnectToolsPrompt() {
  const show = useShowConnectPrompt();
  if (!show) return null;
  return (
    <div data-testid="home-connect-prompt" className="mx-auto mt-6 flex max-w-[780px] flex-col items-center gap-3">
      <p className="text-[17px] leading-[1.5] text-muted-foreground">{CONNECT_PROMPT_LINE}</p>
      <Button asChild type="button" variant="ink" className="h-11 px-6 text-[16px]">
        <Link to="/connectors" onClick={() => emitClientEvent("home.connect_tools_opened", {})}>
          Connect your AI tools
        </Link>
      </Button>
    </div>
  );
}

export function IdeasNote({ openMailClient = openIdeasMailClient }: { openMailClient?: (idea: string) => void }) {
  const [idea, setIdea] = useState("");
  const canSend = idea.trim().length > 0;

  function compose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend) return;
    emitClientEvent("home.ideas_note_composed", {});
    openMailClient(idea);
  }

  return (
    <form onSubmit={compose} className="mt-3 w-full text-left">
      <label htmlFor="home-product-idea" className="font-mono text-[13.5px] uppercase tracking-[0.08em] text-muted-foreground">
        Have product ideas? Drop us a note
      </label>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-3">
        <input
          id="home-product-idea"
          value={idea}
          onChange={(event) => setIdea(event.target.value)}
          placeholder="What would make this better?"
          className="h-[66px] min-w-0 rounded-[var(--radius-control)] border border-input bg-card px-[18px] text-[21.75px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button type="submit" variant="ink" className="h-[66px] px-[30px] text-[19.5px]" disabled={!canSend}>
          Send
        </Button>
      </div>
    </form>
  );
}

function HomePendingInvites({ pending, onHeight }: { pending: PendingInviteRow[]; onHeight: (height: number) => void }) {
  const accept = useAcceptBoardShare();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => onHeight(Math.ceil(element.getBoundingClientRect().height));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [onHeight, pending.length]);
  return <div ref={ref} className="mb-6" data-testid="home-pending-invites">
    <ul className="grid gap-4">
      {pending.map((invite) => <li key={invite.invite_id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-[var(--radius-control)] border border-dashed border-border bg-card p-4">
        <div className="min-w-0">
          <p className="break-words font-mono text-[13px] text-[var(--nb-shared)]">{SHARED_WITH_YOU_COPY.inviteLabel}</p>
          <h3 className="break-words text-[19.5px] text-foreground">{invite.board}</h3>
          <p className="text-base text-muted-foreground">{SHARED_WITH_YOU_COPY.invited(invite.invited_by)}</p>
        </div>
        <Button variant="outline" disabled={busy !== null} onClick={async () => {
          setBusy(invite.invite_id);
          setError(null);
          try {
            const message = await accept(invite.code, invite.level, "home");
            if (message) setError(message);
          } catch {
            setError(SHARED_WITH_YOU_COPY.failed);
          } finally {
            setBusy(null);
          }
        }}>{SHARED_WITH_YOU_COPY.accept}</Button>
      </li>)}
    </ul>
    {error ? <p role="alert" className="mt-3 text-base text-destructive">{error}</p> : null}
  </div>;
}

export function HomeBoard() {
  const { data: profile } = useProfile();
  const { shared, pending } = useSharedWithYou(Boolean(profile?.id));
  const { data: engagements } = useEngagements(profile?.id);
  const [viewport, setViewport] = useState(HOME_VIEWPORT_SEED);
  const [pendingHeight, setPendingHeight] = useState(0);

  // CS-1: one home.opened per mount and org, through the same signed-in
  // pipeline as nav.opened, and only once the acting profile has resolved.
  // TL-1b: a workspace switch keeps Home mounted, so guard on the org, not a
  // boolean — a new orgId emits again, the same orgId never emits twice.
  const homeOpenedRef = useRef<string | null>(null);
  const orgId = profile?.org_id;
  useEffect(() => {
    if (!orgId || homeOpenedRef.current === orgId) return;
    homeOpenedRef.current = orgId;
    logEvent("home.opened", orgId, {});
  }, [orgId]);

  const showConnectPrompt = useShowConnectPrompt();
  const countLabel = engagements ? `HOME · ${engagements.length + shared.length} WORKBOARDS` : "HOME";
  const { data: views } = useEngagementViews(profile?.id);
  const { data: workCounts } = useEngagementWorkCounts(engagements?.map((e) => e.id));
  const { previews } = useEngagementBoardPreviews([...(engagements ?? []).map((e) => e.id), ...shared.map((e) => e.engagement_id)]);
  const viewedAt = new Map((views ?? []).map((row) => [row.engagement_id, row.last_viewed_at]));
  const cards: HomeGridEngagement[] = [...(engagements ?? []).map((engagement) => ({
    id: engagement.id,
    code: engagement.code,
    title: engagement.title,
    clientLabel: engagement.clients?.name ?? engagement.client_label,
    lastViewedAt: viewedAt.get(engagement.id) ?? null,
    workCount: workCounts ? workCounts.get(engagement.id) ?? 0 : null,
  })), ...shared.map((board) => ({
    id: board.engagement_id,
    code: "",
    title: board.title,
    clientLabel: board.host_org,
    lastViewedAt: viewedAt.get(board.engagement_id) ?? board.added_at,
    workCount: null,
    shared: { hostOrg: board.host_org, addedAt: board.added_at },
  }))];
  const frames = homeFramesForViewport(viewport, cards.length, pending.length > 0 ? pendingHeight : 0);
  const contentHeight = Math.max(...frames.map((frame) => frame.y + frame.height)) + BOARD_FIT_PADDING;

  return (
    <div
      data-testid="home-board-viewport"
      className="min-h-[calc(100vh-6.5rem)]"
      style={{ height: contentHeight }}
    >
      <BoardShell
        ariaLabel="Home board"
        frames={frames}
        nodes={[]}
        showViewControls
        showZoomControls={false}
        lockZoom
        nativeScroll
        onViewportSizeChange={(size) => {
          setViewport((current) => current.width === size.width && current.height === size.height ? current : size);
        }}
        toolbar={(
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 md:flex-nowrap">
            <span data-testid="home-count-label" className="mr-auto basis-full whitespace-normal font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground md:basis-auto md:truncate">
              {countLabel}
            </span>
            <NewEngagementDialog
              from="home"
              trigger={(
                <Button type="button" variant={showConnectPrompt ? "outline" : "ink"} className="h-9" onClick={() => emitClientEvent("home.new_engagement_started", {})}>
                  New workboard
                </Button>
              )}
            />
            <Button asChild type="button" variant="outline" className="h-9" onClick={() => emitClientEvent("home.past_work_opened", {})}>
              <Link to="/archive">Look back</Link>
            </Button>
          </div>
        )}
        renderFrame={(currentFrame) => currentFrame.kind === "hero" ? (
          <section
            data-testid="home-hero-content"
            aria-labelledby="home-title"
            className="absolute left-1/2 w-[930px] max-w-[calc(100%-32px)] -translate-x-1/2 text-center"
            style={{ top: HOME_CONTENT_TOP - BOARD_FIT_PADDING }}
          >
            <div className="flex items-center justify-center gap-3">
              <LassoThinkingMark kind="signature" size={LOOP_SIZE_TITLE} thinking />
              <h1 id="home-title" className="font-serif text-[66px] font-normal leading-[1.05] text-foreground">
                Welcome to Lasso
              </h1>
            </div>
            <p className="mx-auto mt-6 max-w-[780px] text-[21.75px] leading-[1.6] text-muted-foreground">
              Every AI conversation, document and decision from your work, kept in one place that belongs to you. Nothing here was written by Lasso.
            </p>
            <ConnectToolsPrompt />
            <div className="mx-auto mt-[18px]" style={{ maxWidth: HOME_CONTENT_WIDTH }}>
              <IdeasNote />
            </div>
          </section>
        ) : (
          <>
          {pending.length > 0 ? <HomePendingInvites pending={pending} onHeight={setPendingHeight} /> : null}
          <HomeEngagementGrid
            cards={cards}
            availableWidth={currentFrame.width}
            previews={previews}
            onOpen={() => emitClientEvent("home.engagement_opened", {})}
          />
          </>
        )}
        renderNode={() => null}
      />
    </div>
  );
}
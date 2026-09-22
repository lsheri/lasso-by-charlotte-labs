import { Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";

import { BoardShell, type BoardShellFrame } from "@/components/board/BoardShell";
import { NewEngagementDialog } from "@/components/engagements/NewEngagementDialog";
import { HomeEngagementGrid } from "@/components/home/HomeEngagementGrid";
import { LassoThinkingMark } from "@/components/reflect/LassoThinkingMark";
import { Button } from "@/components/ui/button";
import { useEngagements } from "@/hooks/use-engagements";
import { useEngagementViews } from "@/hooks/use-engagement-views";
import { useEngagementWorkCounts } from "@/hooks/use-engagement-work-counts";
import { useProfile } from "@/hooks/use-profile";
import { emitClientEvent } from "@/lib/client-telemetry";
import type { HomeGridEngagement } from "@/lib/home-grid";
import { LOOP_SIZE_TITLE } from "@/lib/lasso-loop";

const HOME_VIEWPORT_SEED = { width: 980, height: 720 };
const BOARD_FIT_PADDING = 32;
const HOME_CONTENT_WIDTH = 620;
const HOME_CONTENT_TOP = 186;

type HomeFrame = BoardShellFrame & { kind: "home" };

export function homeFrameForViewport(viewport: { width: number; height: number }): HomeFrame {
  return {
    id: "home-surface",
    kind: "home",
    x: BOARD_FIT_PADDING,
    y: BOARD_FIT_PADDING,
    width: Math.max(1, viewport.width - BOARD_FIT_PADDING * 2),
    height: Math.max(1, viewport.height - BOARD_FIT_PADDING * 2),
  };
}

export function ideasMailto(idea: string): string {
  const params = new URLSearchParams({ subject: "Lasso product idea", body: idea });
  return `mailto:liam@charlotte-labs.com?${params.toString()}`;
}

export function openIdeasMailClient(idea: string): void {
  window.location.assign(ideasMailto(idea));
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
      <label htmlFor="home-product-idea" className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
        Have product ideas? Drop us a note
      </label>
      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <input
          id="home-product-idea"
          value={idea}
          onChange={(event) => setIdea(event.target.value)}
          placeholder="What would make this better?"
          className="h-11 min-w-0 rounded-[var(--radius-control)] border border-input bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button type="submit" variant="ink" className="h-11 px-5" disabled={!canSend}>
          Send
        </Button>
      </div>
    </form>
  );
}

export function HomeBoard() {
  const { data: profile } = useProfile();
  const { data: engagements } = useEngagements(profile?.id);
  const [viewport, setViewport] = useState(HOME_VIEWPORT_SEED);

  useEffect(() => {
    emitClientEvent("home.opened", {});
  }, []);

  const frame = homeFrameForViewport(viewport);
  const countLabel = engagements ? `HOME · ${engagements.length} ENGAGEMENTS` : "HOME";

  return (
    <div
      data-testid="home-board-viewport"
      // Desktop chrome is AppShell's 48px top padding plus 56px bottom padding.
      className="h-[calc(100vh-6.5rem)] overflow-hidden"
    >
      <BoardShell
        ariaLabel="Home board"
        frames={[frame]}
        nodes={[]}
        showViewControls
        onViewportSizeChange={(size) => {
          setViewport((current) => current.width === size.width && current.height === size.height ? current : size);
        }}
        toolbar={(
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="mr-auto truncate font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
              {countLabel}
            </span>
            <NewEngagementDialog
              from="home"
              trigger={(
                <Button type="button" variant="ink" className="h-9" onClick={() => emitClientEvent("home.new_engagement_started", {})}>
                  New engagement
                </Button>
              )}
            />
            <Button asChild type="button" variant="outline" className="h-9" onClick={() => emitClientEvent("home.past_work_opened", {})}>
              <Link to="/archive">Past work</Link>
            </Button>
          </div>
        )}
        renderFrame={() => (
          <section
            aria-labelledby="home-title"
            className="absolute left-1/2 w-[620px] max-w-[calc(100%-32px)] -translate-x-1/2 text-center"
            style={{ top: HOME_CONTENT_TOP - BOARD_FIT_PADDING }}
          >
            <div className="flex items-center justify-center gap-3">
              <LassoThinkingMark kind="signature" size={LOOP_SIZE_TITLE} />
              <h1 id="home-title" className="font-serif text-[44px] font-normal leading-[1.05] text-foreground">
                Welcome to Lasso
              </h1>
            </div>
            <p className="mx-auto mt-4 max-w-[520px] text-[14.5px] leading-[1.6] text-muted-foreground">
              Every AI conversation, document and decision from your work, kept in one place that belongs to you. Nothing here was written by Lasso.
            </p>
            <div className="mx-auto mt-3" style={{ maxWidth: HOME_CONTENT_WIDTH }}>
              <IdeasNote />
            </div>
          </section>
        )}
        renderNode={() => null}
      />
    </div>
  );
}
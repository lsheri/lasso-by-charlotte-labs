import { Link } from "@tanstack/react-router";

import { ArrowUpRight } from "@/design/brand/icons";
import { useReducedMotion } from "@/hooks/use-motion";
import type { FirmCanvasData } from "@/lib/firm-canvas-shared";
import { ORB_COPY } from "@/lib/firm-orb-shared";
import { firstNameOf, HOME_ASK_COPY } from "@/lib/home-ask-shared";
import { FIRM_VIEW_COPY } from "@/lib/role-screens-shared";

import { FirmOrb } from "./FirmOrb";

/**
 * 21 Nov, D-85 PR B: Home's mini firm brain, with the firm map as a turning sphere at its centre (Liam: "3d orb as
 * center for non admins").
 *
 * 20 Nov 2026, chat pill PR 1b (D-97): Home has no question box of its own any more. The chat pill is the one place to
 * ask, on every page (the prototype: "Home has no ask box here: the chat pill is the one place to ask"). Home keeps
 * the greeting, the orb, how many past engagements the firm can learn from, and a way into Firm brain. With nothing
 * shared yet it says so in one line, where the orb would be.
 */
export function HomeAsk({
  displayName,
  map = null,
  mapLoading = false,
  now = new Date(),
}: {
  displayName: string | null | undefined;
  /** The firm map for the orb, as the server sent it (fees for admins and leads only). Null while it loads. */
  map?: FirmCanvasData | null | undefined;
  /** The map is on its way: the orb's place shows a quiet frame. */
  mapLoading?: boolean;
  now?: Date;
}) {
  const reduceMotion = useReducedMotion();
  const engagements = map?.threads.length ?? 0;

  return (
    <section data-testid="home-ask" aria-labelledby="home-title" className="flex flex-col gap-5">
      <h1
        id="home-title"
        className="text-center text-(length:--type-display) font-semibold text-foreground [text-wrap:balance]"
      >
        {HOME_ASK_COPY.greeting(now.getHours(), firstNameOf(displayName))}
      </h1>
      {mapLoading ? (
        <div
          aria-hidden
          data-testid="firm-orb-loading"
          className="mx-auto grid h-[300px] w-full place-items-center max-md:h-[240px]"
        >
          <div className="aspect-square h-[78%] animate-pulse rounded-[var(--radius-pill)] border border-dashed border-border" />
        </div>
      ) : engagements > 0 ? (
        <div className="flex flex-col items-center gap-1">
          <FirmOrb data={map!} reduceMotion={reduceMotion} />
          <p
            data-testid="firm-orb-caption"
            className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center text-(length:--type-small) text-muted-foreground"
          >
            <span>{ORB_COPY.learnFrom(engagements)}</span>
            <Link
              to="/firm-brain"
              className="inline-flex items-center gap-1.5 rounded-[var(--corner-panel)] border border-border px-3 py-1.5 font-semibold text-foreground hover:bg-secondary"
            >
              <ArrowUpRight aria-hidden className="size-4" />
              {FIRM_VIEW_COPY.openFirmBrain}
            </Link>
          </p>
        </div>
      ) : map ? (
        <p
          data-testid="firm-orb-empty"
          className="text-center text-(length:--type-small) text-muted-foreground"
        >
          {ORB_COPY.empty} {ORB_COPY.emptyNext}
        </p>
      ) : null}
    </section>
  );
}

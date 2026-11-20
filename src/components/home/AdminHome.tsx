import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { RollDown } from "@/components/layout/RollDown";
import { useProposalDesk } from "@/components/proposals/use-proposal-desk";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonFrame } from "@/components/ui/skeleton-frame";
import {
  ADMIN_HOME_COPY,
  ADMIN_HOME_REFRESH_MS,
  arrivedIds,
  buildAdminFeed,
  feedTime,
  openCount,
  type AdminFeed,
  type FeedItem,
  type NextStep,
} from "@/lib/admin-home-shared";
import { listMyNotifications } from "@/lib/notifications.functions";
import { OPEN_NOTIFICATIONS_EVENT, type NotificationRow } from "@/lib/notifications-shared";
import { homeShowsProposals } from "@/lib/role-screens-shared";
import { listRosterFn } from "@/lib/roster.functions";
import { cn } from "@/lib/utils";

type HomeProfile = { id?: string | null; role?: string | null; has_firm_view?: boolean | null; org_type?: string | null; is_guest?: boolean | null };

/**
 * 21 Nov 2026, D-82: an admin's Home is the operating picture and nothing else. It reads the same three things the
 * app already reads for this admin (the proposals, People we work with, and their notifications), from the same
 * cache entries as the Proposals page and the bell, and reads them again on focus and once a minute (D-85).
 */
export function AdminHome({ profile }: { profile: HomeProfile | null | undefined }) {
  const show = homeShowsProposals(profile);
  const profileId = show ? (profile?.id ?? undefined) : undefined;
  const desk = useProposalDesk(profileId, { refreshMs: ADMIN_HOME_REFRESH_MS });
  const roster = useQuery({
    queryKey: ["proposal-desk-roster", profileId],
    enabled: Boolean(profileId),
    staleTime: 30_000,
    retry: false,
    refetchInterval: ADMIN_HOME_REFRESH_MS,
    queryFn: () => listRosterFn({ data: { profile_id: profileId as string } }),
  });
  const notifications = useQuery({
    queryKey: ["notifications"],
    enabled: Boolean(profileId),
    staleTime: 30_000,
    refetchInterval: ADMIN_HOME_REFRESH_MS,
    queryFn: async () => (await listMyNotifications()) as unknown as NotificationRow[],
  });
  const navigate = useNavigate();
  if (!show) return null;

  const settled = !desk.isLoading && !roster.isLoading && !notifications.isLoading;
  const feed = buildAdminFeed({
    desk: desk.data,
    roster: roster.data?.allowed ? roster.data.contacts : undefined,
    notifications: notifications.data,
    now: new Date(),
  });
  const failed = Boolean(desk.error || roster.error || notifications.error);

  return (
    <AdminWhatChanged
      feed={settled ? feed : null}
      failed={failed}
      open={desk.data ? openCount(desk.data) : null}
      onRetry={() => {
        if (desk.error) void desk.refetch();
        if (roster.error) void roster.refetch();
        if (notifications.error) void notifications.refetch();
      }}
      onStep={(step) => {
        if (step.to === "notifications") window.dispatchEvent(new Event(OPEN_NOTIFICATIONS_EVENT));
        else if (step.to === "/engagements/$id/canvas-lab") void navigate({ to: step.to, params: step.params });
        else if (step.to === "/proposals") void navigate({ to: step.to, search: step.search });
        else void navigate({ to: step.to });
      }}
    />
  );
}

/**
 * The two lists, drawn from plain values so it can be rendered in a test. `feed` is null until the first read has
 * settled; after that, an item that was not there on the last read grows in with a quiet lime mark.
 */
export function AdminWhatChanged({
  feed,
  failed,
  open,
  onRetry,
  onStep,
}: {
  feed: AdminFeed | null;
  failed: boolean;
  /** Open proposals, for the one tap into Proposals. Null while unknown. */
  open: number | null;
  onRetry: () => void;
  onStep: (step: NextStep) => void;
}) {
  const C = ADMIN_HOME_COPY;
  const seen = useRef<Set<string> | null>(null);
  const shown = useRef<string>("");
  const arrived = useRef<Set<string>>(new Set());
  const [pressed, setPressed] = useState<string | null>(null);

  if (feed) {
    const items = [...feed.waiting, ...feed.today];
    const key = items.map((item) => item.id).join("|");
    // Worked out once per change in what is listed, so a re-render never marks an item as new twice.
    if (key !== shown.current) {
      arrived.current = arrivedIds(seen.current, items);
      seen.current = new Set([...(seen.current ?? []), ...items.map((item) => item.id)]);
      shown.current = key;
    }
  }

  const row = (showTime: boolean) => (item: FeedItem) => (
    <FeedRow
      key={item.id}
      item={item}
      showTime={showTime}
      isNew={arrived.current.has(item.id)}
      open={pressed === item.id}
      onPress={() => setPressed((current) => (current === item.id ? null : item.id))}
      onStep={() => onStep(item.next.step)}
      onClose={() => setPressed(null)}
    />
  );

  return (
    <section data-testid="admin-home" aria-labelledby="admin-home-title" className="mx-auto flex w-full max-w-[760px] flex-col gap-8 px-4 pb-16 pt-6 md:px-6 md:pt-10">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 id="admin-home-title" className="text-(length:--type-display) font-semibold text-foreground">
            {C.title}
          </h1>
          <p className="text-(length:--type-small) text-muted-foreground">{C.refreshes}</p>
        </div>
        <Link
          to="/proposals"
          data-testid="admin-home-up-next"
          className="flex flex-col items-start text-left text-(length:--type-small) text-muted-foreground hover:text-foreground sm:items-end sm:text-right"
        >
          <span className="font-medium text-foreground underline underline-offset-4">{C.upNext}</span>
          {open !== null ? <span>{open === 0 ? C.noneOpen : C.openCount(open)}</span> : null}
        </Link>
      </header>

      {failed ? (
        <p role="alert" className="text-(length:--type-small) text-destructive">
          {C.partFailed}{" "}
          <button type="button" className="underline" onClick={onRetry}>
            {C.retry}
          </button>
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        <h2 className="text-(length:--type-label) font-medium uppercase tracking-[0.08em] text-muted-foreground">{C.waiting}</h2>
        {feed === null ? (
          <SkeletonFrame shape="rows" count={3} label={C.loading} testId="admin-home-skeleton" />
        ) : feed.waiting.length ? (
          <ul data-testid="admin-home-waiting" className="divide-y divide-border border-y border-border">
            {feed.waiting.map(row(false))}
          </ul>
        ) : (
          <p data-admin-home-empty="waiting" className="text-(length:--type-small) text-muted-foreground">{failed ? C.notCheckedWaiting : C.nothingWaiting}</p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-(length:--type-label) font-medium uppercase tracking-[0.08em] text-muted-foreground">{C.today}</h2>
        {feed === null ? (
          <SkeletonFrame shape="rows" count={2} announce={false} testId="admin-home-skeleton-today" />
        ) : feed.today.length ? (
          <ul data-testid="admin-home-today" className="divide-y divide-border border-y border-border">
            {feed.today.map(row(true))}
          </ul>
        ) : (
          <p data-admin-home-empty="today" className="text-(length:--type-small) text-muted-foreground">{failed ? C.notCheckedToday : C.nothingToday}</p>
        )}
        {feed && feed.todayMore > 0 ? (
          <Link to="/proposals" className="text-(length:--type-small) text-muted-foreground underline hover:text-foreground">
            {C.more(feed.todayMore)}
          </Link>
        ) : null}
      </div>
    </section>
  );
}

/** One item. Pressing it morphs it into its next step, with Next and Why written on it. */
function FeedRow({
  item,
  showTime,
  isNew,
  open,
  onPress,
  onStep,
  onClose,
}: {
  item: FeedItem;
  /** Earlier shows the time of day; a waiting item's time would be the brief's, which may be days ago. */
  showTime: boolean;
  isNew: boolean;
  open: boolean;
  onPress: () => void;
  onStep: () => void;
  onClose: () => void;
}) {
  const C = ADMIN_HOME_COPY;
  const panel = `admin-home-next-${item.id.replace(/[^a-z0-9-]/gi, "-")}`;
  const time = showTime && item.at ? feedTime(item.at) : "";
  const words = (
    <div className="ah-words">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panel}
        onClick={onPress}
        className={cn(
          "flex w-full items-start gap-3 py-3 text-left transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          open && "bg-secondary/60",
        )}
      >
        <span aria-hidden className="ah-mark mt-2" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-baseline justify-between gap-3">
            <span data-feed-title className="min-w-0 break-words font-medium text-foreground [overflow-wrap:anywhere]">
              {item.title}
            </span>
            {time ? (
              <span className="shrink-0 font-mono text-(length:--type-label) text-muted-foreground">{time}</span>
            ) : null}
          </span>
          {item.detail ? (
            <span data-feed-detail className="break-words text-(length:--type-small) text-muted-foreground [overflow-wrap:anywhere]">
              {item.detail}
            </span>
          ) : null}
        </span>
      </button>
      <RollDown open={open}>
        <div id={panel} data-feed-next className="flex flex-col gap-3 pb-4 pl-[18px] pt-1">
          <p className="text-(length:--type-small) text-foreground">
            <span className="font-medium">{C.next}: </span>
            {item.next.label}
          </p>
          <p className="text-(length:--type-small) text-muted-foreground">
            <span className="font-medium text-foreground">{C.why}: </span>
            {item.next.why}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ink" size="sm" onClick={onStep}>
              {item.next.label}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              {C.close}
            </Button>
          </div>
        </div>
      </RollDown>
    </div>
  );
  return (
    <li data-feed-item={item.id} data-feed-kind={item.kind} data-feed-new={isNew ? "true" : undefined} className={cn(isNew && "ah-arrive")}>
      {/* One shape whether new or not, so the row's button is never remounted and keeps focus (QA L4). */}
      <div className="ah-arrive-inner">
        {isNew ? (
          <div aria-hidden className="ah-skel flex flex-col gap-2">
            <Skeleton className="h-3 w-2/5 motion-reduce:animate-none" />
            <Skeleton className="h-2.5 w-3/5 motion-reduce:animate-none" />
          </div>
        ) : null}
        {words}
      </div>
    </li>
  );
}

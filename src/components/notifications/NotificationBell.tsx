import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  listMyNotifications,
  markNotifications,
  recordNotificationOpened,
} from "@/lib/notifications.functions";
import { NOTIFICATION_COPY, badgeCount, type NotificationRow } from "@/lib/notifications-shared";

import { NotificationPanel } from "./NotificationPanel";

/** Drawn in the GraphiteIcon hand: same box, stroke and caps. */
function BellGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg className="nb-ico" data-icon="bell" width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path pathLength={1} d="M5.2 13.9V9.1a4.8 4.8 0 019.6-.1v4.9l1.3 1.3H3.9l1.3-1.3z" />
      <path pathLength={1} d="M8.4 17.1c.9.8 2.3.8 3.2 0" />
    </svg>
  );
}

function useNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 639px)");
    const on = () => setNarrow(mql.matches);
    on();
    mql.addEventListener("change", on);
    return () => mql.removeEventListener("change", on);
  }, []);
  return narrow;
}

export function NotificationBell({ className, side = "bottom", align = "end" }: {
  className?: string;
  /** Desktop popover placement; the phone sheet ignores it. */
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}) {
  const list = useServerFn(listMyNotifications);
  const mark = useServerFn(markNotifications);
  const opened = useServerFn(recordNotificationOpened);
  const narrow = useNarrow();
  const [open, setOpen] = useState(false);

  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await list()) as unknown as NotificationRow[],
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
  const rows = (query.data ?? []) as NotificationRow[];
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const autoOpened = useRef(false);
  const count = badgeCount(rows);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      const hasNeedsYou = rows.some((r) => r.section === "needs_you" && !r.acted_at);
      void opened({ data: { hasNeedsYou } }).catch(() => {});
      const unread = rows.filter((r) => r.section === "updates" && !r.read_at).map((r) => r.id);
      if (unread.length) void mark({ data: { ids: unread, acted: false } }).catch(() => {});
    } else {
      void query.refetch();
    }
  }

  // SH-5c: ?notifications=open opens the visible bell once, then the param goes.
  useEffect(() => {
    if (autoOpened.current || !query.isSuccess) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("notifications") !== "open") return;
    const el = buttonRef.current;
    if (!el || el.getClientRects().length === 0) return;
    autoOpened.current = true;
    url.searchParams.delete("notifications");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    onOpenChange(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.isSuccess]);

  const trigger = (
    <button
      ref={buttonRef}
      type="button"
      aria-label={count ? `${NOTIFICATION_COPY.bellLabel}, ${count} need you` : NOTIFICATION_COPY.bellLabel}
      onClick={narrow ? () => onOpenChange(true) : undefined}
      className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-md text-foreground/70 transition-colors hover:bg-secondary ${className ?? ""}`}
    >
      <BellGlyph />
      {count && (
        <span
          data-testid="notification-count"
          className="absolute right-1 top-1 min-w-[18px] rounded-full bg-primary px-1 text-center font-mono text-[11px] leading-[18px] text-primary-foreground"
        >
          {count}
        </span>
      )}
    </button>
  );

  const panel = (
    <NotificationPanel
      rows={rows}
      onChanged={() => void query.refetch()}
      onNavigate={() => onOpenChange(false)}
    />
  );

  if (narrow) {
    return (
      <>
        {trigger}
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <SheetTitle className="sr-only">{NOTIFICATION_COPY.title}</SheetTitle>
            {panel}
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent side={side} align={align} className="max-h-[70vh] w-[360px] overflow-y-auto">
        {panel}
      </PopoverContent>
    </Popover>
  );
}

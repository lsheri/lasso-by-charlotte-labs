import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import {
  decideInvite,
  markNotifications,
  recordNotificationActed,
} from "@/lib/notifications.functions";
import {
  NOTIFICATION_COPY,
  notificationSentence,
  type NotificationRow,
} from "@/lib/notifications-shared";
import { formatDate } from "@/lib/work-types";
import { SHARED_WITH_YOU_COPY, useAcceptBoardShare, useOpenShared } from "@/components/layout/SharedWithYou";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";
import { logEvent } from "@/lib/telemetry";
import { isAcceptableShare } from "@/lib/notifications-shared";
import { useQueryClient } from "@tanstack/react-query";

type Decided = { pending?: boolean; text?: string; error?: string };

function boardSharedSentence(row: NotificationRow): string {
  const by = typeof row.payload["by"] === "string" && row.payload["by"] ? row.payload["by"] : "Someone";
  const board = typeof row.payload["board"] === "string" && row.payload["board"] ? row.payload["board"] : "a board";
  return `${by} shared ${board} with you`;
}

export function NotificationPanel({
  rows,
  onChanged,
  onNavigate,
}: {
  rows: NotificationRow[];
  onChanged: () => void;
  onNavigate: () => void;
}) {
  const navigate = useNavigate();
  const decide = useServerFn(decideInvite);
  const mark = useServerFn(markNotifications);
  const acted = useServerFn(recordNotificationActed);
  const accept = useAcceptBoardShare();
  const openShared = useOpenShared();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [state, setState] = useState<Record<string, Decided>>({});

  // N1: an acceptable share sits with Needs you whatever its section, and
  // stays visible once accepted so the row reads Accepted rather than vanishing.
  const needsYou = rows.filter(
    (r) => isAcceptableShare(r) || (r.section === "needs_you" && (!r.acted_at || state[r.id])),
  );
  const updates = rows.filter((r) => r.section === "updates" && !isAcceptableShare(r));

  // N1: claim with your own name, then mark acted, then open the board. The
  // board can live in another workspace; the claim runs as you, from here.
  async function onAcceptShare(row: NotificationRow) {
    const code = String(row.payload["code"] ?? "");
    const level = typeof row.payload["level"] === "string" ? row.payload["level"] : "review";
    setState((s) => ({ ...s, [row.id]: { pending: true } }));
    const displayName = profile?.display_name?.trim() || undefined;
    const { data, error } = await supabase.rpc("claim_board_invite", {
      p_code: code,
      ...(displayName ? { p_display_name: displayName } : {}),
    });
    const r = (data ?? {}) as Record<string, unknown>;
    const engagementId = typeof r["engagement_id"] === "string" ? r["engagement_id"] : null;
    if (error || !engagementId) {
      const reason = error?.message?.split("\n")[0]?.trim() || NOTIFICATION_COPY.acceptFailed;
      setState((s) => ({ ...s, [row.id]: { error: reason } }));
      return;
    }
    try {
      await mark({ data: { ids: [row.id], acted: true } });
    } catch {
      /* the claim stands; the row is re-read below */
    }
    setState((s) => ({ ...s, [row.id]: { text: NOTIFICATION_COPY.accepted } }));
    if (profile?.org_id) logEvent("board.invite_accepted", profile.org_id, { kind: "peer", level, via: "bell" });
    void acted({ data: { kind: row.kind, action: "accept" } }).catch(() => {});
    void queryClient.invalidateQueries({ queryKey: ["my-shared-boards"] });
    void queryClient.invalidateQueries({ queryKey: ["my-pending-board-invites"] });
    onChanged();
    onNavigate();
    openShared(engagementId, "bell");
  }

  async function onDecide(row: NotificationRow, approve: boolean) {
    if (!row.subject_id) return;
    setState((s) => ({ ...s, [row.id]: { pending: true } }));
    try {
      const out = await decide({ data: { inviteId: row.subject_id, approve } });
      if (!out.ok) {
        setState((s) => ({ ...s, [row.id]: { error: out.message } }));
        return;
      }
      const text = !approve
        ? NOTIFICATION_COPY.declined
        : out.emailed
          ? NOTIFICATION_COPY.approved
          : NOTIFICATION_COPY.approvedNoEmail;
      setState((s) => ({ ...s, [row.id]: { text } }));
      void mark({ data: { ids: [row.id], acted: true } }).catch(() => {});
      void acted({ data: { kind: row.kind, action: approve ? "approve" : "decline" } }).catch(() => {});
    } catch (e) {
      setState((s) => ({ ...s, [row.id]: { error: (e as Error).message.split("\n")[0] ?? "Something went wrong." } }));
    }
  }

  // SH-6b: Open claims the share, becomes the guest profile, opens the board.
  async function onOpenShared(row: NotificationRow) {
    const code = typeof row.payload["code"] === "string" ? row.payload["code"] : "";
    const level = typeof row.payload["level"] === "string" ? row.payload["level"] : "review";
    if (!code) return;
    setState((s) => ({ ...s, [row.id]: { pending: true } }));
    const msg = await accept(code, level, "bell");
    if (msg) {
      setState((s) => ({ ...s, [row.id]: { error: msg } }));
      return;
    }
    setState((s) => ({ ...s, [row.id]: {} }));
    void mark({ data: { ids: [row.id], acted: true } }).then(onChanged).catch(() => {});
    onNavigate();
  }

  function onOpen(row: NotificationRow) {
    void mark({ data: { ids: [row.id], acted: true } }).then(onChanged).catch(() => {});
    void acted({ data: { kind: row.kind, action: "open" } }).catch(() => {});
    if (row.engagement_id) {
      onNavigate();
      void navigate({ to: "/engagements/$id/canvas-lab", params: { id: row.engagement_id } });
    }
  }

  const heading = "font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground";

  return (
    <div className="flex flex-col gap-4" data-testid="notification-panel">
      <h2 className="font-serif text-xl text-foreground">{NOTIFICATION_COPY.title}</h2>
      {needsYou.length === 0 && updates.length === 0 && (
        <p className="text-sm text-muted-foreground">{NOTIFICATION_COPY.empty}</p>
      )}
      {needsYou.length > 0 && (
        <section aria-label={NOTIFICATION_COPY.needsYou} className="flex flex-col gap-2">
          <h3 className={heading}>{NOTIFICATION_COPY.needsYou}</h3>
          <ul className="flex flex-col gap-3">
            {needsYou.map((row) => {
              const s = state[row.id] ?? {};
              return (
                <li
                  key={row.id}
                  data-unread={row.read_at ? undefined : "true"}
                  data-notification-kind={row.kind}
                  className={`rounded-md border p-3 ${row.read_at ? "border-border" : "border-foreground/40 bg-secondary"}`}
                >
                  <p className={`text-sm ${row.read_at ? "text-muted-foreground" : "text-foreground"}`}>{row.kind === "board_shared" ? boardSharedSentence(row) : notificationSentence(row)}</p>
                  {s.text ? <p className="mt-1 text-sm text-foreground" role="status">{s.text}</p> : null}
                  {!s.text && isAcceptableShare(row) && row.acted_at ? (
                    <p className="mt-1 text-sm text-foreground">{NOTIFICATION_COPY.accepted}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(row.created_at)}</p>
                  {!s.text && row.kind === "board_shared" && (
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" disabled={s.pending} onClick={() => void onOpenShared(row)}>
                        {SHARED_WITH_YOU_COPY.open}
                      </Button>
                    </div>
                  )}
                  {!s.text && isAcceptableShare(row) && !row.acted_at && (
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" disabled={s.pending} onClick={() => void onAcceptShare(row)}>
                        {s.pending ? NOTIFICATION_COPY.accepting : NOTIFICATION_COPY.accept}
                      </Button>
                    </div>
                  )}
                  {!s.text && row.kind === "invite_needs_approval" && (
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" disabled={s.pending} onClick={() => void onDecide(row, true)}>
                        {NOTIFICATION_COPY.approve}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={s.pending}
                        onClick={() => void onDecide(row, false)}
                      >
                        {NOTIFICATION_COPY.decline}
                      </Button>
                    </div>
                  )}
                  {s.error && <p className="mt-2 text-xs text-destructive" role="alert">{s.error}</p>}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {updates.length > 0 && (
        <section aria-label={NOTIFICATION_COPY.updates} className="flex flex-col gap-2">
          <h3 className={heading}>{NOTIFICATION_COPY.updates}</h3>
          <ul className="flex flex-col">
            {updates.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => onOpen(row)}
                  className="w-full rounded-md px-2 py-2 text-left transition-colors hover:bg-secondary"
                >
                  <span data-unread={row.read_at ? undefined : "true"} className={`block text-sm ${row.read_at ? "text-muted-foreground" : "font-medium text-foreground"}`}>
                    {notificationSentence(row)}
                  </span>
                  <span className="block text-xs text-muted-foreground">{formatDate(row.created_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

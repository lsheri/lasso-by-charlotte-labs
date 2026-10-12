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

type Decided = { pending?: boolean; text?: string; error?: string };

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
  const [state, setState] = useState<Record<string, Decided>>({});

  const needsYou = rows.filter(
    (r) => r.section === "needs_you" && (!r.acted_at || state[r.id]),
  );
  const updates = rows.filter((r) => r.section === "updates");

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
                <li key={row.id} className="rounded-md border border-border p-3">
                  <p className="text-sm text-foreground">{s.text ?? notificationSentence(row)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(row.created_at)}</p>
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
                  {s.error && <p className="mt-2 truncate text-xs text-destructive">{s.error}</p>}
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
                  <span className={`block text-sm ${row.read_at ? "text-muted-foreground" : "text-foreground"}`}>
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

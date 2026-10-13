/**
 * SH-6b: boards other people shared with this person. A board guest lives in
 * the host's workspace as a profile with is_guest, member of one board only.
 * SH-7a: a shared board opens inside the person's own workspace. The guest
 * seat is never made the active profile from the UI.
 */
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { setActiveProfileId, useProfile, type Profile } from "@/hooks/use-profile";
import { logEvent } from "@/lib/telemetry";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const SHARED_WITH_YOU_COPY = {
  title: "Shared with you",
  accept: "Accept",
  open: "Open",
  guestBar: (host: string) => `Shared by ${host}.`,
  back: "Back to your workspace",
  bandLabel: "Shared space",
  band: (host: string, level: string) =>
    `${host}'s board · ${level === "review" ? "You can view" : "You can add work"} · What you add stays yours`,
  failed: "That board could not be opened. Ask the person who shared it for a new link.",
  shelfNote: "Other people's boards you can see or add to. Your work on them stays yours.",
  sharedLabel: (host: string) => `SHARED · ${host.toUpperCase()}`,
  inviteLabel: "INVITE · WAITING FOR YOU",
  invited: (name: string) => `${name} wants you to see this board.`,
  permission: (level: string) => level === "work" ? "You can add work" : "You can view",
  placement: (title: string) => `On ${title} · shared`,
} as const;

const OWN_PROFILE_KEY = "lasso.last_own_profile";

export type SharedBoardRow = { engagement_id: string; title: string; host_org: string; guest_profile_id: string; level: string; added_at: string };
export type PendingInviteRow = { invite_id: string; code: string; board: string; host_org: string; invited_by: string; level: string; created_at: string };

export function useSharedWithYou(enabled: boolean) {
  const shared = useQuery({
    queryKey: ["my-shared-boards"],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_shared_boards");
      if (error) throw error;
      return (data ?? []) as SharedBoardRow[];
    },
  });
  const pending = useQuery({
    queryKey: ["my-pending-board-invites"],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_pending_board_invites");
      if (error) throw error;
      return (data ?? []) as PendingInviteRow[];
    },
  });
  return { shared: shared.data ?? [], pending: pending.data ?? [] };
}

/** Open a shared board in place: no profile switch, ever. */
export function useOpenShared() {
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  return (engagementId: string, via: "shelf" | "bell" | "home") => {
    if (profile?.org_id) logEvent("shared.board_opened", profile.org_id, { via });
    void navigate({ to: "/engagements/$id/canvas-lab", params: { id: engagementId } });
    return true;
  };
}

/** Claim a share code, then open the board inside the current workspace. */
export function useAcceptBoardShare() {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const openShared = useOpenShared();
  return async (code: string, level: string, via: "bell" | "sidebar" | "home"): Promise<string | null> => {
    const { data, error } = await supabase.rpc("claim_board_invite", { p_code: code });
    if (error) return SHARED_WITH_YOU_COPY.failed;
    const r = (data ?? {}) as Record<string, unknown>;
    const engagementId = typeof r["engagement_id"] === "string" ? r["engagement_id"] : null;
    if (!engagementId) return SHARED_WITH_YOU_COPY.failed;
    if (profile?.org_id) logEvent("board.invite_accepted", profile.org_id, { kind: "peer", level, via });
    void queryClient.invalidateQueries({ queryKey: ["my-shared-boards"] });
    void queryClient.invalidateQueries({ queryKey: ["my-pending-board-invites"] });
    openShared(engagementId, via === "sidebar" ? "shelf" : via);
    return null;
  };
}

/** Home uses the same reads and actions as the sidebar, without changing workspace. */
export function SharedWithYouShelf({ shared, pending }: { shared: SharedBoardRow[]; pending: PendingInviteRow[] }) {
  const openShared = useOpenShared();
  const accept = useAcceptBoardShare();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (shared.length === 0 && pending.length === 0) return null;
  const card = "flex min-h-[228px] min-w-0 flex-col items-start justify-between gap-4 whitespace-normal rounded-[var(--radius-control)] border-[1.5px] border-[var(--nb-shared)] bg-card p-4 text-left";
  return (
    <section aria-label={SHARED_WITH_YOU_COPY.title} data-testid="home-shared-shelf" className="min-w-0 text-left">
      <h2 className="font-hand text-[26px] text-[var(--nb-shared)]">{SHARED_WITH_YOU_COPY.title}</h2>
      <p className="mt-1 text-base leading-relaxed text-muted-foreground">{SHARED_WITH_YOU_COPY.shelfNote}</p>
      <ul className="mt-4 grid list-none grid-cols-1 gap-6 p-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {shared.map((board) => (
          <li key={`${board.engagement_id}:${board.guest_profile_id}`} className="min-w-0">
            <Button variant="ghost" className={cn(card, "h-full w-full hover:bg-secondary")} onClick={() => openShared(board.engagement_id, "home")}>
              <span className="max-w-full break-words font-mono text-[13px] font-normal text-[var(--nb-shared)]">{SHARED_WITH_YOU_COPY.sharedLabel(board.host_org)}</span>
              <span className="max-w-full break-words text-[19.5px] font-medium text-foreground">{board.title}</span>
              <span className="text-base font-normal text-muted-foreground">{SHARED_WITH_YOU_COPY.permission(board.level)}</span>
            </Button>
          </li>
        ))}
        {pending.map((invite) => (
          <li key={invite.invite_id} className={cn(card, "border-dashed")}>
            <span className="max-w-full break-words font-mono text-[13px] text-[var(--nb-shared)]">{SHARED_WITH_YOU_COPY.inviteLabel}</span>
            <h3 className="max-w-full break-words text-[19.5px] font-medium text-foreground">{invite.board}</h3>
            <p className="text-base leading-relaxed text-muted-foreground">{SHARED_WITH_YOU_COPY.invited(invite.invited_by)}</p>
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
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="mt-3 text-base text-destructive">{error}</p>}
    </section>
  );
}

export async function fetchSharedWorkPlacements(itemIds: string[]) {
  if (itemIds.length === 0) return {};
  const { data, error } = await supabase.from("work_item_tasks")
    .select("work_item_id, work_items!inner(org_id), tasks(engagements(id, title, org_id))")
    .in("work_item_id", itemIds);
  if (error) throw error;
  const byItem: Record<string, { id: string; title: string }[]> = {};
  for (const row of data ?? []) {
    const board = row.tasks?.engagements;
    if (!board || !row.work_items || board.org_id === row.work_items.org_id) continue;
    const boards = byItem[row.work_item_id] ?? [];
    if (!boards.some((existing) => existing.id === board.id)) boards.push({ id: board.id, title: board.title });
    byItem[row.work_item_id] = boards;
  }
  return byItem;
}

export function SharedWorkChips({ boards }: { boards: { id: string; title: string }[] }) {
  return boards.length > 0 ? <span className="flex min-w-0 flex-wrap gap-1">
    {boards.map((board) => <span key={board.id} className="max-w-full break-words rounded-[var(--radius-control)] bg-[color-mix(in_oklab,var(--nb-shared)_12%,var(--nb-paper))] px-2 py-1 text-[13px] text-[var(--nb-shared)]">{SHARED_WITH_YOU_COPY.placement(board.title)}</span>)}
  </span> : null;
}

/** Sidebar section, shown in every workspace; silent when both lists are empty. */
export function SharedWithYouSection({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  const { shared, pending } = useSharedWithYou(true);
  const accept = useAcceptBoardShare();
  const openShared = useOpenShared();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (shared.length === 0 && pending.length === 0) return null;
  const row = "flex w-full min-w-0 flex-col rounded-md px-2 py-1 text-left transition-colors hover:bg-secondary";
  return (
    <div data-testid="shared-with-you">
      <div className="nb-group-header nb-shared-ink px-2">{SHARED_WITH_YOU_COPY.title}</div>
      <div className="mt-2 flex flex-col gap-0.5">
        {shared.map((b) => (
          <button
            key={`${b.engagement_id}:${b.guest_profile_id}`}
            type="button"
            className={cn(row, pathname.startsWith(`/engagements/${b.engagement_id}`) && "bg-secondary")}
            aria-current={pathname.startsWith(`/engagements/${b.engagement_id}`) ? "page" : undefined}
            onClick={() => {
              onNavigate?.();
              openShared(b.engagement_id, "shelf");
            }}
          >
            <span className="truncate text-[13px] text-foreground">{b.title}</span>
            <span className="truncate text-xs text-muted-foreground">{b.host_org}</span>
          </button>
        ))}
        {pending.map((p) => (
          <div key={p.invite_id} className="flex items-center gap-2 px-2 py-1">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] text-foreground">{p.board}</span>
              <span className="block truncate text-xs text-muted-foreground">{p.host_org}</span>
            </span>
            <button
              type="button"
              disabled={busy === p.invite_id}
              className="nb-pencil-cta shrink-0 rounded-md px-2 py-1 text-xs"
              onClick={async () => {
                setBusy(p.invite_id);
                setError(null);
                const msg = await accept(p.code, p.level, "sidebar");
                setBusy(null);
                if (msg) setError(msg);
                else onNavigate?.();
              }}
            >
              {SHARED_WITH_YOU_COPY.accept}
            </button>
          </div>
        ))}
        {error && <p className="px-2 text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}

/** Remembers the person's own (non-guest) workspace so Back has somewhere to go. */
export function useRememberOwnProfile(profile: Profile | null | undefined) {
  useEffect(() => {
    if (!profile || profile.is_guest) return;
    try {
      window.localStorage.setItem(OWN_PROFILE_KEY, profile.id);
    } catch {
      /* convenience only */
    }
  }, [profile]);
}

function ownProfileId(profiles: Profile[]): string | null {
  const own = profiles.filter((p) => !p.is_guest);
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(OWN_PROFILE_KEY);
  } catch {
    stored = null;
  }
  if (stored && own.some((p) => p.id === stored)) return stored;
  const latest = [...own].sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))[0];
  return latest?.id ?? null;
}

/** Thin bar over the board while the active profile is a guest. */
export function GuestBar({ profile, profiles, className }: { profile: Profile; profiles: Profile[]; className?: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const target = ownProfileId(profiles);
  return (
    <div data-testid="guest-bar" className={cn("mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground", className)}>
      <span>{SHARED_WITH_YOU_COPY.guestBar(profile.org_name)}</span>
      {target && (
        <button
          type="button"
          className="text-foreground underline underline-offset-2"
          onClick={async () => {
            if (!(await setActiveProfileId(target))) return;
            void queryClient.invalidateQueries();
            void navigate({ to: "/home" });
          }}
        >
          {SHARED_WITH_YOU_COPY.back}
        </button>
      )}
    </div>
  );
}

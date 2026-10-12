import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";
import { logEvent } from "@/lib/telemetry";
import { useActiveSettingsSection } from "./SettingsShell";

/** SH-6d-1: every string a person reads on this card. */
export const SUPPORT_COPY = {
  title: "Support access",
  none: "Charlotte Labs can only see your workspace if you approve a request here. Requests arrive by email.",
  asking: "Charlotte Labs is asking to view this workspace to help with a problem.",
  howLong: "For how long",
  includeConversations: "Include full AI conversations",
  conversationsHelp: "Off: we see your boards and cards, not the conversations inside them.",
  approve: "Approve",
  decline: "Decline",
  active: (until: string) => `Charlotte Labs can view this workspace, read only, until ${until}.`,
  convIncluded: "Conversations: included",
  convHidden: "Conversations: hidden",
  end: "End access now",
  viewedTitle: "What was viewed",
  viewedEmpty: "Nothing viewed yet.",
  days: (n: number) => (n === 1 ? "1 day" : `${n} days`),
} as const;

const SURFACE_LABELS: Record<string, string> = {
  boards: "Boards",
  board: "A board",
  work: "All work",
  conversation: "A conversation",
  home: "Home",
};

export function surfaceLabel(surface: string): string {
  return SURFACE_LABELS[surface] ?? surface;
}

/** "19 Oct" */
export function shortDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function dayTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type SupportGrant = {
  id: string;
  reason: string;
  days: number;
  include_conversations: boolean;
  status: string;
  ends_at: string | null;
  created_at: string;
};

type LogRow = { id: number; surface: string; at: string };

export function SupportAccessCard() {
  const { data: profile } = useProfile();
  if (!profile || profile.role !== "admin" || !profile.org_id) return null;
  return <SupportAccessInner orgId={profile.org_id} />;
}

function SupportAccessInner({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const ref = useRef<HTMLDivElement>(null);
  const { activeSectionId } = useActiveSettingsSection();
  useEffect(() => {
    if (activeSectionId === "support") ref.current?.scrollIntoView?.({ block: "start" });
  }, [activeSectionId]);

  const grantsKey = ["support-grants", orgId] as const;
  const logKey = ["support-access-log", orgId] as const;
  const grants = useQuery({
    queryKey: grantsKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_grants")
        .select("id, reason, days, include_conversations, status, ends_at, created_at")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as SupportGrant[];
    },
  });
  const log = useQuery({
    queryKey: logKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_access_log")
        .select("id, surface, at")
        .eq("org_id", orgId)
        .order("at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as LogRow[];
    },
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: grantsKey });
    void qc.invalidateQueries({ queryKey: logKey });
  };

  const list = grants.data ?? [];
  const pending = list.find((g) => g.status === "requested");
  const active = list.find(
    (g) => g.status === "active" && (!g.ends_at || new Date(g.ends_at).getTime() > Date.now()),
  );

  return (
    <div ref={ref} data-testid="support-access-card" className="space-y-4">
      <div className="rounded-[var(--radius)] border border-border bg-card p-5">
        <h3 className="text-sm font-medium text-foreground">{SUPPORT_COPY.title}</h3>
        {pending ? (
          <PendingGrant key={pending.id} grant={pending} orgId={orgId} onDone={refresh} />
        ) : null}
        {active ? <ActiveGrant grant={active} orgId={orgId} onDone={refresh} /> : null}
        {!pending && !active && !grants.isLoading ? (
          <p className="mt-2 text-sm text-muted-foreground">{SUPPORT_COPY.none}</p>
        ) : null}
      </div>
      <div>
        <p className="micro-label">{SUPPORT_COPY.viewedTitle}</p>
        {log.data && log.data.length > 0 ? (
          <ul className="mt-2 space-y-1 text-sm text-foreground">
            {log.data.map((r) => (
              <li key={r.id}>
                {surfaceLabel(r.surface)} · {dayTime(r.at)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">{SUPPORT_COPY.viewedEmpty}</p>
        )}
      </div>
    </div>
  );
}

function PendingGrant({
  grant,
  orgId,
  onDone,
}: {
  grant: SupportGrant;
  orgId: string;
  onDone: () => void;
}) {
  const [days, setDays] = useState(Math.min(28, Math.max(1, grant.days || 1)));
  const [conv, setConv] = useState(false);
  const decide = useMutation({
    mutationFn: async (approve: boolean) => {
      const { error } = await supabase.rpc("decide_support_access", {
        p_grant: grant.id,
        p_approve: approve,
        p_days: approve ? days : (null as unknown as number),
        p_include_conversations: approve ? conv : false,
      });
      if (error) throw error;
      return approve;
    },
    onSuccess: (approve) => {
      logEvent("support.decided", orgId, {
        approved: approve ? "true" : "false",
        conversations: approve && conv ? "true" : "false",
      });
      onDone();
    },
  });
  return (
    <div className="mt-2 space-y-3">
      <p className="text-sm text-foreground">{SUPPORT_COPY.asking}</p>
      <p className="text-sm italic text-muted-foreground">"{grant.reason}"</p>
      <label className="flex items-center gap-2 text-sm text-foreground">
        {SUPPORT_COPY.howLong}
        <select
          aria-label={SUPPORT_COPY.howLong}
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-[var(--radius)] border border-border bg-background px-2 py-1"
        >
          {Array.from({ length: 28 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {SUPPORT_COPY.days(n)}
            </option>
          ))}
        </select>
      </label>
      <div>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={conv} onChange={(e) => setConv(e.target.checked)} />
          {SUPPORT_COPY.includeConversations}
        </label>
        <p className="mt-1 text-[13px] text-muted-foreground">{SUPPORT_COPY.conversationsHelp}</p>
      </div>
      {decide.error ? (
        <p className="text-sm text-destructive">{(decide.error as Error).message}</p>
      ) : null}
      <div className="flex gap-2">
        <Button type="button" disabled={decide.isPending} onClick={() => decide.mutate(true)}>
          {SUPPORT_COPY.approve}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={decide.isPending}
          onClick={() => decide.mutate(false)}
        >
          {SUPPORT_COPY.decline}
        </Button>
      </div>
    </div>
  );
}

function ActiveGrant({
  grant,
  orgId,
  onDone,
}: {
  grant: SupportGrant;
  orgId: string;
  onDone: () => void;
}) {
  const end = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("end_support_access", { p_grant: grant.id });
      if (error) throw error;
    },
    onSuccess: () => {
      logEvent("support.ended", orgId, { by: "grantor" });
      onDone();
    },
  });
  return (
    <div className="mt-2 space-y-2">
      <p className="text-sm text-foreground">
        {SUPPORT_COPY.active(grant.ends_at ? shortDay(grant.ends_at) : "")}
      </p>
      <p className="text-sm text-muted-foreground">
        {grant.include_conversations ? SUPPORT_COPY.convIncluded : SUPPORT_COPY.convHidden}
      </p>
      {end.error ? <p className="text-sm text-destructive">{(end.error as Error).message}</p> : null}
      <Button
        type="button"
        variant="outline"
        disabled={end.isPending}
        onClick={() => end.mutate()}
      >
        {SUPPORT_COPY.end}
      </Button>
    </div>
  );
}

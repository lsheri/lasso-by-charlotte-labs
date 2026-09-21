import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { scopeSentence } from "@/components/reflect/WorkScopePicker";
import { useEngagements } from "@/hooks/use-engagements";
import { useProfile } from "@/hooks/use-profile";
import { useWorkItems } from "@/hooks/use-work-items";
import { supabase } from "@/integrations/supabase/client";
import { getReflectBoot } from "@/lib/reflect-boot.functions";
import type { ReflectBoot, ReflectSessionRow } from "@/lib/reflect-boot-shared";
import { parseScope } from "@/lib/reflect-shared";

/**
 * PASS A2 — the conversations a person started with Lasso, listed beside the
 * ones their tools sent over. Same read and same query key the Reflect page
 * uses, so there is one source for this list and no second request.
 */

function relative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function useAskedSessions(): ReflectSessionRow[] {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const fetchBoot = useServerFn(getReflectBoot);
  const { data } = useQuery({
    queryKey: ["reflect-sessions", profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async (): Promise<ReflectSessionRow[]> =>
      (
        await queryClient.fetchQuery({
          queryKey: ["reflect-boot", profile?.id ?? null, null] as const,
          queryFn: (): Promise<ReflectBoot> =>
            fetchBoot({ data: { profile_id: profile?.id ?? null, session_id: null } }),
        })
      ).sessions,
  });
  return data ?? [];
}

export function AskedSessions({
  sessions,
  onOpen,
}: {
  sessions: ReflectSessionRow[];
  onOpen: (sessionId: string) => void;
}) {
  const queryClient = useQueryClient();
  const { data: work } = useWorkItems();
  const { data: profile } = useProfile();
  const { data: engagements } = useEngagements(profile?.id);
  const all = work?.items ?? [];

  async function deleteSession(id: string) {
    await supabase.from("chat_messages").delete().eq("session_id", id);
    await supabase.from("chat_sessions").delete().eq("id", id);
    await queryClient.invalidateQueries({ queryKey: ["reflect-sessions"] });
    await queryClient.invalidateQueries({ queryKey: ["reflect-boot"] });
  }

  return (
    <section className="mb-8 space-y-3" data-testid="asked-sessions">
      <div className="flex items-center gap-3 pb-2 pt-1">
        <span className="font-hand text-[19px] leading-none text-graphite">Asked Lasso</span>
        <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-soft">
          {sessions.length}
        </span>
        <span className="h-px flex-1 bg-[var(--nb-rule)]" />
      </div>

      <p className="nb-type-small leading-[17px] text-muted-foreground">
        Private to you. Your coach never sees this.
      </p>

      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">You have not asked Lasso anything yet.</p>
      ) : (
        <div className="space-y-1">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center gap-1 rounded-md px-3 py-2 transition-colors hover:bg-muted/50"
            >
              <button
                type="button"
                onClick={() => onOpen(session.id)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-sm text-foreground">
                  {session.title ?? "New session"}
                </span>
                <span className="block truncate nb-type-small text-muted-foreground">
                  {scopeSentence(parseScope(session.context_scope), all, engagements ?? [])}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                  {relative(session.updated_at)}
                </span>
              </button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    aria-label="Delete session"
                    className="px-1 font-mono text-xs text-muted-foreground transition-colors hover:text-destructive"
                  >
                    ✕
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this session?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The conversation and everything in it is removed for good.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep it</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void deleteSession(session.id)}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

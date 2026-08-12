import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { ScopePicker } from "@/components/reflect/ScopePicker";
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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { sendReflectMessage } from "@/lib/reflect.functions";
import { DEFAULT_SCOPE, parseScope, scopeLabel, type ContextScope } from "@/lib/reflect-shared";
import { logEvent } from "@/lib/telemetry";

type SessionRow = {
  id: string;
  title: string | null;
  context_scope: unknown;
  updated_at: string;
};

type MessageRow = { id: number; role: string; content: string; created_at: string };

function relative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function ReflectPage() {
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const send = useServerFn(sendReflectMessage);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Reflect is private to the person doing the work; coach profiles never see it,
  // including by typing the URL directly.
  const isCoach = profile?.role === "coach";
  useEffect(() => {
    if (isCoach) navigate({ to: "/coaching", replace: true });
  }, [isCoach, navigate]);

  const { data: sessions } = useQuery({
    queryKey: ["reflect-sessions", profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async (): Promise<SessionRow[]> => {
      const { data, error: sessionError } = await supabase
        .from("chat_sessions")
        .select("id, title, context_scope, updated_at")
        .eq("profile_id", profile?.id as string)
        .order("updated_at", { ascending: false });
      if (sessionError) throw sessionError;
      return (data ?? []) as SessionRow[];
    },
  });

  const active = (sessions ?? []).find((s) => s.id === activeId) ?? null;
  const scope: ContextScope = active ? parseScope(active.context_scope) : DEFAULT_SCOPE;

  const { data: messages } = useQuery({
    queryKey: ["reflect-messages", activeId],
    enabled: Boolean(activeId),
    queryFn: async (): Promise<MessageRow[]> => {
      const { data, error: messageError } = await supabase
        .from("chat_messages")
        .select("id, role, content, created_at")
        .eq("session_id", activeId as string)
        .order("created_at", { ascending: true });
      if (messageError) throw messageError;
      return (data ?? []) as MessageRow[];
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length, pending]);

  async function newSession() {
    if (!profile) return;
    setError(null);
    const { data, error: insertError } = await supabase
      .from("chat_sessions")
      .insert({ profile_id: profile.id, org_id: profile.org_id, context_scope: DEFAULT_SCOPE })
      .select("id")
      .single();
    if (insertError) return setError(insertError.message);
    logEvent("reflect.session_created", profile.org_id, {});
    await queryClient.invalidateQueries({ queryKey: ["reflect-sessions"] });
    setActiveId(data.id);
    setTruncated(false);
  }

  async function deleteSession(id: string) {
    await supabase.from("chat_messages").delete().eq("session_id", id);
    const { error: deleteError } = await supabase.from("chat_sessions").delete().eq("id", id);
    if (deleteError) return setError(deleteError.message);
    if (activeId === id) setActiveId(null);
    await queryClient.invalidateQueries({ queryKey: ["reflect-sessions"] });
  }

  async function saveScope(next: ContextScope) {
    if (!activeId) return;
    const { error: scopeError } = await supabase
      .from("chat_sessions")
      .update({ context_scope: next })
      .eq("id", activeId);
    if (scopeError) return setError(scopeError.message);
    await queryClient.invalidateQueries({ queryKey: ["reflect-sessions"] });
  }

  async function submit() {
    const message = draft.trim();
    if (!message || !activeId || !profile) return;
    setPending(true);
    setError(null);
    try {
      const result = await send({
        data: { session_id: activeId, message, profile_id: profile.id },
      });
      setDraft("");
      setTruncated(result.truncated);
      await queryClient.invalidateQueries({ queryKey: ["reflect-messages", activeId] });
      await queryClient.invalidateQueries({ queryKey: ["reflect-sessions"] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Reflect"
        subtitle="A private thinking space over your own recorded work."
      />

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-2">
          <Button className="w-full" onClick={newSession}>
            New session
          </Button>
          <div className="space-y-1">
            {(sessions ?? []).map((session) => (
              <div
                key={session.id}
                className={
                  session.id === activeId
                    ? "flex items-center gap-1 rounded-md bg-accent-soft px-3 py-2"
                    : "flex items-center gap-1 rounded-md px-3 py-2 transition-colors hover:bg-muted/50"
                }
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveId(session.id);
                    setTruncated(false);
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-sm text-foreground">
                    {session.title ?? "New session"}
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
            {sessions && sessions.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">No sessions yet.</p>
            ) : null}
          </div>
        </aside>

        <section className="flex min-h-[60vh] flex-col rounded-[var(--radius)] border border-border bg-card shadow-card">
          {!active ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center">
              <p className="text-sm text-foreground">
                Start a session to think out loud about your own work.
              </p>
              <p className="text-sm text-muted-foreground">
                Private to you. Your coach never sees this.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
                <span className="micro-label">Looking at</span>
                <button
                  type="button"
                  onClick={() => setScopeOpen(true)}
                  className="rounded-full bg-accent-soft px-3 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-accent-deep"
                >
                  {scopeLabel(scope)} · change
                </button>
                {truncated ? (
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                    Context truncated to fit
                  </span>
                ) : null}
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
                {(messages ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Private to you. Your coach never sees this.
                  </p>
                ) : null}
                {(messages ?? []).map((message) => (
                  <div key={message.id}>
                    <p className="micro-label">{message.role === "user" ? "You" : "Reflect"}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {message.content}
                    </p>
                  </div>
                ))}
                {pending ? <p className="text-sm text-muted-foreground">Thinking…</p> : null}
                <div ref={bottomRef} />
              </div>

              {error ? <p className="px-5 pb-2 text-sm text-destructive">{error}</p> : null}

              <div className="flex items-end gap-2 border-t border-border px-5 py-4">
                <Textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="What do you want to think through?"
                  rows={2}
                  className="resize-none"
                />
                <Button onClick={() => void submit()} disabled={pending || !draft.trim()}>
                  Send
                </Button>
              </div>
            </>
          )}
        </section>
      </div>

      <ScopePicker
        scope={scope}
        open={scopeOpen}
        onOpenChange={setScopeOpen}
        onSave={(next) => void saveScope(next)}
      />
    </div>
  );
}

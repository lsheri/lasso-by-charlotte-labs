import { ThinkingIndicator } from "@/components/common/Working";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { MarkdownMessage } from "@/components/markdown/MarkdownMessage";
import { AnswerSources } from "@/components/reflect/AnswerSources";
import { CoverageNote } from "@/components/reflect/CoverageNote";
import {
  AnalysisChips,
  InlineAnalysisBlocks,
  useChatAnalyses,
  type ChipTarget,
} from "@/components/reflect/ChatAnalyses";
import { AiRecordPointer } from "@/components/reflect/AiRecordPointer";
import { WorkScopePicker, scopeSentence } from "@/components/reflect/WorkScopePicker";
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
import { useEngagements } from "@/hooks/use-engagements";
import { useProfile } from "@/hooks/use-profile";
import { useWorkItems } from "@/hooks/use-work-items";
import { useAnswerSources } from "@/hooks/use-answer-sources";
import { supabase } from "@/integrations/supabase/client";
import { streamChatRequest } from "@/lib/stream-client";
import type { ReflectResult } from "@/lib/reflect-run.server";
import { chipShape, itemsInScope } from "@/lib/reflect-scope-shape";
import { DEFAULT_SCOPE, parseScope, type ContextScope } from "@/lib/reflect-shared";
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
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [streamed, setStreamed] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<{
    truncated: boolean;
    fullCount: number;
    summaryCount: number;
  } | null>(null);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [scopeNotes, setScopeNotes] = useState<string[]>([]);
  const [narrowing, setNarrowing] = useState<ContextScope | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: work } = useWorkItems();
  const { data: engagements } = useEngagements(profile?.id);
  const all = work?.items ?? [];

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

  const { data: sourcesByMessage } = useAnswerSources(
    (messages ?? []).filter((m) => m.role === "assistant").map((m) => Number(m.id)),
  );

  const analyses = useChatAnalyses(profile?.id, profile?.org_id);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length, pending, analyses.results.length, scopeNotes.length]);

  const shape = chipShape(scope, all);
  const chipTarget: ChipTarget =
    shape.kind === "item"
      ? { kind: "item", id: shape.item.id, title: shape.item.title, scope: shape.scope }
      : shape.kind === "engagement"
        ? {
            kind: "engagement",
            id: shape.engagementId,
            title:
              (engagements ?? []).find((e) => e.id === shape.engagementId)?.title ??
              "this engagement",
            itemCount: shape.itemCount,
          }
        : { kind: "none", reason: shape.reason };

  const engagementOptions = (engagements ?? []).map((e) => ({
    id: e.id,
    code: e.code,
    title: e.title,
  }));

  const readsDetail =
    shape.kind === "engagement"
      ? `the ${shape.itemCount} ${shape.itemCount === 1 ? "piece" : "pieces"} of work mapped into this engagement, oldest first`
      : shape.kind === "item" && shape.scope === "deliverable"
        ? "this piece of work, the conversations linked to it, and the brief when there is one"
        : "this conversation only, read in full";

  /** The chips row, identical before and during a session. */
  const chipsRow = (
    <AnalysisChips
      target={chipTarget}
      readsDetail={readsDetail}
      running={analyses.running}
      onRun={(preset) => void analyses.runPreset(preset, chipTarget, readsDetail)}
      engagementOptions={engagementOptions}
      onPickEngagement={(id) => applyScope({ mode: "engagements", ids: [id] })}
      onOpenPicker={() => setScopeOpen(true)}
    />
  );

  /** The scope control, in the same position with or without a session. */
  const scopeBar = (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
      <span className="micro-label">Looking at</span>
      <button
        type="button"
        onClick={() => setScopeOpen(true)}
        aria-label="Change which work feeds this conversation"
        className="rounded-full bg-accent-soft px-4 py-1.5 text-sm text-accent-deep transition-opacity hover:opacity-85"
      >
        {scopeSentence(scope, all, engagements ?? [])} · change
      </button>
      {scope.mode !== "whole" ? (
        <button
          type="button"
          onClick={() => applyScope(DEFAULT_SCOPE)}
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Use all of your work
        </button>
      ) : null}
    </div>
  );

  async function newSession(withScope: ContextScope = DEFAULT_SCOPE) {
    if (!profile) return;
    setError(null);
    const { data, error: insertError } = await supabase
      .from("chat_sessions")
      .insert({ profile_id: profile.id, org_id: profile.org_id, context_scope: withScope })
      .select("id")
      .single();
    if (insertError) return setError(insertError.message);
    logEvent("reflect.session_created", profile.org_id, {});
    await queryClient.invalidateQueries({ queryKey: ["reflect-sessions"] });
    setActiveId(data.id);
    setCoverage(null);
    setScopeNotes([]);
    analyses.clear();
  }

  async function deleteSession(id: string) {
    await supabase.from("chat_messages").delete().eq("session_id", id);
    const { error: deleteError } = await supabase.from("chat_sessions").delete().eq("id", id);
    if (deleteError) return setError(deleteError.message);
    if (activeId === id) setActiveId(null);
    await queryClient.invalidateQueries({ queryKey: ["reflect-sessions"] });
  }

  async function writeScope(next: ContextScope) {
    if (!activeId) return;
    const { error: scopeError } = await supabase
      .from("chat_sessions")
      .update({ context_scope: next })
      .eq("id", activeId);
    if (scopeError) return setError(scopeError.message);
    await queryClient.invalidateQueries({ queryKey: ["reflect-sessions"] });
  }

  /**
   * Widening applies in place. Narrowing cannot be honoured inside a session
   * the model has already read the removed work in, so it is offered as a
   * fresh chat rather than applied quietly.
   */
  function applyScope(next: ContextScope) {
    // No session yet: the choice creates the session it belongs to.
    if (!active) return void newSession(next);
    const before = new Set(itemsInScope(scope, all).map((i) => i.id));
    const after = new Set(itemsInScope(next, all).map((i) => i.id));
    const removed = Array.from(before).filter((id) => !after.has(id));
    const added = Array.from(after).filter((id) => !before.has(id));
    if (removed.length > 0) {
      // Nothing has been read yet in an empty session, so narrowing there is
      // silent. Only a conversation with history needs the fresh chat offer.
      const untouched = (messages ?? []).length === 0 && analyses.results.length === 0;
      if (!untouched) return setNarrowing(next);
    }
    void writeScope(next);
    if (added.length > 0) {
      setScopeNotes((prev) => [
        ...prev,
        `Added ${added.length} piece${added.length === 1 ? "" : "s"} of work to this conversation.`,
      ]);
    }
  }

  async function submit() {
    const message = draft.trim();
    if (!message || !activeId || !profile) return;
    setPending(true);
    setError(null);
    try {
      setStreamed("");
      setDraft("");
      const result = await streamChatRequest<ReflectResult>(
        "/api/reflect/stream",
        { session_id: activeId, message, profile_id: profile.id, surface: "reflect" },
        (delta) => setStreamed((prev) => prev + delta),
      );
      setCoverage({
        truncated: result.truncated,
        fullCount: result.fullCount,
        summaryCount: result.summaryCount,
      });
      await queryClient.invalidateQueries({ queryKey: ["reflect-messages", activeId] });
      await queryClient.invalidateQueries({ queryKey: ["reflect-sessions"] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
      setStreamed("");
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
          <Button className="w-full" onClick={() => void newSession()}>
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
                    setCoverage(null);
                    setScopeNotes([]);
                    analyses.clear();
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
                  className="rounded-full bg-accent-soft px-3 py-1 text-xs text-accent-deep"
                >
                  {scopeSentence(scope, all, engagements ?? [])} · change
                </button>
                {scope.mode !== "whole" ? (
                  <button
                    type="button"
                    onClick={() => applyScope(DEFAULT_SCOPE)}
                    className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Use all of your work
                  </button>
                ) : null}
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
                {(messages ?? []).length === 0 && analyses.results.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Private to you. Your coach never sees this.
                  </p>
                ) : null}
                {(messages ?? []).map((message) => (
                  <div key={message.id}>
                    <p className="micro-label">{message.role === "user" ? "You" : "Reflect"}</p>
                    {message.role === "user" ? (
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                        {message.content}
                      </p>
                    ) : (
                      <>
                        <MarkdownMessage content={message.content} />
                        <AnswerSources sources={sourcesByMessage?.[Number(message.id)] ?? []} />
                      </>
                    )}
                  </div>
                ))}

                <InlineAnalysisBlocks results={analyses.results} profileId={profile?.id} />

                {scopeNotes.map((note, index) => (
                  <p key={`${note}:${index}`} className="text-xs text-muted-foreground">
                    {note}
                  </p>
                ))}

                {pending && streamed ? (
                  <div>
                    <p className="micro-label">Reflect</p>
                    <MarkdownMessage content={streamed} />
                  </div>
                ) : null}
                {pending && !streamed ? <ThinkingIndicator /> : null}
                {analyses.running ? (
                  <ThinkingIndicator
                    stages={[
                      "Reading the work…",
                      "Matching it against what we look for…",
                      "Checking every quote against your work…",
                    ]}
                  />
                ) : null}
                {coverage?.truncated ? <CoverageNote {...coverage} /> : null}
                <div ref={bottomRef} />
              </div>

              {error || analyses.error ? (
                <p className="px-5 pb-2 text-sm text-destructive">{error ?? analyses.error}</p>
              ) : null}

              <div className="space-y-3 border-t border-border px-5 py-4">
                <AnalysisChips
                  target={chipTarget}
                  readsDetail={readsDetail}
                  running={analyses.running}
                  onRun={(preset) => void analyses.runPreset(preset, chipTarget, readsDetail)}
                />
                <div className="flex items-end gap-2">
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
              </div>
            </>
          )}
        </section>
      </div>

      <WorkScopePicker
        open={scopeOpen}
        onOpenChange={setScopeOpen}
        scope={scope}
        all={all}
        engagements={engagements ?? []}
        onApply={applyScope}
      />

      <AlertDialog
        open={narrowing !== null}
        onOpenChange={(next) => {
          if (!next) setNarrowing(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start a fresh chat with just this selection?</AlertDialogTitle>
            <AlertDialogDescription>
              I have already read that work in this conversation, so I would still have it in front
              of me.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setNarrowing(null)}>Keep this chat</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                const next = narrowing;
                setNarrowing(null);
                if (next) void newSession(next);
              }}
            >
              Start fresh
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

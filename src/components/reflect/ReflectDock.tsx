import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { SlideOver } from "@/components/peek/SlideOver";
import { ThinkingIndicator, WorkingLabel } from "@/components/common/Working";
import { AnswerSources } from "@/components/reflect/AnswerSources";
import { CoverageNote } from "@/components/reflect/CoverageNote";
import {
  InlineAnalysisBlocks,
  SelectionAnalysisChips,
  useChatAnalyses,
  type ChipTarget,
} from "@/components/reflect/ChatAnalyses";
import { MarkdownMessage } from "@/components/markdown/MarkdownMessage";
import {
  SaveForOneOnOneDialog,
  type SaveForOneOnOneTarget,
} from "@/components/oneonone/SaveForOneOnOne";
import { Button } from "@/components/ui/button";
import { useFirmChecks } from "@/hooks/use-firm-checks";
import { useProfile } from "@/hooks/use-profile";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useAnswerSources } from "@/hooks/use-answer-sources";
import { useWorkItems } from "@/hooks/use-work-items";
import { supabase } from "@/integrations/supabase/client";
import { streamChatRequest } from "@/lib/stream-client";
import type { ReflectResult } from "@/lib/reflect-run.server";
import { mappedItemsForEngagement } from "@/lib/reflect-scope-shape";
import { logEvent } from "@/lib/telemetry";
import type { ContextScope } from "@/lib/reflect-shared";
import type { AnalysisPreset } from "@/lib/analysis-presets";
import type { WorkItemRow } from "@/lib/work-types";

type MessageRow = { id: number; role: string; content: string };

/** Plain type words for the selector, never internal enum names. */
const TYPE_WORD: Record<string, string> = {
  ai_thread: "conversation",
  document: "document",
  deck: "deck",
  sheet: "sheet",
  email: "email",
  note: "note",
  transcript: "transcript",
};

/**
 * Reflect, docked beside an engagement. Same machinery as /reflect, the only
 * difference is the context scope, preset to this engagement. Chat content
 * never leaves this panel: only reflect.session_created / message_sent are
 * recorded, both content-free.
 */
export function ReflectDock({
  open,
  onOpenChange,
  engagementId,
  engagementTitle,
  profileId,
  orgId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  engagementId: string;
  engagementTitle: string;
  profileId: string;
  orgId: string;
}) {
  const queryClient = useQueryClient();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [streamed, setStreamed] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [saveTarget, setSaveTarget] = useState<SaveForOneOnOneTarget | null>(null);
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [coverage, setCoverage] = useState<{
    truncated: boolean;
    fullCount: number;
    summaryCount: number;
  } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const { data: work } = useWorkItems();
  const { data: profile } = useProfile();
  const mapped: WorkItemRow[] = mappedItemsForEngagement(work?.items ?? [], engagementId);
  const analyses = useChatAnalyses(profileId, orgId);
  // The firm's checks that apply here: org wide, this engagement, or this person.
  const { data: firmChecks } = useFirmChecks({
    orgId,
    engagementId,
    subjectProfileId: profileId,
  });

  // Everything mapped into this engagement is selected when the chat opens.
  // The person narrows from there; nothing is added behind their back.
  useEffect(() => {
    if (!open || selected !== null || mapped.length === 0) return;
    setSelected(new Set(mapped.map((i) => i.id)));
  }, [open, selected, mapped]);

  const selectedItems = mapped.filter((i) => (selected ? selected.has(i.id) : true));

  // The brief can live on the engagement itself rather than as a marked item,
  // and that counts for the analyses that need one.
  const { data: engagementBrief } = useQuery({
    queryKey: ["engagement-brief-present", engagementId],
    queryFn: async (): Promise<boolean> => {
      const { data } = await supabase
        .from("engagements")
        .select("brief")
        .eq("id", engagementId)
        .maybeSingle();
      return Boolean((data?.brief ?? "").trim());
    },
  });

  const mappedIds = mapped.map((i) => i.id);
  const { data: sessions } = useQuery({
    queryKey: ["dock-sessions", engagementId, profileId, mappedIds.length],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_sessions")
        .select("id, title, created_at, context_scope")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(50);
      const ids = new Set(mappedIds);
      return (data ?? []).filter((row) => {
        const scope = row.context_scope as { mode?: string; ids?: string[] } | null;
        if (!scope?.ids) return false;
        if (scope.mode === "engagements") return scope.ids.includes(engagementId);
        if (scope.mode === "items") return scope.ids.some((id) => ids.has(id));
        return false;
      });
    },
  });

  /** A fresh chat: no session, no prior analyses, the whole engagement again. */
  function newSession() {
    setSessionId(null);
    setSelected(new Set(mapped.map((i) => i.id)));
    setCoverage(null);
    setError(null);
    setDraft("");
    setHistoryOpen(false);
    analyses.clear();
  }

  function openSession(id: string) {
    setSessionId(id);
    setHistoryOpen(false);
    setCoverage(null);
    analyses.clear();
  }

  // The @ menu reads the word being typed just before the caret.
  function onDraftChange(value: string, caret: number) {
    setDraft(value);
    const upTo = value.slice(0, caret);
    const at = upTo.lastIndexOf("@");
    if (at === -1 || /\s/.test(upTo.slice(at + 1))) {
      setMention(null);
      return;
    }
    if (at > 0 && !/\s/.test(value[at - 1] ?? "")) {
      setMention(null);
      return;
    }
    setMention({ query: upTo.slice(at + 1), start: at });
    setMentionIndex(0);
  }

  const mentionMatches = mention
    ? mapped
        .filter((item) => item.title.toLowerCase().includes(mention.query.toLowerCase()))
        .slice(0, 6)
    : [];

  /** Insert the title as visible text, and make sure Lasso will read it. */
  function chooseMention(item: WorkItemRow) {
    if (!mention) return;
    const caret = composerRef.current?.selectionStart ?? draft.length;
    const next = `${draft.slice(0, mention.start)}@${item.title} ${draft.slice(caret)}`;
    setDraft(next);
    setMention(null);
    setSelected((prev) => {
      const base = new Set(prev ?? mapped.map((i) => i.id));
      base.add(item.id);
      return base;
    });
    composerRef.current?.focus();
  }

  function scopeForSelection(): ContextScope {
    if (!selected || selectedItems.length === 0 || selectedItems.length === mapped.length) {
      return { mode: "engagements", ids: [engagementId] };
    }
    return { mode: "items", ids: selectedItems.map((i) => i.id) };
  }
  const scopeKey = scopeForSelection().ids.join(",") + selectedItems.length;

  // A live session follows the selection, so what Lasso reads and what the
  // audit strip records are always the current choice.
  useEffect(() => {
    if (!sessionId) return;
    void supabase
      .from("chat_sessions")
      .update({ context_scope: scopeForSelection() })
      .eq("id", sessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, scopeKey]);

  const { data: messages } = useQuery({
    queryKey: ["reflect-messages", sessionId],
    enabled: Boolean(sessionId),
    queryFn: async (): Promise<MessageRow[]> => {
      const { data, error: e } = await supabase
        .from("chat_messages")
        .select("id, role, content")
        .eq("session_id", sessionId as string)
        .order("created_at", { ascending: true });
      if (e) throw e;
      return (data ?? []) as MessageRow[];
    },
  });

  const { data: sourcesByMessage } = useAnswerSources(
    (messages ?? []).filter((m) => m.role === "assistant").map((m) => Number(m.id)),
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length, pending]);

  async function ensureSession(): Promise<string | null> {
    if (sessionId) return sessionId;
    const scope: ContextScope = scopeForSelection();
    const { data, error: e } = await supabase
      .from("chat_sessions")
      .insert({
        profile_id: profileId,
        org_id: orgId,
        context_scope: scope,
        title: engagementTitle,
      })
      .select("id")
      .single();
    if (e) {
      setError(e.message);
      return null;
    }
    logEvent("reflect.session_created", orgId, {});
    setSessionId(data.id);
    await queryClient.invalidateQueries({ queryKey: ["reflect-sessions"] });
    return data.id;
  }

  async function submit() {
    const message = draft.trim();
    if (!message || pending) return;
    setPending(true);
    setError(null);
    try {
      const id = await ensureSession();
      if (!id) return;
      setStreamed("");
      setDraft("");
      const result = await streamChatRequest<ReflectResult>(
        "/api/reflect/stream",
        { session_id: id, message, profile_id: profileId, surface: "ask_lasso" },
        (delta) => setStreamed((prev) => prev + delta),
      );
      setCoverage({
        truncated: result.truncated,
        fullCount: result.fullCount,
        summaryCount: result.summaryCount,
      });
      await queryClient.invalidateQueries({ queryKey: ["reflect-messages", id] });
      await queryClient.invalidateQueries({ queryKey: ["reflect-sessions"] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
      setStreamed("");
    }
  }

  return (
    <SlideOver
      open={open}
      onOpenChange={onOpenChange}
      title="Ask Lasso"
      description="Reflect on this engagement"
    >
      <header className="shrink-0 border-b border-border px-6 pb-4 pt-6">
        <p className="micro-label">Ask Lasso</p>
        <h2 className="page-title mt-1 break-words text-[19px] leading-snug">{engagementTitle}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-accent-soft px-3 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-accent-deep">
            {selectedItems.length === mapped.length
              ? "All work in this engagement"
              : selectedItems.length === 1
                ? "1 piece of work selected"
                : `${selectedItems.length} pieces of work selected`}
          </span>
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
          >
            {pickerOpen ? "Hide what Lasso will read" : "Choose what Lasso will read"}
          </button>
          <button
            type="button"
            onClick={newSession}
            className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
          >
            New session
          </button>
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
          >
            {historyOpen ? "Hide earlier sessions" : "Earlier sessions"}
          </button>
        </div>

        {historyOpen ? (
          <div className="mt-3 max-h-48 space-y-1 overflow-y-auto rounded-[var(--radius-md)] border border-border bg-secondary/40 px-3 py-3">
            {(sessions ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No earlier sessions on this work yet.</p>
            ) : (
              (sessions ?? []).map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => openSession(row.id)}
                  className={`block w-full truncate text-left text-sm transition-colors hover:text-foreground ${
                    row.id === sessionId ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {row.title ?? "Untitled"}{" "}
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em]">
                    {new Date(row.created_at).toLocaleDateString()}
                  </span>
                </button>
              ))
            )}
          </div>
        ) : null}

        {pickerOpen ? (
          <div className="mt-3 max-h-56 space-y-1.5 overflow-y-auto rounded-[var(--radius-md)] border border-border bg-secondary/40 px-3 py-3">
            {mapped.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No work is mapped into this engagement yet.
              </p>
            ) : (
              mapped.map((item) => (
                <label key={item.id} className="flex items-start gap-2 text-sm text-foreground">
                  <Checkbox
                    checked={selected ? selected.has(item.id) : true}
                    onCheckedChange={(value) =>
                      setSelected((prev) => {
                        const next = new Set(prev ?? mapped.map((i) => i.id));
                        if (value === true) next.add(item.id);
                        else next.delete(item.id);
                        return next;
                      })
                    }
                  />
                  <span className="min-w-0">
                    <span className="break-words">{item.title}</span>{" "}
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                      {TYPE_WORD[item.type] ?? item.type}
                    </span>
                  </span>
                </label>
              ))
            )}
          </div>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
        {(messages ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Looking only at this engagement. Private to you, your coach never sees this.
          </p>
        ) : null}
        {mapped.length > 0 ? (
          <SelectionAnalysisChips
            selected={selectedItems}
            engagement={{ id: engagementId, title: engagementTitle }}
            briefCandidates={mapped}
            engagementHasBrief={engagementBrief ?? false}
            firmCheckCount={(firmChecks ?? []).length}
            orgName={profile?.org_name}
            canAuthorChecks={profile?.role === "coach" || profile?.role === "admin"}
            onAuthorCheck={() => onOpenChange(false)}
            readsDetail={
              selectedItems.length === 1
                ? "The piece of work you selected, and the brief when one exists."
                : "The pieces of work you selected, and the brief when one exists."
            }
            running={analyses.running}
            onRun={(preset: AnalysisPreset, target: ChipTarget) =>
              void analyses.runPreset(
                preset,
                target,
                selectedItems.length === 1
                  ? "The piece of work you selected, and the brief when one exists."
                  : "The pieces of work you selected, and the brief when one exists.",
              )
            }
          />
        ) : null}
        {analyses.error ? <p className="text-sm text-destructive">{analyses.error}</p> : null}
        <InlineAnalysisBlocks
          results={analyses.results}
          profileId={profileId}
          onSaveForOneOnOne={(input) => setSaveTarget(input)}
        />
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
                <button
                  type="button"
                  onClick={() =>
                    setSaveTarget({
                      text: message.content,
                      kind: "chat_excerpt",
                      sessionId,
                    })
                  }
                  className="mt-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
                >
                  Save for 1:1
                </button>
              </>
            )}
          </div>
        ))}
        {pending && streamed ? (
          <div>
            <p className="micro-label">Reflect</p>
            <MarkdownMessage content={streamed} />
          </div>
        ) : null}
        {pending && !streamed ? <ThinkingIndicator /> : null}
        {coverage?.truncated ? <CoverageNote {...coverage} /> : null}
        <div ref={bottomRef} />
      </div>

      {error ? <p className="px-6 pb-2 text-sm text-destructive">{error}</p> : null}

      <footer className="shrink-0 border-t border-border bg-card px-6 py-4">
        {mention && mentionMatches.length > 0 ? (
          <div className="mb-2 max-h-44 overflow-y-auto rounded-[var(--radius-md)] border border-border bg-card shadow-card">
            {mentionMatches.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  chooseMention(item);
                }}
                className={`block w-full px-3 py-1.5 text-left text-sm ${
                  index === mentionIndex ? "bg-secondary text-foreground" : "text-muted-foreground"
                }`}
              >
                <span className="break-words">{item.title}</span>{" "}
                <span className="font-mono text-[10px] uppercase tracking-[0.08em]">
                  {TYPE_WORD[item.type] ?? item.type}
                </span>
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <Textarea
            ref={composerRef}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value, event.target.selectionStart ?? 0)}
            onKeyDown={(event) => {
              if (!mention || mentionMatches.length === 0) return;
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setMentionIndex((i) => (i + 1) % mentionMatches.length);
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setMentionIndex((i) => (i - 1 + mentionMatches.length) % mentionMatches.length);
              } else if (event.key === "Enter") {
                event.preventDefault();
                const pick = mentionMatches[mentionIndex];
                if (pick) chooseMention(pick);
              } else if (event.key === "Escape") {
                setMention(null);
              }
            }}
            placeholder="What do you want to think through? Type @ to point at a piece of work."
            rows={2}
            className="resize-none"
          />
          <Button onClick={() => void submit()} disabled={pending || !draft.trim()}>
            {pending ? <WorkingLabel>Sending</WorkingLabel> : "Send"}
          </Button>
        </div>
        <Link
          to="/reflect"
          className="mt-3 inline-block text-xs font-medium text-accent-deep transition-opacity hover:opacity-70"
        >
          Open in Reflect →
        </Link>
      </footer>
      <SaveForOneOnOneDialog
        target={saveTarget}
        onOpenChange={(next) => {
          if (!next) setSaveTarget(null);
        }}
        profileId={profileId}
        orgId={orgId}
      />
    </SlideOver>
  );
}

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
import { Button } from "@/components/ui/button";
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
  const [coverage, setCoverage] = useState<{
    truncated: boolean;
    fullCount: number;
    summaryCount: number;
  } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: work } = useWorkItems();
  const mapped: WorkItemRow[] = mappedItemsForEngagement(work?.items ?? [], engagementId);
  const analyses = useChatAnalyses(profileId, orgId);

  // Everything mapped into this engagement is selected when the chat opens.
  // The person narrows from there; nothing is added behind their back.
  useEffect(() => {
    if (!open || selected !== null || mapped.length === 0) return;
    setSelected(new Set(mapped.map((i) => i.id)));
  }, [open, selected, mapped]);

  const selectedItems = mapped.filter((i) => (selected ? selected.has(i.id) : true));

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
        </div>

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
        <InlineAnalysisBlocks results={analyses.results} profileId={profileId} />
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
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="What do you want to think through?"
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
    </SlideOver>
  );
}

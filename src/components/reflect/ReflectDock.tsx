import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { SlideOver } from "@/components/peek/SlideOver";
import { ThinkingIndicator, WorkingLabel } from "@/components/common/Working";
import { AnswerSources } from "@/components/reflect/AnswerSources";
import { CoverageNote } from "@/components/reflect/CoverageNote";
import { MarkdownMessage } from "@/components/markdown/MarkdownMessage";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAnswerSources } from "@/hooks/use-answer-sources";
import { supabase } from "@/integrations/supabase/client";
import { sendReflectMessage } from "@/lib/reflect.functions";
import { logEvent } from "@/lib/telemetry";
import type { ContextScope } from "@/lib/reflect-shared";

type MessageRow = { id: number; role: string; content: string };

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
  const send = useServerFn(sendReflectMessage);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<{
    truncated: boolean;
    fullCount: number;
    summaryCount: number;
  } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

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
    const scope: ContextScope = { mode: "engagements", ids: [engagementId] };
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
      const result = await send({
        data: { session_id: id, message, profile_id: profileId, surface: "ask_lasso" },
      });
      setDraft("");
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
            This engagement
          </span>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
        {(messages ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Looking only at this engagement. Private to you, your coach never sees this.
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
                <AnswerSources
                  sources={sourcesByMessage?.[Number(message.id)] ?? []}
                />
              </>
            )}
          </div>
        ))}
        {pending ? <ThinkingIndicator /> : null}
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

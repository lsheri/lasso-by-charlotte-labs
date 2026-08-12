import { ThinkingIndicator, WorkingLabel } from "@/components/common/Working";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { MarkdownMessage } from "@/components/markdown/MarkdownMessage";
import { SlideOver } from "@/components/peek/SlideOver";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { sendReflectMessage } from "@/lib/reflect.functions";
import {
  FLUENCY_ATTRIBUTION,
  FLUENCY_OPENING_MESSAGE,
  type ContextScope,
} from "@/lib/reflect-shared";
import { logEvent } from "@/lib/telemetry";

type MessageRow = { id: number; role: string; content: string };

/**
 * The AI Fluency lens: a new Ask Lasso session scoped to one thread, opened
 * with a preset prompt. Owner only, in their own session, never scored.
 */
export function FluencyLens({
  open,
  onOpenChange,
  workItemId,
  workItemTitle,
  profileId,
  orgId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workItemId: string;
  workItemTitle: string;
  profileId: string;
  orgId: string;
}) {
  const queryClient = useQueryClient();
  const send = useServerFn(sendReflectMessage);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length, pending]);

  async function newSession(): Promise<string | null> {
    const scope: ContextScope = { mode: "items", ids: [workItemId] };
    const { data, error: e } = await supabase
      .from("chat_sessions")
      .insert({
        profile_id: profileId,
        org_id: orgId,
        context_scope: scope,
        title: `AI Fluency lens: ${workItemTitle}`.slice(0, 120),
      })
      .select("id")
      .single();
    if (e) {
      setError(e.message);
      return null;
    }
    logEvent("reflect.session_created", orgId, { preset: "ai_fluency_4d" });
    setSessionId(data.id);
    await queryClient.invalidateQueries({ queryKey: ["reflect-sessions"] });
    return data.id;
  }

  async function ask(message: string, id: string) {
    setPending(true);
    setError(null);
    try {
      await send({
        data: {
          session_id: id,
          message,
          profile_id: profileId,
          surface: "ask_lasso",
          preset: "ai_fluency_4d",
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["reflect-messages", id] });
      await queryClient.invalidateQueries({ queryKey: ["reflect-sessions"] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  // One session per opening, started automatically: the preset is the point.
  useEffect(() => {
    if (!open || started.current) return;
    started.current = true;
    void (async () => {
      const id = await newSession();
      if (id) await ask(FLUENCY_OPENING_MESSAGE, id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function submit() {
    const message = draft.trim();
    if (!message || !sessionId || pending) return;
    setDraft("");
    await ask(message, sessionId);
  }

  return (
    <SlideOver
      open={open}
      onOpenChange={onOpenChange}
      title="AI Fluency lens"
      description="Reflect on how you worked with the AI in this conversation"
    >
      <header className="shrink-0 border-b border-border px-6 pb-4 pt-6">
        <p className="micro-label">AI Fluency lens</p>
        <h2 className="page-title mt-1 break-words text-[19px] leading-snug">{workItemTitle}</h2>
        <p className="mt-2 text-xs text-muted-foreground">
          Private to you. Observations only, never a score.
        </p>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
        {(messages ?? []).map((message) =>
          message.role === "user" && message.content === FLUENCY_OPENING_MESSAGE ? null : (
            <div key={message.id}>
              <p className="micro-label">{message.role === "user" ? "You" : "Reflect"}</p>
              {message.role === "user" ? (
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {message.content}
                </p>
              ) : (
                <MarkdownMessage content={message.content} />
              )}
            </div>
          ),
        )}
        {pending ? (
          <ThinkingIndicator
            stages={[
              "Reading the conversation…",
              "Looking at how you worked with the AI…",
              "Writing it up…",
            ]}
          />
        ) : null}
        {(messages ?? []).some((m) => m.role === "assistant") ? (
          <p className="border-t border-border pt-4 text-xs text-muted-foreground">
            {FLUENCY_ATTRIBUTION}
          </p>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {error ? <p className="px-6 pb-2 text-sm text-destructive">{error}</p> : null}

      <footer className="shrink-0 border-t border-border bg-card px-6 py-4">
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask a follow up about this conversation"
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

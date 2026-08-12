import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ContextSource } from "@/lib/reflect-shared";

type SendInput = {
  session_id: string;
  message: string;
  profile_id?: string | undefined;
  surface?: "reflect" | "ask_lasso" | undefined;
  preset?: "ai_fluency_4d" | undefined;
};

/** Bucketed so an exact count never leaves as a dimension. */
function tierBucket(n: number): string {
  if (n <= 0) return "0";
  if (n <= 5) return "1-5";
  if (n <= 20) return "6-20";
  return "20+";
}

/** Long enough that a real answer is never cut off, short enough to fail loudly. */
const ANSWER_TIMEOUT_MS = 180_000;

export const sendReflectMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SendInput) => input)
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      answer: string;
      truncated: boolean;
      title: string | null;
      fullCount: number;
      summaryCount: number;
      messageId: number | null;
      sources: ContextSource[];
      unmatchedQuotes: number;
      cutOff: boolean;
    }> => {
      const { supabase, userId } = context;
      const message = data.message.trim();
      if (!message) throw new Error("Write something first.");

      const { resolveProfile } = await import("./profile-resolve");
      const profile = await resolveProfile(supabase, userId, data.profile_id);
      if (!profile) throw new Response("Forbidden", { status: 403 });

      const { data: session, error: sessionError } = await supabase
        .from("chat_sessions")
        .select("id, profile_id, title, context_scope")
        .eq("id", data.session_id)
        .maybeSingle();
      if (sessionError) throw new Error(sessionError.message);
      if (!session || session.profile_id !== profile.id) {
        throw new Response("Forbidden", { status: 403 });
      }

      const { parseScope, titleFromMessage, REFLECT_SYSTEM_PROMPT, FLUENCY_SYSTEM_PROMPT } =
        await import("./reflect-shared");
      const scope = parseScope(session.context_scope);
      const preset = data.preset === "ai_fluency_4d" ? "ai_fluency_4d" : null;

      const { data: history } = await supabase
        .from("chat_messages")
        .select("role, content")
        .eq("session_id", session.id)
        .order("created_at", { ascending: true })
        .limit(40);

      const { assembleReflectContext } = await import("./reflect-context.server");
      const assembled = await assembleReflectContext(supabase, profile.id, scope);

      const surface = data.surface === "ask_lasso" ? "ask_lasso" : "reflect";

      const apiKey = process.env["LOVABLE_API_KEY"];
      if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

      // gemini-2.5-pro is deliberate: the whole record can be very large.
      let response: Response;
      try {
        response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        signal: AbortSignal.timeout(ANSWER_TIMEOUT_MS),
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": apiKey,
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          max_tokens: 8000,
          messages: [
            { role: "system", content: REFLECT_SYSTEM_PROMPT },
            ...(preset ? [{ role: "system", content: FLUENCY_SYSTEM_PROMPT }] : []),
            {
              role: "system",
              content: `THE PERSON'S RECORDED WORK (scope: ${scope.mode}):\n\n${assembled.context}`,
            },
            ...((history ?? []) as { role: string; content: string }[]).map((m) => ({
              role: m.role === "assistant" ? "assistant" : "user",
              content: m.content,
            })),
            { role: "user", content: message },
          ],
        }),
        });
      } catch (e) {
        if ((e as Error).name === "TimeoutError" || (e as Error).name === "AbortError") {
          throw new Error("That took too long to answer. Try a narrower scope.");
        }
        throw e;
      }

      if (!response.ok) {
        const body = await response.text();
        if (response.status === 429) throw new Error("Rate limited. Try again in a moment.");
        if (response.status === 402) throw new Error("AI credits exhausted for this workspace.");
        throw new Error(`AI request failed (${response.status}): ${body.slice(0, 300)}`);
      }

      const payload = (await response.json()) as {
        choices?: { message?: { content?: string }; finish_reason?: string }[];
      };
      const rawFinish = payload.choices?.[0]?.finish_reason ?? "stop";
      const finishReason = rawFinish === "stop" ? "stop" : rawFinish === "length" ? "length" : "other";
      const cutOff = finishReason === "length";
      const { CUT_OFF_NOTE } = await import("./quote-check");
      const base =
        payload.choices?.[0]?.message?.content?.trim() ??
        "I couldn't draw an answer out of that. Try asking a different way.";
      // Never present a cut-off answer as if it were complete, and never discard it.
      const answer = cutOff ? `${base}\n\n${CUT_OFF_NOTE}` : base;

      const { data: written, error: insertError } = await supabase
        .from("chat_messages")
        .insert([
          { session_id: session.id, role: "user", content: message },
          { session_id: session.id, role: "assistant", content: answer },
        ])
        .select("id, role");
      if (insertError) throw new Error(insertError.message);

      // The content companion to ai_reads: what was asked, about whose work,
      // and which answer it produced. Tenant content, never telemetry.
      const answerId = (written ?? []).find((row) => row.role === "assistant")?.id ?? null;

      // The audit trail is attached to the exact answer it belongs to.
      const { recordAiReads } = await import("./ai-reads.server");
      await recordAiReads(assembled.reads, {
        surface,
        readerRole: "owner",
        readerProfileId: profile.id,
        messageId: answerId,
      });

      const { unmatchedQuotes, quoteBucket } = await import("./quote-check");
      const unmatched = unmatchedQuotes(base, assembled.context, cutOff);
      const scopeLabelForLog =
        scope.mode === "whole"
          ? "whole record"
          : scope.mode === "engagements"
            ? "engagement"
            : scope.mode === "tasks"
              ? "task"
              : "item";
      const { error: logError } = await supabase.from("query_log").insert({
        asker_id: profile.id,
        subject_id: profile.id,
        scope: scopeLabelForLog,
        question: message,
        answer_ref: answerId === null ? null : String(answerId),
      });
      if (logError) console.error("[query_log] insert failed:", logError.message);

      const title = session.title ?? titleFromMessage(message);
      await supabase
        .from("chat_sessions")
        .update({ title, updated_at: new Date().toISOString() })
        .eq("id", session.id);

      // Content-free by construction: the scope mode is the only dimension.
      const { recordEvent } = await import("./telemetry.server");
      await recordEvent(supabase, {
        eventType: "reflect.message_sent",
        orgId: profile.org_id,
        userId,
        dims: {
          scope: scope.mode,
          truncated: assembled.truncated,
          tier2_items: tierBucket(assembled.tier2Count),
          unmatched_quotes: quoteBucket(unmatched.length),
          finish_reason: finishReason,
          ...(preset ? { preset } : {}),
        },
      });

      return {
        answer,
        truncated: assembled.truncated,
        title,
        fullCount: assembled.tier2Count,
        summaryCount: Math.max(
          assembled.tier1Count - assembled.tier2Count - assembled.unreadableCount,
          0,
        ),
        messageId: answerId,
        sources: assembled.sources,
        unmatchedQuotes: unmatched.length,
        cutOff,
      };
    },
  );

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

export type HistoryRow = {
  id?: number | string;
  role: string;
  content: string;
  context_manifest?: unknown;
};

/**
 * AQ-1. The question is written the moment the server accepts it, before any
 * reading or model call, so leaving the page, a timeout or a model error never
 * loses what the person typed.
 *
 * Idempotency: if the session's latest row is a user row with exactly the same
 * text (an unanswered question), that row is reused rather than written again.
 * A client retry or the "Ask again" resend therefore never duplicates. Asking
 * the same thing after an answer exists writes a new row, as it should.
 *
 * Returns the user row id and the history without the reused row, so the
 * prompt the model sees is identical to before.
 */
export async function ensureQuestionRow(
  supabase: SupabaseClient<Database>,
  sessionId: string,
  question: string,
  history: HistoryRow[],
): Promise<{ userMessageId: number | null; history: HistoryRow[]; reused: boolean }> {
  const last = history[history.length - 1];
  if (last && last.role === "user" && last.content.trim() === question && last.id !== undefined) {
    return { userMessageId: Number(last.id), history: history.slice(0, -1), reused: true };
  }
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({ session_id: sessionId, role: "user", content: question })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { userMessageId: data?.id ?? null, history, reused: false };
}

/**
 * User rows with no answer after them. The newest row only counts once no
 * send is in flight, so the question being answered right now never shows it.
 */
export function unansweredQuestionIds(
  messages: { id: number | string; role: string }[],
  pending: boolean,
): Set<string> {
  const out = new Set<string>();
  messages.forEach((m, i) => {
    if (m.role !== "user") return;
    const next = messages[i + 1];
    if (next === undefined) {
      if (!pending) out.add(String(m.id));
    } else if (next.role === "user") {
      out.add(String(m.id));
    }
  });
  return out;
}

export const NO_ANSWER_COPY = {
  line: "No answer saved.",
  action: "Ask again",
} as const;

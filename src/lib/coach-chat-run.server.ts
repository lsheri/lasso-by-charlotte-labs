import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { COACH_CHAT_SYSTEM_PROMPT, type CoachChatInput } from "@/lib/coach-chat-shared";
import { resolveProfile } from "@/lib/profile-resolve";
import type { ContextSource } from "@/lib/reflect-shared";

export type CoachChatResult = {
  answer: string;
  truncated: boolean;
  fullCount: number;
  summaryCount: number;
  sources: ContextSource[];
  cutOff: boolean;
};

/** One coach question. Streams when a delta sink is given. */
export async function runCoachChat(
  supabase: SupabaseClient<Database>,
  userId: string,
  data: CoachChatInput,
  onDelta?: (delta: string) => void,
): Promise<CoachChatResult> {
  const profile = await resolveProfile(supabase, userId, data.profile_id);
  if (!profile) throw new Response("Forbidden", { status: 403 });

  // Everything below is read as the coach, so row-level policies decide what
  // the record contains. Nothing private or unmapped can reach the model.
  const [tasksRes, decisionsRes, subjectRes] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id, name, goal, when_label, work_item_tasks(step_no, step_confirmed, work_items(id, title, type, source, source_vendor, content_fidelity, work_date, created_at_source, captured_at, meta))",
      )
      .eq("engagement_id", data.engagement_id)
      .eq("owner_id", data.subject_id)
      .order("position", { ascending: true }),
    supabase
      .from("decisions")
      .select("id, situation, call_text, why, date_label, srcs")
      .eq("engagement_id", data.engagement_id)
      .eq("owner_id", data.subject_id)
      .eq("status", "confirmed"),
    supabase.from("profiles").select("display_name").eq("id", data.subject_id).maybeSingle(),
  ]);

  if (tasksRes.error) throw new Error(tasksRes.error.message);
  if (decisionsRes.error) throw new Error(decisionsRes.error.message);

  const tasks = (tasksRes.data ?? []) as unknown as {
    id: string;
    name: string;
    goal: string | null;
    when_label: string | null;
    work_item_tasks: {
      step_no: number | null;
      step_confirmed: boolean;
      work_items: Record<string, unknown> | null;
    }[];
  }[];

  if (tasks.length === 0 && (decisionsRes.data ?? []).length === 0) {
    return {
      answer:
        "There's nothing in this record yet, no confirmed decisions and no mapped work for this engagement.",
      truncated: false,
      fullCount: 0,
      summaryCount: 0,
      sources: [],
      cutOff: false,
    };
  }

  // Coaches never see raw content. They do see the compact extract, which is
  // itself readable to them through the same row-level policy as the item.
  const itemIds = tasks.flatMap((task) =>
    (task.work_item_tasks ?? [])
      .map((link) => link.work_items?.["id"])
      .filter((id): id is string => typeof id === "string"),
  );
  const { data: extractRows } = itemIds.length
    ? await supabase
        .from("work_item_extracts")
        .select("work_item_id, summary, decisions, entities, handoff")
        .in("work_item_id", itemIds)
    : { data: [] };
  const extractFor = new Map((extractRows ?? []).map((row) => [row.work_item_id as string, row]));

  // The coach's view of a vendor chip obeys the org setting, exactly as the
  // deliverable view does. The owner is never affected by it.
  const { data: subjectOrg } = await supabase
    .from("profiles")
    .select("org_id, orgs(vendor_display)")
    .eq("id", data.subject_id)
    .maybeSingle();
  const vendorVisible =
    profile.id === data.subject_id ||
    (subjectOrg as unknown as { orgs?: { vendor_display?: string } } | null)?.orgs
      ?.vendor_display !== "vendor_neutral";

  const record = {
    colleague: subjectRes.data?.display_name ?? "your colleague",
    ...briefRecord(tasks, extractFor),
    tasks: tasks.map((task) => ({
      task_id: task.id,
      name: task.name,
      goal: task.goal,
      when: task.when_label,
      elements: (task.work_item_tasks ?? [])
        .filter((link) => link.work_items !== null)
        .sort((a, b) => (a.step_no ?? 999) - (b.step_no ?? 999))
        .map((link) => ({
          step_no: link.step_no,
          sequence_confirmed: link.step_confirmed,
          title: link.work_items?.["title"],
          summary: extractFor.get(String(link.work_items?.["id"]))?.summary ?? null,
          decided: extractFor.get(String(link.work_items?.["id"]))?.decisions ?? null,
          led_to: extractFor.get(String(link.work_items?.["id"]))?.handoff ?? null,
          type: link.work_items?.["type"],
          source: link.work_items?.["source"],
          fidelity: link.work_items?.["content_fidelity"],
          date:
            link.work_items?.["work_date"] ??
            link.work_items?.["created_at_source"] ??
            link.work_items?.["captured_at"],
        })),
    })),
    confirmed_decisions: (decisionsRes.data ?? []).map((decision) => ({
      decision_id: decision.id,
      situation: decision.situation,
      call: decision.call_text,
      why: decision.why,
      when: decision.date_label,
      source_count: Array.isArray(decision.srcs) ? decision.srcs.length : 0,
    })),
  };

  const { chatComplete, streamChat, resolveAiMeta } = await import("./ai.server");
  const aiMeta = await resolveAiMeta(supabase, {
    surface: "coach_chat",
    orgId: profile.org_id,
    userId,
  });
  const conversation = [
    { role: "system" as const, content: COACH_CHAT_SYSTEM_PROMPT },
    {
      role: "user" as const,
      content: `THE RECORD:\n${JSON.stringify(record)}\n\nQUESTION:\n${data.question}`,
    },
  ];
  const options = { tier: "smart" as const, maxTokens: 8000, meta: aiMeta };
  const completion = onDelta
    ? await streamChat(conversation, onDelta, options)
    : await chatComplete(conversation, options);

  const cutOff = completion.finishReason === "length";
  const { CUT_OFF_NOTE } = await import("./quote-check");
  const base = completion.text || "The record doesn't give me enough to answer that.";
  const answer = cutOff ? `${base}\n\n${CUT_OFF_NOTE}` : base;

  const { recordAiReads } = await import("./ai-reads.server");
  await recordAiReads(
    itemIds.map((id) => ({
      workItemId: id,
      ownerId: data.subject_id,
      depth: "extract" as const,
    })),
    { surface: "coach_chat", readerRole: "coach", readerProfileId: profile.id },
  );

  await supabase.from("query_log").insert({
    asker_id: profile.id,
    subject_id: data.subject_id,
    scope: "engagement",
    question: data.question,
  });

  const { reportAiAudit } = await import("./ai-health.server");
  await reportAiAudit({
    orgId: profile.org_id,
    orgName: aiMeta.orgName,
    surface: "coach_chat",
    model: completion.model,
    question: data.question,
    answer,
    itemsRead: itemIds.map((id) => ({ title: id, depth: "extract" })),
    quoteRepairs: 0,
    quoteFailures: [],
    truncated: itemIds.length > 0,
    tokensIn: completion.tokensIn,
    tokensOut: completion.tokensOut,
    cachedIn: completion.cachedIn,
    costUsd: completion.costUsd,
    durationMs: completion.durationMs,
  });

  const { usageDims } = await import("./ai-usage");
  const { recordEvent } = await import("./telemetry.server");
  await recordEvent(supabase, {
    eventType: "coachchat.asked",
    orgId: profile.org_id,
    userId,
    dims: { role: profile.role, ...usageDims(completion) },
  });

  const seen = new Set<string>();
  const sources: ContextSource[] = [];
  for (const task of tasks) {
    for (const link of task.work_item_tasks ?? []) {
      const item = link.work_items;
      const id = typeof item?.["id"] === "string" ? (item["id"] as string) : null;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      sources.push({
        id,
        title: String(item?.["title"] ?? "Untitled"),
        type: String(item?.["type"] ?? "document"),
        source_vendor: vendorVisible ? ((item?.["source_vendor"] as string | null) ?? null) : null,
        depth: "extract",
      });
    }
  }

  return {
    answer,
    truncated: itemIds.length > 0,
    fullCount: 0,
    summaryCount: itemIds.length,
    sources,
    cutOff,
  };
}

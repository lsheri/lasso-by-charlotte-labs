import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { COACH_CHAT_SYSTEM_PROMPT, validateCoachChat } from "@/lib/coach-chat-shared";
import { resolveProfile } from "@/lib/profile-resolve";

export const askCoachChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateCoachChat)
  .handler(async ({ data, context }): Promise<{ answer: string }> => {
    const { supabase, userId } = context;

    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });

    // Everything below is read as the coach, so row-level policies decide what
    // the record contains. Nothing private or unmapped can reach the model.
    const [tasksRes, decisionsRes, subjectRes] = await Promise.all([
      supabase
        .from("tasks")
        .select(
          "id, name, goal, when_label, work_item_tasks(step_no, step_confirmed, work_items(id, title, type, source, content_fidelity, work_date, created_at_source, captured_at))",
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
          "There's nothing in this record yet — no confirmed decisions and no mapped work for this engagement.",
      };
    }

    const record = {
      colleague: subjectRes.data?.display_name ?? "your colleague",
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

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        max_tokens: 1200,
        messages: [
          { role: "system", content: COACH_CHAT_SYSTEM_PROMPT },
          {
            role: "user",
            content: `THE RECORD:\n${JSON.stringify(record)}\n\nQUESTION:\n${data.question}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      if (response.status === 429) throw new Error("Rate limited — try again in a moment.");
      if (response.status === 402) throw new Error("AI credits exhausted for this workspace.");
      throw new Error(`AI request failed (${response.status}): ${body.slice(0, 300)}`);
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const answer =
      payload.choices?.[0]?.message?.content?.trim() ??
      "The record doesn't give me enough to answer that.";

    await supabase.from("query_log").insert({
      asker_id: profile.id,
      subject_id: data.subject_id,
      scope: "engagement",
      question: data.question,
    });

    try {
      const encoded = new TextEncoder().encode(profile.org_id);
      const digest = await crypto.subtle.digest("SHA-256", encoded);
      const tenant_hash = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      await supabase.from("events").insert({
        event_type: "coachchat.asked",
        schema_version: "v1",
        tenant_hash,
        dims: { role: profile.role },
        payload: {},
      });
    } catch {
      /* telemetry never blocks */
    }

    return { answer };
  });

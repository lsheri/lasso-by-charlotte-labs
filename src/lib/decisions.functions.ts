import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveProfile } from "@/lib/profile-resolve";
import { DRAFT_SYSTEM_PROMPT, DRAFT_TOOL, dateLabel, type DraftedDecision } from "@/lib/decisions-shared";

export const draftDecisions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { work_item_id: string; profile_id?: string | undefined }) => {
    if (!input || typeof input.work_item_id !== "string" || !input.work_item_id) {
      throw new Error("work_item_id is required");
    }
    return { work_item_id: input.work_item_id, profile_id: input.profile_id ?? null };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });

    const { data: item, error: itemError } = await supabase
      .from("work_items")
      .select("id, owner_id, type, source")
      .eq("id", data.work_item_id)
      .maybeSingle();
    if (itemError) throw new Error(itemError.message);
    if (!item || item.owner_id !== profile.id) throw new Response("Forbidden", { status: 403 });

    const { data: turns, error: turnsError } = await supabase
      .from("turns")
      .select("id, turn_no, role, content")
      .eq("work_item_id", item.id)
      .order("turn_no", { ascending: true });
    if (turnsError) throw new Error(turnsError.message);
    if (!turns || turns.length === 0) return { drafted: 0 };

    const { data: mapped } = await supabase
      .from("work_item_tasks")
      .select("tasks(engagement_id)")
      .eq("work_item_id", item.id);
    const engagementIds = Array.from(
      new Set(
        ((mapped ?? []) as unknown as { tasks: { engagement_id: string } | null }[])
          .map((row) => row.tasks?.engagement_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const engagementId = engagementIds.length === 1 ? (engagementIds[0] as string) : null;

    const transcript = turns
      .map((turn) => `TURN ${turn.turn_no} · ${turn.role.toUpperCase()}\n${turn.content}`)
      .join("\n\n");

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
        max_tokens: 1500,
        messages: [
          { role: "system", content: DRAFT_SYSTEM_PROMPT },
          { role: "user", content: transcript },
        ],
        tools: [DRAFT_TOOL],
        tool_choice: { type: "function", function: { name: "record_decisions" } },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      if (response.status === 429) throw new Error("Rate limited — try again in a moment.");
      if (response.status === 402) throw new Error("AI credits exhausted for this workspace.");
      throw new Error(`AI request failed (${response.status}): ${body.slice(0, 300)}`);
    }

    const payload = (await response.json()) as {
      choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
    };
    const args = payload.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let drafts: DraftedDecision[] = [];
    if (args) {
      try {
        const parsed = JSON.parse(args) as { decisions?: DraftedDecision[] };
        drafts = Array.isArray(parsed.decisions) ? parsed.decisions.slice(0, 3) : [];
      } catch {
        drafts = [];
      }
    }

    const byTurnNo = new Map(turns.map((turn) => [turn.turn_no, turn.id]));
    const label = dateLabel(new Date());

    const rows = drafts
      .filter((d) => d && d.situation && d.call && d.why)
      .map((d) => ({
        owner_id: profile.id,
        engagement_id: engagementId,
        situation: String(d.situation).trim(),
        call_text: String(d.call).trim(),
        why: String(d.why).trim(),
        status: "draft" as const,
        author: "ai_draft" as const,
        date_label: label,
        srcs: (Array.isArray(d.source_turn_nos) ? d.source_turn_nos : [])
          .map((no) => byTurnNo.get(Number(no)))
          .filter((turnId): turnId is string => Boolean(turnId))
          .map((turnId) => ({ work_item_id: item.id, turn_id: turnId })),
      }));

    if (rows.length > 0) {
      const { error: insertError } = await supabase.from("decisions").insert(rows);
      if (insertError) throw new Error(insertError.message);
    }

    const { recordEvent } = await import("./telemetry.server");
    await recordEvent(supabase, {
      eventType: "decision.drafted",
      orgId: profile.org_id,
      userId: context.userId,
      dims: { count: rows.length },
    });

    return { drafted: rows.length };
  });

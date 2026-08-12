import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveProfile } from "@/lib/profile-resolve";
import {
  DRAFT_SYSTEM_PROMPT,
  DRAFT_TOOL,
  ENGAGEMENT_DRAFT_SYSTEM_PROMPT,
  ENGAGEMENT_DRAFT_TOOL,
  dateLabel,
  type DraftedDecision,
  type DraftedEngagementDecision,
} from "@/lib/decisions-shared";

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

    const { chatComplete, resolveAiMeta } = await import("./ai.server");
    const meta = await resolveAiMeta(supabase, {
      surface: "decision_draft_item",
      orgId: profile.org_id,
      userId: context.userId,
    });
    const completion = await chatComplete(
      [
        { role: "system", content: DRAFT_SYSTEM_PROMPT },
        { role: "user", content: transcript },
      ],
      {
        tier: "smart",
        maxTokens: 4000,
        tools: [DRAFT_TOOL],
        toolChoice: { type: "function", function: { name: "record_decisions" } },
        meta,
      },
    );

    const args = completion.toolArgs;
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

    const { usageDims } = await import("./ai-usage");
    const { recordEvent } = await import("./telemetry.server");
    await recordEvent(supabase, {
      eventType: "decision.drafted",
      orgId: profile.org_id,
      userId: context.userId,
      dims: { count: rows.length, ...usageDims(completion) },
    });

    return { drafted: rows.length };
  });

/**
 * Draft decisions across a whole engagement: every mapped item, threads and
 * documents alike, using the extracts as the map. Always drafts, never
 * confirms. A person decides.
 */
export const draftEngagementDecisions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { engagement_id: string; profile_id?: string | undefined }) => {
    if (!input || typeof input.engagement_id !== "string" || !input.engagement_id) {
      throw new Error("engagement_id is required");
    }
    return { engagement_id: input.engagement_id, profile_id: input.profile_id ?? null };
  })
  .handler(async ({ data, context }): Promise<{ drafted: number; scanned: number }> => {
    const { supabase, userId } = context;

    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });

    const { buildEngagementCorpus } = await import("./engagement-decisions.server");
    const corpus = await buildEngagementCorpus(supabase, data.engagement_id, profile.id);
    if (corpus.sources.length === 0) return { drafted: 0, scanned: 0 };

    const { chatComplete, resolveAiMeta } = await import("./ai.server");
    const meta = await resolveAiMeta(supabase, {
      surface: "decision_draft_engagement",
      orgId: profile.org_id,
      userId,
    });
    const completion = await chatComplete(
      [
        { role: "system", content: ENGAGEMENT_DRAFT_SYSTEM_PROMPT },
        { role: "user", content: corpus.prompt },
      ],
      {
        tier: "smart",
        maxTokens: 6000,
        tools: [ENGAGEMENT_DRAFT_TOOL],
        toolChoice: { type: "function", function: { name: "record_engagement_decisions" } },
        meta,
      },
    );

    const args = completion.toolArgs;
    let drafts: DraftedEngagementDecision[] = [];
    if (args) {
      try {
        const parsed = JSON.parse(args) as { decisions?: DraftedEngagementDecision[] };
        drafts = Array.isArray(parsed.decisions) ? parsed.decisions.slice(0, 5) : [];
      } catch {
        drafts = [];
      }
    }

    const idFor = new Map(corpus.sources.map((s) => [s.no, s.id]));
    const label = dateLabel(new Date());
    const rows = drafts
      .filter((d) => d && d.situation && d.call && d.why)
      .map((d) => ({
        owner_id: profile.id,
        engagement_id: data.engagement_id,
        situation: String(d.situation).trim(),
        call_text: String(d.call).trim(),
        why: String(d.why).trim(),
        status: "draft" as const,
        author: "ai_draft" as const,
        date_label: label,
        srcs: Array.from(
          new Set(
            (Array.isArray(d.source_item_nos) ? d.source_item_nos : [])
              .map((n) => idFor.get(Number(n)))
              .filter((id): id is string => Boolean(id)),
          ),
        ).map((id) => ({ work_item_id: id, turn_id: null })),
      }));

    if (rows.length > 0) {
      const { error: insertError } = await supabase.from("decisions").insert(rows);
      if (insertError) throw new Error(insertError.message);
    }

    const { usageDims } = await import("./ai-usage");
    const { recordEvent } = await import("./telemetry.server");
    await recordEvent(supabase, {
      eventType: "decision.drafted",
      orgId: profile.org_id,
      userId,
      dims: { count: rows.length, scope: "engagement", ...usageDims(completion) },
    });

    return { drafted: rows.length, scanned: corpus.sources.length };
  });

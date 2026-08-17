import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SUGGEST_SYSTEM_PROMPT, SUGGEST_TOOL, type MappingSuggestion } from "@/lib/mapping-shared";
import { validateProfileId } from "@/lib/connectors-shared";
import { resolveProfile } from "@/lib/profile-resolve";
import {
  clientDisplayName,
  engagementDisplayCode,
  engagementDisplayTitle,
} from "@/lib/clients";

export const suggestMappings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateProfileId)
  .handler(async ({ data, context }): Promise<{ suggestions: MappingSuggestion[] }> => {
    const { supabase, userId } = context;

    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });

    const { data: items, error: itemsError } = await supabase
      .from("work_items")
      .select("id, title, type, source, created_at_source, captured_at")
      .eq("owner_id", profile.id)
      .eq("visibility", "unmapped")
      .order("captured_at", { ascending: false })
      .limit(80);
    if (itemsError) throw new Error(itemsError.message);
    if (!items || items.length === 0) return { suggestions: [] };

    const { data: memberships, error: memberError } = await supabase
      .from("engagement_members")
      .select("engagements(id, code, title, client_label, clients(id, name, quick_folder))")
      .eq("profile_id", profile.id);
    if (memberError) throw new Error(memberError.message);

    const engagements = (
      (memberships ?? []) as unknown as {
        engagements: {
          id: string;
          code: string;
          title: string;
          client_label: string | null;
          clients: { id: string; name: string; quick_folder: boolean } | null;
        } | null;
      }[]
    )
      .map((row) => row.engagements)
      .filter((e): e is NonNullable<typeof e> => e !== null);
    if (engagements.length === 0) return { suggestions: [] };

    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select("id, name, engagement_id")
      .in(
        "engagement_id",
        engagements.map((e) => e.id),
      );
    if (tasksError) throw new Error(tasksError.message);
    if (!tasks || tasks.length === 0) return { suggestions: [] };

    const { data: org } = await supabase
      .from("orgs")
      .select("settings")
      .eq("id", profile.org_id)
      .maybeSingle();
    const conventions = (org?.settings as { naming_conventions?: string } | null)
      ?.naming_conventions;

    const payload = {
      naming_conventions: typeof conventions === "string" ? conventions : null,
      engagements: engagements.map((e) => ({
        id: e.id,
        code: engagementDisplayCode(e),
        title: engagementDisplayTitle(e),
        client: clientDisplayName(e),
      })),
      workstreams: tasks,
      work_items: items.map((item) => ({
        id: item.id,
        title: item.title,
        type: item.type,
        source: item.source,
        date: item.created_at_source ?? item.captured_at,
      })),
    };

    const { chatComplete, resolveAiMeta } = await import("./ai.server");
    const meta = await resolveAiMeta(supabase, {
      surface: "mapping_suggest",
      orgId: profile.org_id,
      userId,
    });
    const completion = await chatComplete(
      [
        { role: "system", content: SUGGEST_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(payload) },
      ],
      {
        tier: "fast",
        maxTokens: 3000,
        tools: [SUGGEST_TOOL],
        toolChoice: { type: "function", function: { name: "record_suggestions" } },
        meta,
      },
    );

    const args = completion.toolArgs;
    if (!args) return { suggestions: [] };

    let raw: MappingSuggestion[] = [];
    try {
      const parsed = JSON.parse(args) as { suggestions?: MappingSuggestion[] };
      raw = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
    } catch {
      raw = [];
    }

    const itemIds = new Set(items.map((i) => i.id));
    const taskIds = new Set(tasks.map((t) => t.id));
    const suggestions = raw
      .filter(
        (s) =>
          s &&
          itemIds.has(s.work_item_id) &&
          taskIds.has(s.task_id) &&
          (s.confidence === "high" || s.confidence === "medium"),
      )
      .map((s) => ({ ...s, reason: String(s.reason ?? "").slice(0, 60) }));

    return { suggestions };
  });

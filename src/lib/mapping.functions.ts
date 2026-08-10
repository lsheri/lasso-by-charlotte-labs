import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  SUGGEST_SYSTEM_PROMPT,
  SUGGEST_TOOL,
  type MappingSuggestion,
} from "@/lib/mapping-shared";

export const suggestMappings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ suggestions: MappingSuggestion[] }> => {
    const { supabase, userId } = context;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, org_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);
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
      .select("engagements(id, code, title, client_label)")
      .eq("profile_id", profile.id);
    if (memberError) throw new Error(memberError.message);

    const engagements = ((memberships ?? []) as unknown as {
      engagements: { id: string; code: string; title: string; client_label: string | null } | null;
    }[])
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
      engagements,
      tasks,
      work_items: items.map((item) => ({
        id: item.id,
        title: item.title,
        type: item.type,
        source: item.source,
        date: item.created_at_source ?? item.captured_at,
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
        max_tokens: 3000,
        messages: [
          { role: "system", content: SUGGEST_SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(payload) },
        ],
        tools: [SUGGEST_TOOL],
        tool_choice: { type: "function", function: { name: "record_suggestions" } },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      if (response.status === 429) throw new Error("Rate limited — try again in a moment.");
      if (response.status === 402) throw new Error("AI credits exhausted for this workspace.");
      throw new Error(`AI request failed (${response.status}): ${body.slice(0, 300)}`);
    }

    const result = (await response.json()) as {
      choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
    };
    const args = result.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
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

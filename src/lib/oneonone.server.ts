import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { engagementDisplayCode, engagementDisplayTitle } from "@/lib/clients";

type Db = SupabaseClient<Database>;

type ItemRow = {
  id: string;
  title: string;
  type: string;
  captured_at: string;
  work_date: string | null;
  created_at_source: string | null;
  visibility: string;
};

/** The record for a window, as a prompt. Extracts only, so this stays cheap. */
export async function buildOneOnOneCorpus(
  supabase: Db,
  ownerId: string,
  days: number,
  engagementId: string | null,
): Promise<{ prompt: string; itemCount: number }> {
  const cutoff = new Date(Date.now() - days * 86_400_000);
  const cutoffIso = cutoff.toISOString();

  const { data: itemData } = await supabase
    .from("work_items")
    .select("id, title, type, captured_at, work_date, created_at_source, visibility")
    .eq("owner_id", ownerId)
    .order("captured_at", { ascending: false })
    .limit(300);
  const inWindow = ((itemData ?? []) as ItemRow[]).filter((item) => {
    const iso = item.work_date ?? item.created_at_source ?? item.captured_at;
    return new Date(iso) >= cutoff;
  });

  const { data: linkData } = inWindow.length
    ? await supabase
        .from("work_item_tasks")
        .select(
          "work_item_id, step_no, tasks(id, name, engagement_id, engagements(code, title, client_label, clients(id, name, quick_folder)))",
        )
        .in(
          "work_item_id",
          inWindow.map((i) => i.id),
        )
    : { data: [] };
  const links = (linkData ?? []) as unknown as {
    work_item_id: string;
    step_no: number | null;
    tasks: {
      id: string;
      name: string;
      engagement_id: string;
      engagements: {
        code: string;
        title: string;
        client_label: string | null;
        clients: { id: string; name: string; quick_folder: boolean } | null;
      } | null;
    } | null;
  }[];

  const taskOf = new Map(links.map((l) => [l.work_item_id, l.tasks]));
  const items = engagementId
    ? inWindow.filter((i) => taskOf.get(i.id)?.engagement_id === engagementId)
    : inWindow;

  const { data: extractData } = items.length
    ? await supabase
        .from("work_item_extracts")
        .select("work_item_id, summary, decisions, handoff")
        .in(
          "work_item_id",
          items.map((i) => i.id),
        )
    : { data: [] };
  const extractFor = new Map(
    (
      (extractData ?? []) as {
        work_item_id: string;
        summary: string;
        decisions: string | null;
        handoff: string | null;
      }[]
    ).map((e) => [e.work_item_id, e]),
  );

  let decisionQuery = supabase
    .from("decisions")
    .select("situation, call_text, why, status, engagement_id, created_at")
    .eq("owner_id", ownerId)
    .in("status", ["draft", "confirmed"])
    .gte("created_at", cutoffIso);
  if (engagementId) decisionQuery = decisionQuery.eq("engagement_id", engagementId);
  const { data: decisionData } = await decisionQuery;
  const decisions = (decisionData ?? []) as {
    situation: string;
    call_text: string;
    why: string;
    status: string;
  }[];

  // Group by workstream so the brief can be grouped by workstream.
  const groups = new Map<string, string[]>();
  for (const item of items) {
    const task = taskOf.get(item.id);
    const key = task
      ? `${task.engagements ? `${engagementDisplayCode(task.engagements) ?? engagementDisplayTitle(task.engagements)} · ` : ""}${task.name}`
      : "Not mapped to a workstream";
    const extract = extractFor.get(item.id);
    const line = [
      `  - ${item.title} (${item.type}, ${(item.work_date ?? item.created_at_source ?? item.captured_at).slice(0, 10)})${item.visibility === "private" ? " [private]" : ""}`,
      extract ? `    Summary: ${extract.summary}` : null,
      extract?.decisions ? `    Decided: ${extract.decisions}` : null,
      extract?.handoff ? `    Led to: ${extract.handoff}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    groups.set(key, [...(groups.get(key) ?? []), line]);
  }

  const confirmed = decisions.filter((d) => d.status === "confirmed");
  const open = decisions.filter((d) => d.status === "draft");

  const prompt = [
    `TIME WINDOW: the last ${days} days.`,
    "",
    "WORK IN THE WINDOW, GROUPED BY WORKSTREAM:",
    ...(groups.size === 0
      ? ["  (nothing recorded in this window)"]
      : Array.from(groups.entries()).map(([task, lines]) => `WORKSTREAM: ${task}\n${lines.join("\n")}`)),
    "",
    "CONFIRMED DECISIONS IN THE WINDOW:",
    ...(confirmed.length === 0
      ? ["  (none)"]
      : confirmed.map(
          (d) => `  - Call: ${d.call_text}\n    Situation: ${d.situation}\n    Why: ${d.why}`,
        )),
    "",
    "STILL UNRESOLVED (drafted, not yet confirmed):",
    ...(open.length === 0 ? ["  (none)"] : open.map((d) => `  - ${d.call_text} (${d.situation})`)),
  ].join("\n");

  return { prompt, itemCount: items.length };
}

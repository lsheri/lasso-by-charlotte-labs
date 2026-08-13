import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import type { MappingSuggestion } from "@/lib/mapping-shared";
import { suggestMappings } from "@/lib/mapping.functions";
import { logEvent } from "@/lib/telemetry";
import { captureChannelOf, logV2 } from "@/lib/telemetry-v2";

export function useMappingSuggestions() {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const runSuggest = useServerFn(suggestMappings);
  const [suggestions, setSuggestions] = useState<MappingSuggestion[] | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [acceptPending, setAcceptPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = (suggestions ?? []).filter((s) => !dismissed.includes(s.work_item_id));

  const { data: taskLabels } = useQuery({
    queryKey: [
      "suggestion-task-labels",
      active
        .map((s) => s.task_id)
        .sort()
        .join(","),
    ],
    enabled: active.length > 0,
    queryFn: async (): Promise<Record<string, string>> => {
      const ids = Array.from(new Set(active.map((s) => s.task_id)));
      const { data: rows, error: taskError } = await supabase
        .from("tasks")
        .select("id, name, engagements(code)")
        .in("id", ids);
      if (taskError) throw taskError;
      const out: Record<string, string> = {};
      for (const row of (rows ?? []) as unknown as {
        id: string;
        name: string;
        engagements: { code: string } | null;
      }[]) {
        out[row.id] = `${row.engagements?.code ?? "Not set"} · ${row.name}`;
      }
      return out;
    },
  });

  async function suggest() {
    setSuggesting(true);
    setError(null);
    try {
      const result = await runSuggest({});
      setSuggestions(result.suggestions);
      setDismissed([]);
      toast.success(
        result.suggestions.length > 0
          ? `${result.suggestions.length} suggestion${result.suggestions.length === 1 ? "" : "s"}`
          : "No confident matches yet",
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSuggesting(false);
    }
  }

  async function accept(suggestion: MappingSuggestion, meta?: { type: string; source: string }) {
    if (!profile) return;
    setAcceptPending(true);
    setError(null);
    try {
      const cleanup = await supabase
        .from("work_item_tasks")
        .delete()
        .eq("work_item_id", suggestion.work_item_id);
      if (cleanup.error) throw new Error(cleanup.error.message);
      const link = await supabase
        .from("work_item_tasks")
        .insert({ work_item_id: suggestion.work_item_id, task_id: suggestion.task_id });
      if (link.error) throw new Error(link.error.message);
      const upd = await supabase
        .from("work_items")
        .update({ visibility: "mapped" })
        .eq("id", suggestion.work_item_id);
      if (upd.error) throw new Error(upd.error.message);

      logEvent("workitem.mapped", profile.org_id, {
        type: meta?.type ?? "ai_thread",
        source: meta?.source ?? "import",
        suggested: true,
      });
      logV2(
        "work_item.mapped",
        {
          item_type: (meta?.type ?? "ai_thread") as never,
          channel: captureChannelOf(meta?.source ?? "import"),
          bulk: 1,
        },
        { profileId: profile.id, workItemId: suggestion.work_item_id },
      );
      setDismissed((prev) => [...prev, suggestion.work_item_id]);
      await queryClient.invalidateQueries({ queryKey: ["work-items"] });
      await queryClient.invalidateQueries({ queryKey: ["engagement"] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAcceptPending(false);
    }
  }

  function dismiss(workItemId: string) {
    setDismissed((prev) => [...prev, workItemId]);
  }

  return {
    suggestions,
    active,
    taskLabels,
    suggesting,
    acceptPending,
    error,
    suggest,
    accept,
    dismiss,
    reset: () => {
      setSuggestions(null);
      setDismissed([]);
    },
  };
}

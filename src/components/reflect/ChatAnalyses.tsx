import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { SuggestDot, Suggested } from "@/components/common/Suggested";
import { MarkdownMessage } from "@/components/markdown/MarkdownMessage";
import { AnalysisInfoPanel } from "@/components/reflect/AnalysisInfoPanel";
import { supabase } from "@/integrations/supabase/client";
import {
  MIN_ITEMS_FOR_RECURRENCE,
  NOT_ENOUGH_WORK_LINE,
  presetsForScope,
  type AnalysisPreset,
} from "@/lib/analysis-presets";
import { startAnalysis } from "@/lib/analysis.functions";
import { logEvent } from "@/lib/telemetry";

/** What the chips point at, worked out from the chat's current scope. */
export type ChipTarget =
  | { kind: "item"; id: string; title: string; scope: "thread" | "deliverable" }
  | { kind: "engagement"; id: string; title: string; itemCount: number }
  | { kind: "none" };

export type InlineAnalysis = {
  key: string;
  preset: AnalysisPreset;
  text: string;
  suppressed: number;
  readsDetail: string;
};

/**
 * The analysis chips, in the chat itself. Same registry, same info panels, same
 * server path as the slide-over lens. The result lands inline in the running
 * conversation rather than opening a second surface.
 */
export function useChatAnalyses(profileId: string | undefined, orgId: string | undefined) {
  const queryClient = useQueryClient();
  const run = useServerFn(startAnalysis);
  const [results, setResults] = useState<InlineAnalysis[]>([]);
  const [running, setRunning] = useState<AnalysisPreset | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runPreset(preset: AnalysisPreset, target: ChipTarget, readsDetail: string) {
    if (running || target.kind === "none" || !profileId) return;
    setRunning(preset);
    setError(null);
    try {
      const result = await run({
        data: {
          preset_id: preset.id,
          ...(target.kind === "engagement"
            ? { engagement_id: target.id }
            : { work_item_id: target.id }),
          profile_id: profileId,
        },
      });
      const { data } = await supabase
        .from("chat_messages")
        .select("id, role, content")
        .eq("session_id", result.session_id)
        .order("created_at", { ascending: true });
      const answer = (data ?? []).filter((m) => m.role === "assistant").pop();
      setResults((prev) => [
        ...prev,
        {
          key: `${preset.id}:${result.session_id}:${prev.length}`,
          preset,
          text: answer?.content ?? "Nothing came back for that. Try again.",
          suppressed: result.suppressed,
          readsDetail,
        },
      ]);
      if (orgId) logEvent("reflect.session_created", orgId, { preset: preset.id });
      await queryClient.invalidateQueries({ queryKey: ["reflect-sessions"] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(null);
    }
  }

  function clear() {
    setResults([]);
    setError(null);
  }

  return { results, running, error, runPreset, clear };
}

export function InlineAnalysisBlocks({ results }: { results: InlineAnalysis[] }) {
  return (
    <>
      {results.map((result) => (
        <div key={result.key}>
          <p className="micro-label">Lasso · {result.preset.label}</p>
          <MarkdownMessage content={result.text} />
          {result.suppressed > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {result.suppressed === 1
                ? "One finding was left out because its exact wording could not be confirmed."
                : `${result.suppressed} findings were left out because their exact wording could not be confirmed.`}
            </p>
          ) : null}
          <div className="mt-3 border-t border-border pt-3">
            <AnalysisInfoPanel preset={result.preset} readsDetail={result.readsDetail} />
            {result.preset.attribution ? (
              <p className="mt-2 text-xs text-muted-foreground">{result.preset.attribution}</p>
            ) : null}
          </div>
        </div>
      ))}
    </>
  );
}

export function AnalysisChips({
  target,
  readsDetail,
  running,
  onRun,
  isCoach = false,
  className = "",
}: {
  target: ChipTarget;
  readsDetail: string;
  running: AnalysisPreset | null;
  onRun: (preset: AnalysisPreset) => void;
  isCoach?: boolean;
  className?: string;
}) {
  if (target.kind === "none") return null;
  const scope = target.kind === "engagement" ? "engagement" : target.scope;
  const presets = presetsForScope(scope, isCoach);
  if (presets.length === 0) return null;
  const notEnoughWork = target.kind === "engagement" && target.itemCount < MIN_ITEMS_FOR_RECURRENCE;

  return (
    <Suggested className={className}>
      <div className="flex items-center gap-2">
        <SuggestDot />
        <p className="text-xs text-ember-deep">Analyses Lasso can run on this work</p>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {presets.map((preset) => {
          const blocked = preset.id === "what_recurs" && notEnoughWork;
          return (
            <div key={preset.id} className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={Boolean(running) || blocked}
                title={blocked ? NOT_ENOUGH_WORK_LINE : undefined}
                onClick={() => onRun(preset)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-opacity hover:opacity-85 disabled:opacity-50 ${
                  running?.id === preset.id
                    ? "bg-ember text-ember-foreground"
                    : "border border-border bg-card text-foreground"
                }`}
              >
                {preset.label}
              </button>
              <AnalysisInfoPanel preset={preset} readsDetail={readsDetail} />
            </div>
          );
        })}
      </div>
      {notEnoughWork ? (
        <p className="mt-2 text-xs text-muted-foreground">{NOT_ENOUGH_WORK_LINE}</p>
      ) : null}
    </Suggested>
  );
}

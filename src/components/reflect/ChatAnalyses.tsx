import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { SuggestDot, Suggested } from "@/components/common/Suggested";
import { MarkdownMessage } from "@/components/markdown/MarkdownMessage";
import { AnalysisInfoPanel } from "@/components/reflect/AnalysisInfoPanel";
import { FindingLabel } from "@/components/reflect/FindingLabel";
import { supabase } from "@/integrations/supabase/client";
import { isBriefItem } from "@/lib/brief-shared";
import {
  MIN_ITEMS_FOR_RECURRENCE,
  NOT_ENOUGH_WORK_LINE,
  ANALYSIS_PRESETS,
  presetsForScope,
  type AnalysisPreset,
} from "@/lib/analysis-presets";
import { startAnalysis } from "@/lib/analysis.functions";
import { logEvent } from "@/lib/telemetry";
import { isDeliverableType } from "@/lib/lineage-shared";
import type { WorkItemRow } from "@/lib/work-types";

/** What the chips point at, worked out from the chat's current scope. */
export type ChipTarget =
  | { kind: "item"; id: string; title: string; scope: "thread" | "deliverable" }
  | { kind: "engagement"; id: string; title: string; itemCount: number }
  | { kind: "none"; reason: "multiple" | "empty" };

/** The engagements a person can narrow to, in the order the record holds them. */
export type ChipEngagement = { id: string; code: string; title: string };

const MAX_ENGAGEMENT_CHIPS = 5;

export type InlineAnalysis = {
  key: string;
  preset: AnalysisPreset;
  text: string;
  suppressed: number;
  claims: number;
  readsDetail: string;
  runId: string;
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
          claims: result.claims,
          readsDetail,
          runId: result.run_id,
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

export function InlineAnalysisBlocks({
  results,
  profileId,
}: {
  results: InlineAnalysis[];
  profileId?: string | undefined;
}) {
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
            <FindingLabel
              preset={result.preset.id}
              claims={result.claims}
              profileId={profileId}
              runId={result.runId}
            />
          </div>
        </div>
      ))}
    </>
  );
}

/**
 * INVARIANT: no scope state may render nothing. An empty return teaches the
 * user the feature does not exist. Every branch here renders the same
 * Suggested container with the same label, and either the analyses that can
 * run or the one action that makes them runnable.
 */
export function AnalysisChips({
  target,
  readsDetail,
  running,
  onRun,
  isCoach = false,
  className = "",
  engagementOptions = [],
  onPickEngagement,
  onOpenPicker,
}: {
  target: ChipTarget;
  readsDetail: string;
  running: AnalysisPreset | null;
  onRun: (preset: AnalysisPreset) => void;
  isCoach?: boolean;
  className?: string;
  engagementOptions?: ChipEngagement[];
  onPickEngagement?: (engagementId: string) => void;
  onOpenPicker?: () => void;
}) {
  if (target.kind === "none") {
    return (
      <Suggested className={className}>
        <div className="flex items-center gap-2">
          <SuggestDot />
          <p className="text-xs text-ember-deep">Analyses Lasso can run on this work</p>
        </div>
        {target.reason === "empty" || engagementOptions.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Map work to an engagement and analyses will appear here.{" "}
            <Link to="/work" className="text-accent-deep underline underline-offset-2">
              Go to Work
            </Link>
          </p>
        ) : (
          <>
            <p className="mt-2 text-xs text-muted-foreground">
              Pick one engagement or one piece of work to run an analysis.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {engagementOptions.slice(0, MAX_ENGAGEMENT_CHIPS).map((engagement) => (
                <button
                  key={engagement.id}
                  type="button"
                  onClick={() => onPickEngagement?.(engagement.id)}
                  className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground transition-opacity hover:opacity-85"
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                    {engagement.code}
                  </span>{" "}
                  {engagement.title}
                </button>
              ))}
              {engagementOptions.length > MAX_ENGAGEMENT_CHIPS || onOpenPicker ? (
                <button
                  type="button"
                  onClick={() => onOpenPicker?.()}
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  More…
                </button>
              ) : null}
            </div>
          </>
        )}
      </Suggested>
    );
  }
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

/**
 * Which analyses the CURRENT selection can support, and why not when it cannot.
 * An ineligible analysis stays visible with a plain reason, because a hidden
 * chip teaches the person the analysis does not exist.
 */
export type SelectionChip = {
  preset: AnalysisPreset;
  target: ChipTarget | null;
  reason: string | null;
};

export function selectionChips(
  selected: WorkItemRow[],
  engagement: { id: string; title: string },
  briefCandidates: WorkItemRow[] = [],
): SelectionChip[] {
  const deliverables = selected.filter((i) => isDeliverableType(i.type));
  const conversations = selected.filter((i) => i.type === "ai_thread");
  const deliverable = deliverables[0] ?? null;
  const conversation = conversations[0] ?? null;
  const hasBrief =
    selected.some((i) => isBriefItem(i)) || briefCandidates.some((i) => isBriefItem(i));

  return ANALYSIS_PRESETS.map((preset) => {
    if (preset.scope === "deliverable") {
      if (!deliverable) {
        return { preset, target: null, reason: "needs a finished deliverable in the selection" };
      }
      if (preset.id === "still_on_brief" && !hasBrief) {
        return { preset, target: null, reason: "needs a brief linked to this engagement" };
      }
      return {
        preset,
        target: {
          kind: "item",
          id: deliverable.id,
          title: deliverable.title,
          scope: "deliverable",
        } as ChipTarget,
        reason: null,
      };
    }
    if (preset.scope === "thread") {
      if (conversations.length !== 1 || !conversation) {
        return { preset, target: null, reason: "runs on one conversation, select just one" };
      }
      return {
        preset,
        target: {
          kind: "item",
          id: conversation.id,
          title: conversation.title,
          scope: "thread",
        } as ChipTarget,
        reason: null,
      };
    }
    if (selected.length < MIN_ITEMS_FOR_RECURRENCE) {
      return { preset, target: null, reason: "needs at least three pieces of work selected" };
    }
    return {
      preset,
      target: {
        kind: "engagement",
        id: engagement.id,
        title: engagement.title,
        itemCount: selected.length,
      } as ChipTarget,
      reason: null,
    };
  });
}

/**
 * The chips row for a chat whose context is a hand picked selection. Same
 * registry, same info panels, same server path as everywhere else.
 */
export function SelectionAnalysisChips({
  selected,
  engagement,
  readsDetail,
  running,
  onRun,
  className = "",
}: {
  selected: WorkItemRow[];
  engagement: { id: string; title: string };
  readsDetail: string;
  running: AnalysisPreset | null;
  onRun: (preset: AnalysisPreset, target: ChipTarget) => void;
  className?: string;
}) {
  const chips = selectionChips(selected, engagement);
  return (
    <Suggested className={className}>
      <div className="flex items-center gap-2">
        <SuggestDot />
        <p className="text-xs text-ember-deep">Analyses Lasso can run on this work</p>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {chips.map(({ preset, target, reason }) => (
          <div key={preset.id} className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={Boolean(running) || target === null}
              title={reason ?? undefined}
              onClick={() => target && onRun(preset, target)}
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
        ))}
      </div>
      {chips.some((c) => c.reason) ? (
        <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
          {chips
            .filter((c) => c.reason)
            .map((c) => (
              <li key={c.preset.id}>
                {c.preset.label}: {c.reason}
              </li>
            ))}
        </ul>
      ) : null}
    </Suggested>
  );
}

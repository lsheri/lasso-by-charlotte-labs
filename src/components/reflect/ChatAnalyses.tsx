import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { SuggestDot, Suggested } from "@/components/common/Suggested";
import { MarkdownMessage } from "@/components/markdown/MarkdownMessage";
import { AnalysisInfoPanel } from "@/components/reflect/AnalysisInfoPanel";
import { AnalysisConfirm, type AnalysisConfirmRequest } from "@/components/reflect/AnalysisConfirm";
import { FindingLabel } from "@/components/reflect/FindingLabel";
import { HandoffDrafts } from "@/components/reflect/HandoffDrafts";
import { supabase } from "@/integrations/supabase/client";
import { isBriefItem } from "@/lib/brief-shared";
import {
  MIN_ITEMS_FOR_RECURRENCE,
  NOT_ENOUGH_WORK_LINE,
  NO_FIRM_CHECKS_LINE,
  ANALYSIS_PRESETS,
  presetsForScope,
  type AnalysisPreset,
} from "@/lib/analysis-presets";
import type { AnalysisRunResult } from "@/lib/analysis.functions";
import { parseManifest, type ContextManifest } from "@/lib/context-manifest";
import { ContextAudit } from "@/components/reflect/ContextTrail";
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

/**
 * Reading order for the stock analyses: what the work claims first, how it
 * came to be second, how the person worked last.
 */
const STOCK_ORDER: readonly string[] = [
  "verification",
  "still_on_brief",
  "decision_origin",
  "what_fed_this",
  "what_recurs",
  "ai_fluency_4d",
  "working_the_model",
];

function byStockOrder(a: AnalysisPreset, b: AnalysisPreset): number {
  const ai = STOCK_ORDER.indexOf(a.id);
  const bi = STOCK_ORDER.indexOf(b.id);
  return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
}

/** One stock analysis: a quiet pill and the icon that explains it. */
function StockPill({
  preset,
  readsDetail,
  running,
  disabled,
  reason,
  onClick,
}: {
  preset: AnalysisPreset;
  readsDetail: string;
  running: AnalysisPreset | null;
  disabled: boolean;
  reason: string | null;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={Boolean(running) || disabled}
        title={reason ?? undefined}
        onClick={onClick}
        className={`rounded-full px-2.5 py-1 text-xs transition-opacity hover:opacity-85 disabled:opacity-50 ${
          running?.id === preset.id
            ? "bg-ember text-ember-foreground"
            : "border border-border bg-card text-foreground"
        }`}
      >
        {preset.label}
      </button>
      <AnalysisInfoPanel preset={preset} readsDetail={readsDetail} iconOnly />
    </div>
  );
}

/** The reasons a chip cannot run, one quiet line each, only when there are any. */
function DisabledReasons({ rows }: { rows: { label: string; reason: string }[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-2 space-y-0.5">
      {rows.map((row) => (
        <p key={row.label} className="text-[11px] text-muted-foreground">
          {row.label}: {row.reason}
        </p>
      ))}
    </div>
  );
}

/**
 * The firm's own checks, given their own section above Lasso's analyses. This
 * is the part a manager should read as "my knowledge, running on this work".
 */
function FirmSection({
  orgName,
  firmCheckCount,
  canAuthorChecks = false,
  onAuthorCheck,
  preset,
  readsDetail,
  running,
  disabled,
  reason,
  onRun,
}: {
  orgName?: string | undefined;
  firmCheckCount: number;
  canAuthorChecks?: boolean;
  onAuthorCheck?: (() => void) | undefined;
  preset: AnalysisPreset | null;
  readsDetail: string;
  running: AnalysisPreset | null;
  disabled: boolean;
  reason: string | null;
  onRun: () => void;
}) {
  const label = `${orgName ? `${orgName} ` : ""}Firm checks`;
  const hasChecks = firmCheckCount > 0;
  return (
    <div>
      <p className="micro-label mb-2">{label}</p>
      {hasChecks ? (
        <>
          {preset ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={Boolean(running) || disabled}
                title={reason ?? undefined}
                onClick={onRun}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-opacity hover:opacity-85 disabled:opacity-50 ${
                  running?.id === preset.id
                    ? "bg-ember text-ember-foreground"
                    : "bg-accent-soft text-accent-deep"
                }`}
              >
                Run firm checks
              </button>
              <AnalysisInfoPanel preset={preset} readsDetail={readsDetail} iconOnly />
            </div>
          ) : null}
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {firmCheckCount === 1
              ? "1 check applies to this work."
              : `${firmCheckCount} checks apply to this work.`}
            {canAuthorChecks && onAuthorCheck ? (
              <>
                {" "}
                <button
                  type="button"
                  onClick={onAuthorCheck}
                  className="text-accent-deep underline underline-offset-2"
                >
                  Add a check
                </button>
              </>
            ) : null}
          </p>
        </>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Checks your firm writes appear here and run against your work.
          {canAuthorChecks && onAuthorCheck ? (
            <>
              {" "}
              <button
                type="button"
                onClick={onAuthorCheck}
                className="text-accent-deep underline underline-offset-2"
              >
                Write the first check
              </button>
            </>
          ) : null}
        </p>
      )}
    </div>
  );
}

export type InlineAnalysis = {
  key: string;
  preset: AnalysisPreset;
  text: string;
  suppressed: number;
  claims: number;
  readsDetail: string;
  runId: string;
  /** True when this is a prior run's result, shown again rather than rerun. */
  reused: boolean;
  sessionId: string;
  /** Exactly what the run read, from the server. Null when none was recorded. */
  manifest: ContextManifest | null;
};

/**
 * The analysis chips, in the chat itself. Same registry, same info panels, same
 * server path as the slide-over lens. The result lands inline in the running
 * conversation rather than opening a second surface.
 */
export function useChatAnalyses(profileId: string | undefined, orgId: string | undefined) {
  const queryClient = useQueryClient();
  const [results, setResults] = useState<InlineAnalysis[]>([]);
  const [running, setRunning] = useState<AnalysisPreset | null>(null);
  const [streamed, setStreamed] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function runPreset(preset: AnalysisPreset, target: ChipTarget, readsDetail: string) {
    if (running || target.kind === "none" || !profileId) return;
    setRunning(preset);
    setStreamed("");
    setError(null);
    try {
      const { streamChatRequest } = await import("@/lib/stream-client");
      const result = await streamChatRequest<AnalysisRunResult>(
        "/api/analysis/stream",
        {
          preset_id: preset.id,
          confirm_step: "shown" as const,
          ...(target.kind === "engagement"
            ? { engagement_id: target.id }
            : { work_item_id: target.id }),
          profile_id: profileId,
        },
        (delta) => setStreamed((prev) => prev + delta),
      );
      const { data } = await supabase
        .from("chat_messages")
        .select("id, role, content, context_manifest")
        .eq("session_id", result.session_id)
        .order("created_at", { ascending: true });
      const answer = (data ?? []).filter((m) => m.role === "assistant").pop();
      // The guarded text always wins over whatever streamed past the reader.
      const finalText =
        result.answer ?? answer?.content ?? "Nothing came back for that. Try again.";
      setResults((prev) => [
        ...prev,
        {
          key: `${preset.id}:${result.session_id}:${prev.length}`,
          preset,
          text: finalText,
          suppressed: result.suppressed,
          claims: result.claims,
          readsDetail,
          runId: result.run_id,
          reused: result.reused,
          sessionId: result.session_id,
          manifest: result.manifest ?? parseManifest(answer?.context_manifest),
        },
      ]);
      if (orgId) logEvent("reflect.session_created", orgId, { preset: preset.id });
      await queryClient.invalidateQueries({ queryKey: ["reflect-sessions"] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(null);
      setStreamed("");
    }
  }

  function clear() {
    setResults([]);
    setError(null);
  }

  return { results, running, streamed, error, runPreset, clear };
}

export function InlineAnalysisBlocks({
  results,
  profileId,
  onSaveForOneOnOne,
}: {
  results: InlineAnalysis[];
  profileId?: string | undefined;
  onSaveForOneOnOne?:
    ((input: { text: string; kind: "analysis_finding"; sessionId: string }) => void) | undefined;
}) {
  return (
    <>
      {results.map((result, index) => (
        <div key={result.key}>
          <p className="micro-label">Lasso · {result.preset.label}</p>
          {result.reused ? (
            <p className="mt-1 text-xs text-muted-foreground">
              This analysis already ran on this exact work. Showing that result.
            </p>
          ) : null}
          <MarkdownMessage content={result.text} />
          <ContextAudit manifest={result.manifest} />
          {onSaveForOneOnOne ? (
            <button
              type="button"
              onClick={() =>
                onSaveForOneOnOne({
                  text: result.text,
                  kind: "analysis_finding",
                  sessionId: result.sessionId,
                })
              }
              className="mt-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
            >
              Save for 1:1
            </button>
          ) : null}
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
            <HandoffDrafts
              runId={result.runId}
              profileId={profileId}
              superseded={results.some(
                (other, otherIndex) =>
                  otherIndex > index && other.preset.id === result.preset.id,
              )}
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
  firmCheckCount = 0,
  onPickEngagement,
  onOpenPicker,
  orgName,
  canAuthorChecks = false,
  onAuthorCheck,
  orgId,
  profileId,
}: {
  target: ChipTarget;
  readsDetail: string;
  running: AnalysisPreset | null;
  onRun: (preset: AnalysisPreset) => void;
  isCoach?: boolean;
  className?: string;
  engagementOptions?: ChipEngagement[];
  firmCheckCount?: number;
  onPickEngagement?: (engagementId: string) => void;
  onOpenPicker?: () => void;
  orgName?: string | undefined;
  canAuthorChecks?: boolean | undefined;
  onAuthorCheck?: (() => void) | undefined;
  orgId?: string | undefined;
  profileId?: string | undefined;
}) {
  const [confirming, setConfirming] = useState<AnalysisConfirmRequest | null>(null);
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
  const firmPreset = presets.find((p) => p.id === "firm_checks") ?? null;
  const stock = presets.filter((p) => p.id !== "firm_checks").sort(byStockOrder);
  const disabledRows = stock
    .filter((p) => p.id === "what_recurs" && notEnoughWork)
    .map((p) => ({ label: p.label, reason: NOT_ENOUGH_WORK_LINE }));

  return (
    <Suggested className={className}>
      <AnalysisConfirm
        request={confirming}
        orgId={orgId}
        profileId={profileId}
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          const preset = confirming?.preset;
          setConfirming(null);
          if (preset) onRun(preset);
        }}
      />
      <FirmSection
        orgName={orgName}
        firmCheckCount={firmCheckCount}
        canAuthorChecks={canAuthorChecks}
        onAuthorCheck={onAuthorCheck}
        preset={firmPreset}
        readsDetail={readsDetail}
        running={running}
        disabled={firmCheckCount === 0}
        reason={firmCheckCount === 0 ? NO_FIRM_CHECKS_LINE : null}
        onRun={() => firmPreset && setConfirming({ preset: firmPreset, target })}
      />
      <div className="mt-4">
        <p className="micro-label mb-2">Lasso analyses</p>
        <div className="flex flex-wrap gap-2">
          {stock.map((preset) => {
            const blocked = preset.id === "what_recurs" && notEnoughWork;
            return (
              <StockPill
                key={preset.id}
                preset={preset}
                readsDetail={readsDetail}
                running={running}
                disabled={blocked}
                reason={blocked ? NOT_ENOUGH_WORK_LINE : null}
                onClick={() => setConfirming({ preset, target })}
              />
            );
          })}
        </div>
        <DisabledReasons rows={disabledRows} />
      </div>
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
  engagementHasBrief = false,
  firmCheckCount = 0,
): SelectionChip[] {
  const deliverables = selected.filter((i) => isDeliverableType(i.type));
  const conversations = selected.filter((i) => i.type === "ai_thread");
  const deliverable = deliverables[0] ?? null;
  const conversation = conversations[0] ?? null;
  // A brief is either a marked work item or the brief written on the
  // engagement itself. Either one is enough for a drift analysis to run.
  const hasBrief =
    engagementHasBrief ||
    selected.some((i) => isBriefItem(i)) ||
    briefCandidates.some((i) => isBriefItem(i));

  return ANALYSIS_PRESETS.map((preset) => {
    if (preset.scope === "deliverable") {
      if (!deliverable) {
        return { preset, target: null, reason: "needs a finished deliverable in the selection" };
      }
      if (preset.id === "still_on_brief" && !hasBrief) {
        return { preset, target: null, reason: "needs a brief linked to this engagement" };
      }
      if (preset.id === "firm_checks" && firmCheckCount === 0) {
        return { preset, target: null, reason: NO_FIRM_CHECKS_LINE };
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
  briefCandidates = [],
  engagementHasBrief = false,
  firmCheckCount = 0,
  readsDetail,
  running,
  onRun,
  className = "",
  orgName,
  canAuthorChecks = false,
  onAuthorCheck,
  orgId,
  profileId,
  onAdjust,
}: {
  selected: WorkItemRow[];
  engagement: { id: string; title: string };
  briefCandidates?: WorkItemRow[];
  engagementHasBrief?: boolean;
  firmCheckCount?: number;
  readsDetail: string;
  running: AnalysisPreset | null;
  onRun: (preset: AnalysisPreset, target: ChipTarget) => void;
  className?: string;
  orgName?: string | undefined;
  canAuthorChecks?: boolean | undefined;
  onAuthorCheck?: (() => void) | undefined;
  orgId?: string | undefined;
  profileId?: string | undefined;
  onAdjust?: (() => void) | undefined;
}) {
  const [confirming, setConfirming] = useState<{
    request: AnalysisConfirmRequest;
    target: ChipTarget;
  } | null>(null);
  const chips = selectionChips(
    selected,
    engagement,
    briefCandidates,
    engagementHasBrief,
    firmCheckCount,
  );
  const firmChip = chips.find((c) => c.preset.id === "firm_checks") ?? null;
  const stock = chips
    .filter((c) => c.preset.id !== "firm_checks")
    .sort((a, b) => byStockOrder(a.preset, b.preset));
  const disabledRows = stock
    .filter((c) => c.reason)
    .map((c) => ({ label: c.preset.label, reason: c.reason as string }));
  return (
    <Suggested className={className}>
      <AnalysisConfirm
        request={confirming?.request ?? null}
        orgId={orgId}
        profileId={profileId}
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          const pending = confirming;
          setConfirming(null);
          if (pending) onRun(pending.request.preset, pending.target);
        }}
      />
      <FirmSection
        orgName={orgName}
        firmCheckCount={firmCheckCount}
        canAuthorChecks={canAuthorChecks}
        onAuthorCheck={onAuthorCheck}
        preset={firmChip?.preset ?? null}
        readsDetail={readsDetail}
        running={running}
        disabled={!firmChip?.target}
        reason={firmChip?.reason ?? null}
        onRun={() => {
          if (firmChip?.target && firmChip.target.kind !== "none") {
            setConfirming({
              request: { preset: firmChip.preset, target: firmChip.target, onAdjust },
              target: firmChip.target,
            });
          }
        }}
      />
      <div className="mt-4">
        <p className="micro-label mb-2">Lasso analyses</p>
        <div className="flex flex-wrap gap-2">
          {stock.map(({ preset, target, reason }) => (
            <StockPill
              key={preset.id}
              preset={preset}
              readsDetail={readsDetail}
              running={running}
              disabled={target === null}
              reason={reason}
              onClick={() =>
                target && target.kind !== "none"
                  ? setConfirming({ request: { preset, target, onAdjust }, target })
                  : undefined
              }
            />
          ))}
        </div>
        <DisabledReasons rows={disabledRows} />
      </div>
    </Suggested>
  );
}

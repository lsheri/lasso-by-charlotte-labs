import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";

import { WorkingLabel } from "@/components/common/Working";
import { Suggested, SuggestDot } from "@/components/common/Suggested";
import { MarkdownMessage } from "@/components/markdown/MarkdownMessage";
import { SlideOver } from "@/components/peek/SlideOver";
import { AnalysisInfoPanel } from "@/components/reflect/AnalysisInfoPanel";
import { AnalysisConfirm, type AnalysisConfirmRequest } from "@/components/reflect/AnalysisConfirm";
import { FirmCheckBubbles } from "@/components/reflect/FirmCheckBubbles";

import { ContextAudit, ThinkingTrail } from "@/components/reflect/ContextTrail";
import { FindingLabel } from "@/components/reflect/FindingLabel";
import { HandoffDrafts } from "@/components/reflect/HandoffDrafts";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  minItemsFor,
  notEnoughWorkLine,
  NO_FIRM_CHECKS_LINE,
  presetsForScope,
  type AnalysisPreset,
  type AnalysisPresetId,
} from "@/lib/analysis-presets";

import { useFirmChecks } from "@/hooks/use-firm-checks";
import type { AnalysisRunResult } from "@/lib/analysis.functions";
import { streamChatRequest } from "@/lib/stream-client";
import { sendReflectMessage } from "@/lib/reflect.functions";
import { logEvent } from "@/lib/telemetry";
import { parseManifest, type ContextManifest } from "@/lib/context-manifest";

type MessageRow = { id: number; role: string; content: string; context_manifest: unknown };

/**
 * What an analysis is pointed at. A thread and a deliverable are both work
 * items; an engagement is the longitudinal scope and names no single item.
 */
export type AnalysisTargetProp =
  | { kind: "item"; id: string; title: string; scope: "thread" | "deliverable" }
  | { kind: "engagement"; id: string; title: string; itemCount: number };

/**
 * Analyses over one conversation. The buttons are the product: each one opens
 * a new scoped Ask Lasso session and runs its preset. Owner only, never scored.
 */
export function AnalysisLens({
  open,
  onOpenChange,
  target,
  profileId,
  orgId,
  initialPreset,
  isCoach = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: AnalysisTargetProp;
  profileId: string;
  orgId: string;
  initialPreset?: AnalysisPresetId;
  /** A coach sees only the analyses a coach may run, and never Reflect. */
  isCoach?: boolean;
}) {

  const queryClient = useQueryClient();
  const send = useServerFn(sendReflectMessage);
  const scope = target.kind === "engagement" ? "engagement" : target.scope;
  const presets = presetsForScope(scope, isCoach);
  const [active, setActive] = useState<AnalysisPreset | null>(
    presets.find((p) => p.id === initialPreset) ?? null,
  );
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [suppressed, setSuppressed] = useState(0);
  const [claims, setClaims] = useState(0);
  const [runId, setRunId] = useState<string | undefined>(undefined);
  const [reused, setReused] = useState(false);
  const [liveManifest, setLiveManifest] = useState<ContextManifest | null>(null);
  const [draft, setDraft] = useState("");
  const [streamed, setStreamed] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<AnalysisConfirmRequest | null>(null);
  const started = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // Firm checks apply org wide, per engagement, or per person. The server
  // filters exactly; here we only decide whether the chip can be pressed.
  const { data: firmChecks } = useFirmChecks({ orgId, subjectProfileId: profileId });
  const firmCheckCount = (firmChecks ?? []).length;
  const firmPreset = presets.find((preset) => preset.id === "firm_checks") ?? null;


  const { data: turnCount } = useQuery({
    queryKey: ["thread-turn-count", target.id],
    enabled: target.kind === "item",
    queryFn: async (): Promise<number> => {
      const { count } = await supabase
        .from("turns")
        .select("id", { count: "exact", head: true })
        .eq("work_item_id", target.id);
      return count ?? 0;
    },
  });

  const { data: messages } = useQuery({
    queryKey: ["reflect-messages", sessionId],
    enabled: Boolean(sessionId),
    queryFn: async (): Promise<MessageRow[]> => {
      const { data, error: e } = await supabase
        .from("chat_messages")
        .select("id, role, content, context_manifest")
        .eq("session_id", sessionId as string)
        .order("created_at", { ascending: true });
      if (e) throw e;
      return (data ?? []) as MessageRow[];
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length, pending]);

  async function runPreset(
    preset: AnalysisPreset,
    checkId?: string,
    extraItemIds?: string[],
    anchorItemId?: string | null,
  ) {
    if (pending) return;
    // Same handover as the chat surface: the lineage question opens the audit.
    if (preset.id === "what_fed_this" && target.kind === "item") {
      const { markOpenStart } = await import("@/lib/perf-timing");
      markOpenStart("audit.open");
      const { openProvenanceAudit } = await import("@/components/provenance/audit-state");
      openProvenanceAudit({ anchorId: anchorItemId ?? target.id, anchorTitle: target.title });
      return;
    }
    started.current = preset.id;
    setActive(preset);
    setSessionId(null);
    setSuppressed(0);
    setClaims(0);
    setRunId(undefined);
    setReused(false);
    setLiveManifest(null);
    setStreamed("");
    setPending(true);
    setError(null);
    try {
      const result = await streamChatRequest<AnalysisRunResult>(
        "/api/analysis/stream",
        {
          preset_id: preset.id,
          confirm_step: "shown" as const,
          ...(target.kind === "engagement"
            ? { engagement_id: target.id }
            : { work_item_id: anchorItemId ?? target.id }),

          // The id alone: the check's wording is read from the record.
          ...(checkId ? { check_id: checkId } : {}),
          ...(extraItemIds && extraItemIds.length > 0 && target.kind !== "engagement"
            ? { extra_item_ids: extraItemIds }
            : {}),
          profile_id: profileId,
        },

        (delta) => setStreamed((prev) => prev + delta),
      );
      setSessionId(result.session_id);
      setSuppressed(result.suppressed);
      setClaims(result.claims);
      setRunId(result.run_id);
      setReused(result.reused);
      setLiveManifest(result.manifest ?? null);
      logEvent("reflect.session_created", orgId, { preset: preset.id });
      // The mirror of the lineage handover: the model has run, and the answer
      // is read as ink on the conversation it came from.
      if (preset.id === "verification_thread" && result.run_id) {
        const { openVerifyThread } = await import("@/components/verify/verify-thread-state");
        openVerifyThread({
          runId: result.run_id,
          itemId: anchorItemId ?? target.id,
          itemTitle: target.title,
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["reflect-sessions"] });
      await queryClient.invalidateQueries({ queryKey: ["reflect-messages", result.session_id] });

    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
      setStreamed("");
    }
  }

  // One confirm step per opening when a preset was chosen from the row it
  // opened from. Nothing runs until the person confirms.
  useEffect(() => {
    if (!open || started.current || !initialPreset) return;
    const preset = presets.find((p) => p.id === initialPreset);
    if (preset) {
      started.current = preset.id;
      setConfirming({ preset, target });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function submit() {
    const message = draft.trim();
    if (!message || !sessionId || pending) return;
    setDraft("");
    setPending(true);
    setError(null);
    try {
      await send({
        data: {
          session_id: sessionId,
          message,
          profile_id: profileId,
          surface: "ask_lasso",
          ...(active ? { preset: active.id } : {}),
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["reflect-messages", sessionId] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  // Each engagement preset states its own minimum, so a two item engagement
  // can run a sequence while a recurrence stays honestly out of reach.
  const shortFor = (preset: AnalysisPreset) =>
    target.kind === "engagement" && target.itemCount < minItemsFor(preset);
  const notEnoughWork = presets.some((preset) => shortFor(preset));


  const readsDetail =
    target.kind === "engagement"
      ? `the ${target.itemCount} ${target.itemCount === 1 ? "piece" : "pieces"} of work mapped into this engagement, oldest first`
      : target.scope === "deliverable"
        ? "this piece of work, the conversations linked to it, and the brief when there is one"
        : `this conversation only, ${turnCount ?? 0} message${
            turnCount === 1 ? "" : "s"
          }, read in full`;

  const body = (
    <>

      <AnalysisConfirm
        request={confirming}
        orgId={orgId}
        profileId={profileId}
        onCancel={() => setConfirming(null)}
        onConfirm={(anchorItemId, extraItemIds) => {
          const pending_ = confirming;
          setConfirming(null);
          if (pending_)
            void runPreset(pending_.preset, pending_.check?.id, extraItemIds, anchorItemId);
        }}


      />
      <header className="shrink-0 border-b border-border px-6 pb-4 pt-6">
        <p className="micro-label micro-label-ai">{active ? active.label : "Analyse this work"}</p>
        <h2 className="page-title mt-1 break-words text-[19px] leading-snug">{target.title}</h2>
        <p className="mt-2 text-xs text-muted-foreground">
          {isCoach
            ? "Reads only what has been shared with you. Observations only, never a score."
            : "Private to you. Observations only, never a score."}
        </p>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
        {active ? <p className="text-sm text-muted-foreground">{active.description}</p> : null}
        {reused ? (
          <p className="text-xs text-muted-foreground">
            This analysis already ran on this exact work. Showing that result.
          </p>
        ) : null}
        {!active && !pending ? (
          <p className="text-sm text-muted-foreground">
            Pick an analysis below. Each one opens its own session over this work.
          </p>
        ) : null}

        {(messages ?? []).map((message, index) =>
          message.role === "user" && index === 0 ? null : (
            <div key={message.id}>
              <p className="micro-label">{message.role === "user" ? "You" : "Lasso"}</p>
              {message.role === "user" ? (
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {message.content}
                </p>
              ) : (
                <>
                  <MarkdownMessage content={message.content} />
                  <ContextAudit manifest={parseManifest(message.context_manifest)} />
                </>
              )}
            </div>
          ),
        )}

        {pending ? (
          <>
            <ThinkingTrail
              items={target.kind === "item" ? [{ id: target.id, title: target.title }] : []}
              finalPhase={active ? `Applying ${active.label}` : "Working"}
              manifest={liveManifest}
            />
            {streamed ? <MarkdownMessage content={streamed} /> : null}
          </>
        ) : null}

        {suppressed > 0 ? (
          <p className="text-xs text-muted-foreground">
            {suppressed === 1
              ? "One finding was left out because its exact wording could not be confirmed."
              : `${suppressed} findings were left out because their exact wording could not be confirmed.`}
          </p>
        ) : null}

        {active && (messages ?? []).some((m) => m.role === "assistant") ? (
          <div className="border-t border-border pt-4">
            <AnalysisInfoPanel preset={active} readsDetail={readsDetail} />
            {active.attribution ? (
              <p className="mt-3 text-xs text-muted-foreground">{active.attribution}</p>
            ) : null}
            <FindingLabel preset={active.id} claims={claims} profileId={profileId} runId={runId} />
            <HandoffDrafts runId={runId} profileId={profileId} />
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {error ? <p className="px-6 pb-2 text-sm text-destructive">{error}</p> : null}

      <footer className="shrink-0 border-t border-border bg-card px-6 py-4">
        <Suggested className="mb-3">
          <div className="flex items-center gap-2">
            <SuggestDot />
            <p className="text-xs text-ember-deep">Analyses Lasso can run on this work</p>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {presets
              .filter((preset) => preset.id !== "firm_checks")
              .map((preset) => {
                const blocked = shortFor(preset);
                return (
                  <div key={preset.id} className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={pending || blocked}
                      title={blocked ? notEnoughWorkLine(preset) : undefined}

                      onClick={() => setConfirming({ preset, target })}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-opacity hover:opacity-85 disabled:opacity-50 ${
                        active?.id === preset.id
                          ? "bg-ember text-ember-foreground"
                          : "border border-border bg-card text-foreground"
                      }`}
                    >
                      {preset.label}
                    </button>
                    <AnalysisInfoPanel preset={preset} readsDetail={readsDetail} iconOnly />
                  </div>
                );
              })}
          </div>
          {/* Pass 92: the firm's own checks, one bubble each, in the accent
              treatment so they read as the firm's knowledge, not Lasso's. */}
          {firmPreset && firmCheckCount > 0 ? (
            <div className="mt-2 flex items-start gap-1.5">
              <FirmCheckBubbles
                checks={firmChecks ?? []}
                disabled={pending}
                onPick={(check) =>
                  setConfirming({
                    preset: firmPreset,
                    target,
                    ...(check ? { check: { id: check.id, title: check.title } } : {}),
                  })
                }
              />
              <AnalysisInfoPanel preset={firmPreset} readsDetail={readsDetail} iconOnly />
            </div>
          ) : null}
          {firmPreset && firmCheckCount === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">{NO_FIRM_CHECKS_LINE}</p>
          ) : null}

          {notEnoughWork
            ? [...new Set(presets.filter(shortFor).map(notEnoughWorkLine))].map((line) => (
                <p key={line} className="mt-2 text-xs text-muted-foreground">
                  {line}
                </p>
              ))
            : null}

        </Suggested>

        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask a follow up about this work"
            rows={2}
            className="resize-none"
            disabled={!sessionId}
          />
          <Button onClick={() => void submit()} disabled={pending || !draft.trim() || !sessionId}>
            {pending ? <WorkingLabel>Working</WorkingLabel> : "Send"}
          </Button>
        </div>
        {isCoach ? null : (
          <Link
            to="/reflect"
            className="mt-3 inline-block text-xs font-medium text-accent-deep transition-opacity hover:opacity-70"
          >
            Open in Reflect →
          </Link>
        )}
      </footer>
    </>
  );

  return (
    <SlideOver
      open={open}
      onOpenChange={onOpenChange}
      title={active ? active.label : "Analyse this work"}
      description="Observations over your own work"
    >
      {body}
    </SlideOver>
  );

}

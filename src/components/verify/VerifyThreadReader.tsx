/**
 * PASS 127 — the thread scoped verification reader.
 *
 * The findings sit on a rail beside the conversation; tapping one scrolls the
 * transcript to the turn the model produced the claim in and settles the ink
 * on the claim itself. Nothing crawls on its own: the reader walks at the
 * reader's pace, one finding at a time.
 *
 * Owner only. A coach never reaches this surface, and the component renders
 * null for one even if it is somehow mounted.
 */
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ThreadBody } from "@/components/peek/ThreadBody";
import { SpanLegend } from "@/components/provenance/SpanLegend";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  closeVerifyThread,
  useVerifyThread,
  type VerifyThreadRequest,
} from "@/components/verify/verify-thread-state";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { loadHandoffs } from "@/lib/handoffs.functions";
import { logV2 } from "@/lib/telemetry-v2";
import {
  VERIFY_LEGEND,
  VERIFY_THREAD_EMPTY_LINE,
  VERIFY_THREAD_LABEL,
  turnAnchorId,
  verdictInk,
  verdictPhrase,
  verifyFindings,
  type ThreadMark,
} from "@/lib/verify-thread-shared";
import type { WorkItemRow } from "@/lib/work-types";

/** The settle beat, matching the existing nb-ink-settle + nb-span-pulse pair. */
const SETTLE_MS = 750;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

function ReaderBody({ request }: { request: VerifyThreadRequest }) {
  const { data: profile } = useProfile();
  const load = useServerFn(loadHandoffs);
  const track = useServerFn(recordEventFn);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [cursor, setCursor] = useState(-1);
  const timer = useRef<number | null>(null);
  const reduced = prefersReducedMotion();

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
    };
  }, []);

  const isCoach = profile?.role === "coach";

  const itemQuery = useQuery({
    queryKey: ["verify-thread-item", request.itemId],
    enabled: Boolean(profile) && !isCoach,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_items")
        .select("*")
        .eq("id", request.itemId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as WorkItemRow | null;
    },
  });

  const findingsQuery = useQuery({
    queryKey: ["verify-thread-findings", request.runId, profile?.id],
    enabled: Boolean(profile) && !isCoach,
    queryFn: async () => {
      const result = await load({ data: { run_id: request.runId, profile_id: profile!.id } });
      return result.block?.items ?? [];
    },
  });

  const findings = useMemo(
    () => verifyFindings(findingsQuery.data ?? []),
    [findingsQuery.data],
  );

  const marks: ThreadMark[] = useMemo(
    () =>
      findings.map((finding) => ({
        id: finding.id,
        turnNo: Number(finding.fields.evidence_turn_id),
        quote: finding.fields.claim_quote,
        verdict: finding.fields.verdict,
      })),
    [findings],
  );

  const goTo = useCallback(
    (index: number) => {
      const finding = findings[index];
      if (!finding) return;
      setCursor(index);
      setActiveId(finding.id);
      const anchor = document.getElementById(
        turnAnchorId(Number(finding.fields.evidence_turn_id)),
      );
      anchor?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
      if (timer.current !== null) window.clearTimeout(timer.current);
      if (!reduced) {
        timer.current = window.setTimeout(() => {
          timer.current = null;
        }, SETTLE_MS);
      }
      if (profile) {
        logV2(
          "evidence.opened",
          { surface: "verify_thread_rail", item_type: "ai_thread" },
          { profileId: profile.id, workItemId: request.itemId },
        );
        void track({
          data: {
            event_type: "evidence.opened",
            org_id: profile.org_id,
            dims: { surface: "verify_thread_rail" },
          },
        }).catch(() => {});
      }
    },
    [findings, profile, reduced, request.itemId, track],
  );

  if (!profile || isCoach) return null;

  const item = itemQuery.data ?? null;
  const loading = itemQuery.isLoading || findingsQuery.isLoading;

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_280px]">
      <div
        data-testid="verify-thread-transcript"
        className="max-h-[60dvh] overflow-y-auto pr-1"
      >
        {item ? (
          <ThreadBody
            item={item}
            marks={marks}
            activeMarkId={activeId}
            reducedMotion={reduced}
          />
        ) : null}
      </div>

      <aside data-testid="verify-thread-rail" className="flex flex-col gap-3">
        {loading ? (
          <p className="text-xs text-muted-foreground">Reading the record...</p>
        ) : findings.length === 0 ? (
          <p
            data-testid="verify-thread-empty"
            className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground"
          >
            {VERIFY_THREAD_EMPTY_LINE}
          </p>
        ) : (
          <>
            <ol className="flex flex-col gap-2">
              {findings.map((finding, index) => {
                const ink = verdictInk(finding.fields.verdict);
                return (
                  <li key={finding.id}>
                    <button
                      type="button"
                      data-testid={`verify-finding-${finding.id}`}
                      data-active={activeId === finding.id ? "true" : "false"}
                      onClick={() => goTo(index)}
                      className="w-full rounded-[var(--radius)] border border-border bg-card px-3 py-2 text-left shadow-card"
                    >
                      <span className="flex items-center gap-1.5">
                        <span
                          aria-hidden
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: ink.stroke }}
                        />
                        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                          {verdictPhrase(finding.fields.verdict)}
                        </span>
                      </span>
                      <span className="mt-1 block text-xs leading-snug text-foreground">
                        {finding.fields.claim_quote}
                      </span>
                      <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
                        {finding.fields.suggested_check}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                data-testid="verify-thread-next"
                onClick={() => goTo(Math.min(cursor + 1, findings.length - 1))}
                disabled={cursor >= findings.length - 1}
              >
                Next
              </Button>
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                {Math.max(cursor + 1, 0)} of {findings.length}
              </span>
            </div>
            <ul
              data-testid="verify-thread-legend"
              className="flex flex-col gap-1 border-t border-border pt-2"
            >
              {VERIFY_LEGEND.map((entry) => (
                <li
                  key={entry.verdict}
                  className="flex items-center gap-1.5 text-[11px] leading-snug text-muted-foreground"
                >
                  <span
                    aria-hidden
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: verdictInk(entry.verdict).stroke }}
                  />
                  {entry.phrase}
                </li>
              ))}
            </ul>
            <SpanLegend />
          </>
        )}
      </aside>
    </div>
  );
}

export function VerifyThreadReader() {
  const request = useVerifyThread();
  return (
    <Dialog open={Boolean(request)} onOpenChange={(open) => (open ? null : closeVerifyThread())}>
      <DialogContent className="max-h-[calc(88dvh-env(safe-area-inset-top))] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="page-title">{VERIFY_THREAD_LABEL}</DialogTitle>
          <p className="text-xs text-muted-foreground">{request?.itemTitle ?? ""}</p>
        </DialogHeader>
        {request ? <ReaderBody request={request} /> : null}
      </DialogContent>
    </Dialog>
  );
}

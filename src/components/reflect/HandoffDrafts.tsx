import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { AddDecisionDialog } from "@/components/decisions/AddDecisionDialog";
import { Button } from "@/components/ui/button";
import {
  confirmHandoffBatch,
  confirmHandoffItem,
  discardHandoffItem,
  loadHandoffs,
} from "@/lib/handoffs.functions";
import type {
  CheckResultItem,
  DecisionCandidateItem,
  DepartureItem,
  HandoffBlock,
  HandoffItem,
  HandoffKind,
  OpenCheckItem,
} from "@/lib/handoffs-shared";

/** What confirming does, said literally. No destination is a surprise. */
const DESTINATION_LINE: Record<HandoffKind, string> = {
  open_checks: "Sends to your 1:1 notes",
  decision_candidates: "Opens the decision drafter",
  departures: "Records that this departure was seen",
  check_results: "Keeps this status on the work",
};

const HEADING: Record<HandoffKind, string> = {
  open_checks: "Checks worth running",
  decision_candidates: "Calls that look like decisions",
  departures: "Departures from the brief",
  check_results: "How each check reads on this work",
};

function Quote({ text }: { text: string }) {
  const [full, setFull] = useState(false);
  const long = text.length > 260;
  return (
    <div className="text-sm">
      <span className="whitespace-pre-wrap">
        {full || !long ? `"${text}"` : `"${text.slice(0, 260)}..."`}
      </span>
      {long ? (
        <button
          type="button"
          className="ml-2 text-xs underline text-muted-foreground"
          onClick={() => setFull((v) => !v)}
        >
          {full ? "Show less" : "Show all"}
        </button>
      ) : null}
    </div>
  );
}

function ItemBody({ kind, item }: { kind: HandoffKind; item: HandoffItem }) {
  if (kind === "open_checks") {
    const f = item.fields as OpenCheckItem;
    return (
      <div className="space-y-1.5">
        <Quote text={f.claim_quote} />
        <div className="micro-label">{f.location}</div>
        <p className="text-sm text-muted-foreground">
          {f.verdict === "contradicted"
            ? "This claim conflicts with another part of the work or the record."
            : "This claim shows no visible verification in the record."}
        </p>
        <p className="text-sm">Check: {f.suggested_check}</p>
      </div>
    );
  }
  if (kind === "decision_candidates") {
    const f = item.fields as DecisionCandidateItem;
    return (
      <div className="space-y-1.5">
        <p className="text-sm font-medium">{f.call}</p>
        <p className="text-sm text-muted-foreground">Where it came from: {f.origin}</p>
        <p className="text-sm text-muted-foreground">What it settled: {f.what_it_decided}</p>
        <div className="micro-label">{f.deliverable_location ?? f.evidence_turn_id ?? ""}</div>
      </div>
    );
  }
  if (kind === "departures") {
    const f = item.fields as DepartureItem;
    return (
      <div className="space-y-1.5">
        <div className="micro-label">{f.class}</div>
        <p className="text-xs text-muted-foreground">In the brief</p>
        <Quote text={f.brief_quote} />
        <p className="text-xs text-muted-foreground">In the work</p>
        <Quote text={f.work_quote} />
        <div className="micro-label">{f.entered_at}</div>
      </div>
    );
  }
  const f = item.fields as CheckResultItem;
  const status =
    f.status === "addressed"
      ? "Addressed in the work"
      : f.status === "partly"
        ? "Partly addressed in the work"
        : "Not visible in the work";
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">Check {f.check_id}</p>
      <p className="text-sm text-muted-foreground">{status}</p>
      {f.evidence_quote ? <Quote text={f.evidence_quote} /> : null}
    </div>
  );
}

/**
 * The drafts an analysis left behind. Nothing here has moved anywhere. Each
 * item waits for the owner to confirm it or discard it, one tap at a time.
 */
export function HandoffDrafts({
  runId,
  profileId,
  superseded = false,
}: {
  runId: string | undefined;
  profileId: string | undefined;
  superseded?: boolean;
}) {
  const load = useServerFn(loadHandoffs);
  const confirmOne = useServerFn(confirmHandoffItem);
  const confirmAll = useServerFn(confirmHandoffBatch);
  const discard = useServerFn(discardHandoffItem);
  const [block, setBlock] = useState<HandoffBlock | null>(null);
  const [duplicate, setDuplicate] = useState(false);
  const [prefill, setPrefill] = useState<DecisionCandidateItem | null>(null);

  const query = useQuery({
    queryKey: ["handoffs", runId, profileId],
    enabled: Boolean(runId && profileId),
    queryFn: async () =>
      await load({ data: { run_id: runId!, ...(profileId ? { profile_id: profileId } : {}) } }),
  });

  const current = block ?? query.data?.block ?? null;

  const act = useMutation({
    mutationFn: async (input: { kind: "confirm" | "discard" | "batch"; ids: string[] }) => {
      const base = { run_id: runId!, ...(profileId ? { profile_id: profileId } : {}) };
      if (input.kind === "batch") return await confirmAll({ data: { ...base, item_ids: input.ids } });
      if (input.kind === "confirm")
        return await confirmOne({ data: { ...base, item_id: input.ids[0]! } });
      return await discard({ data: { ...base, item_id: input.ids[0]! } });
    },
    onSuccess: (result) => {
      setBlock(result.block);
      setDuplicate(result.duplicate);
    },
  });

  if (!current || current.items.length === 0) return null;
  const drafts = current.items.filter((item) => item.state === "draft");
  const settled = current.items.filter((item) => item.state !== "draft");

  return (
    <section className="mt-6 border-t border-border pt-4">
      <h3 className="micro-label">{HEADING[current.kind]}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Drafts from this analysis. Nothing moves until you say so.
      </p>
      {superseded ? (
        <p className="mt-1 text-xs text-muted-foreground">Superseded by a later run.</p>
      ) : null}

      <div className="mt-3 space-y-3">
        {drafts.map((item) => (
          <div key={item.id} className="rounded-md border border-border bg-card p-3">
            <ItemBody kind={current.kind} item={item} />
            <p className="mt-2 text-xs text-muted-foreground">
              {DESTINATION_LINE[current.kind]}
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button
                size="sm"
                className="min-h-11 sm:min-h-9"
                disabled={act.isPending || !runId}
                onClick={() => {
                  if (current.kind === "decision_candidates") {
                    setPrefill(item.fields as DecisionCandidateItem);
                  }
                  act.mutate({ kind: "confirm", ids: [item.id] });
                }}
              >
                Confirm
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="min-h-11 sm:min-h-9"
                disabled={act.isPending || !runId}
                onClick={() => act.mutate({ kind: "discard", ids: [item.id] })}
              >
                Discard
              </Button>
            </div>
          </div>
        ))}
      </div>

      {drafts.length > 1 ? (
        <Button
          size="sm"
          variant="outline"
          className="mt-3 min-h-11 sm:min-h-9"
          disabled={act.isPending}
          onClick={() => act.mutate({ kind: "batch", ids: drafts.map((item) => item.id) })}
        >
          Confirm all remaining
        </Button>
      ) : null}

      {duplicate ? <p className="mt-2 text-xs text-muted-foreground">Already saved.</p> : null}

      {settled.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {settled.map((item) => (
            <li key={item.id} className="text-xs text-muted-foreground">
              {item.state === "confirmed" ? "Confirmed" : "Discarded"}
            </li>
          ))}
        </ul>
      ) : null}

      {prefill ? (
        <AddDecisionDialog
          open
          onOpenChange={(next) => {
            if (!next) setPrefill(null);
          }}
          prefill={{
            situation: prefill.origin,
            call: prefill.call,
            why: prefill.what_it_decided,
          }}
        />
      ) : null}
    </section>
  );
}

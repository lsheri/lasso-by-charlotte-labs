import { WorkingLabel } from "@/components/common/Working";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SuggestDot } from "@/components/common/Suggested";
import { Button } from "@/components/ui/button";
import { ThreadViewerById } from "@/components/work/ThreadViewerById";
import { useProfile } from "@/hooks/use-profile";
import { vendorLabel } from "@/lib/conversation-shared";
import { RELATION_LABEL, type LineageRelation } from "@/lib/lineage-shared";
import {
  draftLineage,
  getDeliverableEvidence,
  reviewLink,
  type EvidenceLink,
} from "@/lib/lineage.functions";
import { recordEventFn } from "@/lib/telemetry.functions";
import { hueStyles, vendorHue, workIdentity } from "@/lib/work-identity";
import { formatDate, type WorkType } from "@/lib/work-types";

const VISIBLE_PROMPTS = 5;

function relationLabel(relation: string): string {
  return RELATION_LABEL[relation as LineageRelation] ?? "Fed this";
}

function ContributorRow({
  link,
  onOpen,
  children,
}: {
  link: EvidenceLink;
  onOpen: () => void;
  children?: React.ReactNode;
}) {
  const identity = workIdentity({
    type: link.item.type as WorkType,
    source_meta: link.item.kind ? { kind: link.item.kind } : null,
  });
  const Icon = identity.icon;
  const styles = hueStyles(identity.hue);
  const hue = vendorHue(link.item.source_vendor);
  const isDraft = link.status === "draft";

  return (
    <li
      className="rounded-[var(--radius-md)] border border-border bg-card px-3 py-2.5"
      style={
        isDraft
          ? { background: "var(--suggest-wash)", borderLeft: "3px solid var(--suggest-edge)" }
          : undefined
      }
    >
      <div className="flex items-start gap-2.5">
        <span
          className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-[6px] border"
          style={{ color: styles.color, background: styles.background, borderColor: styles.border }}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onOpen}
            className="block max-w-full truncate text-left text-sm font-medium text-foreground hover:underline"
          >
            {link.item.title}
          </button>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            {isDraft ? <SuggestDot /> : null}
            <span>{relationLabel(link.relation)}</span>
            <span aria-hidden>·</span>
            <span>{identity.label}</span>
            {link.item.source_vendor ? (
              <span
                className="rounded-full border px-1.5 py-0.5"
                style={
                  hue
                    ? {
                        color: `var(${hue})`,
                        background: `color-mix(in oklab, var(${hue}) 12%, transparent)`,
                        borderColor: `color-mix(in oklab, var(${hue}) 28%, transparent)`,
                      }
                    : undefined
                }
              >
                {vendorLabel(link.item.source_vendor)}
              </span>
            ) : null}
            <span aria-hidden>·</span>
            <span>{formatDate(link.item.date)}</span>
          </p>
          {link.rationale ? (
            <p className="mt-1.5 text-sm text-muted-foreground">{link.rationale}</p>
          ) : null}
          {children}
        </div>
      </div>
    </li>
  );
}

/**
 * The deliverable view: what fed this piece of work, and the person's own
 * prompts behind it, verbatim. Drafts wear the suggestion treatment, because
 * Lasso proposed them and a person decides.
 */
export function WhatFedThis({ workItemId, canEdit }: { workItemId: string; canEdit: boolean }) {
  const { data: profile } = useProfile();
  const load = useServerFn(getDeliverableEvidence);
  const run = useServerFn(draftLineage);
  const review = useServerFn(reviewLink);
  const track = useServerFn(recordEventFn);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [openThread, setOpenThread] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["lineage", workItemId, profile?.id],
    enabled: Boolean(profile),
    queryFn: () => load({ data: { work_item_id: workItemId, profile_id: profile?.id } }),
  });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["lineage", workItemId] });
  }

  async function find() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await run({ data: { work_item_id: workItemId, profile_id: profile?.id } });
      await refresh();
      toast(
        result.considered === 0
          ? "Nothing else is mapped into this engagement yet, so there is nothing to compare."
          : result.drafted > 0
            ? `${result.drafted} link${result.drafted === 1 ? "" : "s"} proposed from ${result.considered} item${result.considered === 1 ? "" : "s"} considered.`
            : `Lasso read ${result.considered} item${result.considered === 1 ? "" : "s"} and did not find evidence of a connection.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't look for what fed this");
    } finally {
      setBusy(false);
    }
  }

  async function act(linkId: string, action: "confirmed" | "discarded") {
    try {
      await review({ data: { link_id: linkId, action, profile_id: profile?.id } });
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save that");
    }
  }

  function evidenceOpened(surface: string) {
    if (!profile) return;
    void track({
      data: { event_type: "evidence.opened", org_id: profile.org_id, dims: { surface } },
    }).catch(() => {});
  }

  const links = data?.links ?? [];
  const confirmed = links.filter((link) => link.status === "confirmed");
  const drafts = links.filter((link) => link.status === "draft");
  const prompts = data?.prompts ?? [];
  const shown = showAll ? prompts : prompts.slice(0, VISIBLE_PROMPTS);

  const findButton = canEdit ? (
    <Button type="button" disabled={busy} onClick={() => void find()}>
      <Sparkle className="mr-2 h-4 w-4" aria-hidden />
      {busy ? <WorkingLabel>Reading this engagement</WorkingLabel> : "Find what fed this"}
    </Button>
  ) : null;

  return (
    <section className="mt-8 border-t border-border pt-4">
      <h3 className="micro-label">What fed this</h3>

      {isLoading ? (
        <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
      ) : confirmed.length === 0 && drafts.length === 0 ? (
        <div
          className="mt-2 rounded-[var(--radius-md)] border border-dashed border-l-[3px] px-4 py-5"
          style={{
            background: "var(--suggest-wash)",
            borderLeftStyle: "solid",
            borderLeftColor: "var(--suggest-edge)",
          }}
        >
          <p className="text-sm text-foreground">
            Nothing linked yet. Lasso can look at this engagement and propose what fed this
            deliverable.
          </p>
          {findButton ? <div className="mt-4">{findButton}</div> : null}
        </div>
      ) : (
        <>
          <ul className="mt-2 space-y-2">
            {confirmed.map((link) => (
              <ContributorRow
                key={link.id}
                link={link}
                onOpen={() => {
                  evidenceOpened("contributor");
                  setOpenThread(link.item.id);
                }}
              >
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => void act(link.id, "discarded")}
                    className="mt-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Remove this link
                  </button>
                ) : null}
              </ContributorRow>
            ))}
            {drafts.map((link) => (
              <ContributorRow
                key={link.id}
                link={link}
                onOpen={() => {
                  evidenceOpened("contributor");
                  setOpenThread(link.item.id);
                }}
              >
                {canEdit ? (
                  <div className="mt-2 flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => void act(link.id, "confirmed")}
                      className="text-xs font-medium text-accent-deep transition-opacity hover:opacity-70"
                    >
                      Yes, this fed it
                    </button>
                    <button
                      type="button"
                      onClick={() => void act(link.id, "discarded")}
                      className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      No it didn&apos;t
                    </button>
                  </div>
                ) : null}
              </ContributorRow>
            ))}
          </ul>
          {findButton ? <div className="mt-3">{findButton}</div> : null}
        </>
      )}

      {prompts.length > 0 ? (
        <div className="mt-6">
          <h3 className="micro-label">Your prompts behind this work</h3>
          <ul className="mt-2 space-y-2">
            {shown.map((prompt) => (
              <li key={prompt.turn_id}>
                <button
                  type="button"
                  onClick={() => {
                    evidenceOpened("prompt");
                    setOpenThread(prompt.work_item_id);
                  }}
                  className="block w-full rounded-[var(--radius-md)] border-l-2 border-border bg-secondary/50 px-3 py-2 text-left transition-colors hover:border-accent"
                >
                  <span className="block whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground">
                    {prompt.content}
                  </span>
                  <span className="mt-1.5 block font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                    {prompt.ts ? formatDate(prompt.ts) : "date unknown"} · {prompt.thread_title}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {prompts.length > VISIBLE_PROMPTS ? (
            <button
              type="button"
              onClick={() => {
                if (!showAll) evidenceOpened("show_all");
                setShowAll((prev) => !prev);
              }}
              className="mt-2 text-xs font-medium text-accent-deep transition-opacity hover:opacity-70"
            >
              {showAll ? "Show fewer" : `Show all ${prompts.length}`}
            </button>
          ) : null}
        </div>
      ) : null}

      <ThreadViewerById workItemId={openThread} onClose={() => setOpenThread(null)} />
    </section>
  );
}

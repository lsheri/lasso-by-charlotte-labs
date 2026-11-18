import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { firmDate } from "@/lib/firm-ask-shared";
import {
  BRIEF_LABELS,
  emptyBrief,
  PROPOSAL_BRIEF_FIELDS,
  PROPOSAL_BRIEF_MAX,
  PROPOSAL_COPY,
  type PastFee,
  type Precedent,
  type ProposalBrief,
} from "@/lib/proposal-shared";
import { DRAFT_COPY } from "@/lib/proposal-draft-shared";
import { draftProposal, draftProposalBrief, findProposalPrecedents, latestProposalDraft, type PrecedentsResult, type ProposalDraftResult } from "@/lib/proposal.functions";

import { FirmSourcePreview } from "./FirmSourcePreview";
import { ProposalDraftView } from "./ProposalDraftView";

function outcomeParts(view: { active?: boolean; ranToPlan: boolean | null; extended: boolean | null }): string[] {
  if (view.active) return [PROPOSAL_COPY.active];
  const parts: (string | null)[] = [
    view.ranToPlan === null ? null : view.ranToPlan ? PROPOSAL_COPY.ranToPlan : PROPOSAL_COPY.overran,
    view.extended === null ? null : view.extended ? PROPOSAL_COPY.extended : PROPOSAL_COPY.notExtended,
  ];
  return parts.filter((part): part is string => part !== null);
}

function PrecedentCard({
  view,
  options,
  onSwap,
  onOpen,
}: {
  view: Precedent;
  options: Precedent[];
  onSwap: (boardId: string) => void;
  onOpen: (itemId: string) => void;
}) {
  return (
    <li data-precedent={view.closeness} className="rounded-[var(--radius)] border border-border bg-background p-3">
      <p className="font-mono text-(length:--type-label) uppercase tracking-[0.06em] text-muted-foreground">
        {view.closeness === "close" ? PROPOSAL_COPY.close : PROPOSAL_COPY.loose}
      </p>
      <p className="mt-0.5 text-(length:--type-body) font-medium text-foreground">{view.title}</p>
      <p className="text-(length:--type-small) text-muted-foreground">
        {[view.client, view.weeks ? `${view.weeks} weeks` : null, ...outcomeParts(view)].filter(Boolean).join(" · ")}
      </p>
      {view.why ? <p className="mt-1 text-(length:--type-small) text-foreground">{view.why}</p> : null}
      {view.scope ? <p className="mt-1 text-(length:--type-small) text-muted-foreground">{view.scope}</p> : null}
      {view.lesson ? (
        <p data-precedent-lesson className="mt-2 border-l-2 border-border pl-2 text-(length:--type-small) text-foreground">
          <span className="font-medium">{PROPOSAL_COPY.lastTime}: </span>
          {view.lesson}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {view.sowItemId ? (
          <Button type="button" size="sm" variant="outline" onClick={() => onOpen(view.sowItemId!)}>
            SOW
          </Button>
        ) : null}
        {options.length ? (
          <label className="flex items-center gap-1 text-(length:--type-small) text-muted-foreground">
            {PROPOSAL_COPY.swap}
            <select
              aria-label={`${PROPOSAL_COPY.swap} ${view.title}`}
              value=""
              onChange={(event) => event.target.value && onSwap(event.target.value)}
              className="max-w-[12rem] rounded-[var(--radius-control)] border border-input bg-background px-1 py-0.5 text-(length:--type-small)"
            >
              <option value="">…</option>
              {options.map((option) => (
                <option key={option.boardId} value={option.boardId}>
                  {option.title}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
    </li>
  );
}

function FeeList({ label, rows, onOpen }: { label: string; rows: PastFee[]; onOpen: (itemId: string) => void }) {
  if (!rows.length) return null;
  return (
    <div className="mt-2">
      <p className="text-(length:--type-small) font-medium text-foreground">{label}</p>
      <ul className="mt-1 flex flex-col gap-1">
        {rows.map((row) => (
          <li key={row.boardId} data-past-fee={row.basis} className="flex flex-wrap items-baseline gap-x-2 text-(length:--type-small) text-muted-foreground">
            <span className="font-medium text-foreground">{row.fee}</span>
            <span>{row.title}</span>
            <span>{[row.weeks ? `${row.weeks} weeks` : null, firmDate(row.startedOn), ...outcomeParts(row)].filter(Boolean).join(" · ")}</span>
            <button type="button" className="underline" onClick={() => onOpen(row.sowItemId)}>
              SOW
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * 17 Nov, Start a proposal step 1, as a board side panel (its own file so it can be tested: nothing renders
 * CanvasLabPage in tests). The owner reads the notes into a brief, corrects it, and sees precedents with their
 * lessons, the firm's client-shown proposals and, for admins and leads, past fees. The Draft button comes after the
 * precedents, so the owner sees real past work before generated text. The saved draft is handed to the board through
 * onDraftSaved, which places its card like any other added work.
 */
export function ProposalStartPanel({
  engagementId,
  profileId,
  orgId,
  onClose,
  onDraftSaved,
}: {
  engagementId: string;
  profileId: string | null | undefined;
  orgId: string | null | undefined;
  onClose: () => void;
  onDraftSaved?: ((itemId: string) => void) | undefined;
}) {
  const readBrief = useServerFn(draftProposalBrief);
  const find = useServerFn(findProposalPrecedents);
  const [brief, setBrief] = useState<ProposalBrief>(emptyBrief);
  const [reading, setReading] = useState(false);
  const [finding, setFinding] = useState(false);
  const [failed, setFailed] = useState(false);
  const [result, setResult] = useState<PrecedentsResult | null>(null);
  const [chosen, setChosen] = useState<Precedent[]>([]);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const writeDraft = useServerFn(draftProposal);
  const loadLatest = useServerFn(latestProposalDraft);
  const [drafting, setDrafting] = useState(false);
  const [saved, setSaved] = useState<ProposalDraftResult | null>(null);
  const [reopened, setReopened] = useState(false);

  useEffect(() => {
    let live = true;
    loadLatest({ data: { engagement_id: engagementId, profile_id: profileId ?? null } })
      .then((latest) => {
        if (live && latest) {
          setSaved((current) => current ?? latest);
          setReopened(true);
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [engagementId, profileId, loadLatest]);

  async function draft() {
    setDrafting(true);
    setFailed(false);
    try {
      const next = await writeDraft({ data: { engagement_id: engagementId, profile_id: profileId ?? null, brief, precedent_ids: chosen.map((view) => view.boardId) } });
      setSaved(next);
      setReopened(false);
      onDraftSaved?.(next.itemId);
    } catch {
      setFailed(true);
    } finally {
      setDrafting(false);
    }
  }

  async function readNotes() {
    setReading(true);
    setFailed(false);
    try {
      setBrief(await readBrief({ data: { engagement_id: engagementId, profile_id: profileId ?? null } }));
    } catch {
      setFailed(true);
    } finally {
      setReading(false);
    }
  }

  async function findPrecedents() {
    setFinding(true);
    setFailed(false);
    try {
      const next = await find({ data: { engagement_id: engagementId, profile_id: profileId ?? null, brief } });
      setResult(next);
      setChosen(next.precedents);
    } catch {
      setFailed(true);
    } finally {
      setFinding(false);
    }
  }

  function swap(from: string, to: string) {
    if (!result) return;
    const pool = [...result.options, ...result.precedents];
    const next = pool.find((view) => view.boardId === to);
    if (!next) return;
    setChosen((current) => current.map((view) => (view.boardId === from ? { ...next, closeness: view.closeness, why: "" } : view)));
    if (orgId) void import("@/lib/telemetry").then(({ logEvent }) => logEvent("proposal_draft.precedent_swapped", orgId, {})).catch(() => {});
  }

  const chosenIds = new Set(chosen.map((view) => view.boardId));
  const swapOptions = result ? [...result.precedents, ...result.options].filter((view) => !chosenIds.has(view.boardId)) : [];
  const closeCount = chosen.filter((view) => view.closeness === "close").length;
  const feeRows = (rows: PastFee[]) => rows.filter((row) => chosenIds.has(row.boardId));

  return (
    <aside data-testid="proposal-start" aria-label={PROPOSAL_COPY.title} className="z-20 flex min-h-0 w-[26rem] shrink-0 flex-col gap-4 overflow-y-auto border-l border-border bg-background p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-(length:--type-title) font-medium text-foreground">{PROPOSAL_COPY.title}</h2>
          <p className="mt-1 text-(length:--type-small) text-muted-foreground">{PROPOSAL_COPY.intro}</p>
          <p className="mt-1 text-(length:--type-small) text-muted-foreground">{PROPOSAL_COPY.privateNote}</p>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          {PROPOSAL_COPY.closePanel}
        </Button>
      </div>

      <section aria-label={PROPOSAL_COPY.briefTitle} className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-(length:--type-body) font-medium text-foreground">{PROPOSAL_COPY.briefTitle}</h3>
          <Button type="button" size="sm" variant="outline" disabled={reading} onClick={() => void readNotes()}>
            {reading ? PROPOSAL_COPY.readingNotes : PROPOSAL_COPY.readNotes}
          </Button>
        </div>
        <p className="text-(length:--type-small) text-muted-foreground">{PROPOSAL_COPY.briefHint}</p>
        {PROPOSAL_BRIEF_FIELDS.map((field) => (
          <label key={field} className="flex flex-col gap-0.5">
            <span className="font-mono text-(length:--type-label) uppercase tracking-[0.06em] text-muted-foreground">{BRIEF_LABELS[field]}</span>
            <Input
              value={brief[field]}
              maxLength={PROPOSAL_BRIEF_MAX}
              onChange={(event) => setBrief((current) => ({ ...current, [field]: event.target.value }))}
              className="h-9"
            />
          </label>
        ))}
        <Button type="button" variant="ink" disabled={finding || !brief.problem.trim()} onClick={() => void findPrecedents()}>
          {finding ? PROPOSAL_COPY.finding : PROPOSAL_COPY.findPrecedents}
        </Button>
      </section>

      {failed ? <p className="text-(length:--type-small) text-destructive">{PROPOSAL_COPY.error}</p> : null}

      {result ? (
        <>
          <section aria-label={PROPOSAL_COPY.precedentsTitle} className="flex flex-col gap-2">
            <h3 className="text-(length:--type-body) font-medium text-foreground">{PROPOSAL_COPY.precedentsTitle}</h3>
            {chosen.length === 0 ? (
              <p className="text-(length:--type-small) text-foreground">{PROPOSAL_COPY.noneFound}</p>
            ) : (
              <p className="text-(length:--type-small) text-muted-foreground">{PROPOSAL_COPY.fewer(closeCount)}</p>
            )}
            <ol className="flex flex-col gap-2">
              {chosen.map((view) => (
                <PrecedentCard key={view.boardId} view={view} options={swapOptions} onSwap={(to) => swap(view.boardId, to)} onOpen={setOpenItem} />
              ))}
            </ol>
            <p data-proposal-coverage className="font-mono text-(length:--type-label) uppercase tracking-[0.06em] text-muted-foreground">{result.coverage}</p>
          </section>

          {result.good.length ? (
            <section aria-label={PROPOSAL_COPY.goodTitle}>
              <h3 className="text-(length:--type-body) font-medium text-foreground">{PROPOSAL_COPY.goodTitle}</h3>
              <p className="text-(length:--type-small) text-muted-foreground">{PROPOSAL_COPY.goodHint}</p>
              <ul className="mt-1 flex flex-col gap-1">
                {result.good.map((proposal) => (
                  <li key={proposal.itemId}>
                    <button type="button" data-good-proposal onClick={() => setOpenItem(proposal.itemId)} className="text-left text-(length:--type-small) text-foreground underline">
                      {proposal.title}
                    </button>
                    <span className="text-(length:--type-small) text-muted-foreground">{` · shown ${firmDate(proposal.shownOn)}`}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {result.canSeeFees ? (
            <section aria-label={PROPOSAL_COPY.feesTitle} data-past-fees>
              <h3 className="text-(length:--type-body) font-medium text-foreground">{PROPOSAL_COPY.feesTitle}</h3>
              <p className="text-(length:--type-small) text-muted-foreground">{PROPOSAL_COPY.feesHint}</p>
              <FeeList label={PROPOSAL_COPY.fixed} rows={feeRows(result.fees.fixed)} onOpen={setOpenItem} />
              <FeeList label={PROPOSAL_COPY.monthly} rows={feeRows(result.fees.monthly)} onOpen={setOpenItem} />
            </section>
          ) : null}

          <section aria-label={DRAFT_COPY.draft} className="flex flex-col gap-2">
            <p className="text-(length:--type-small) text-muted-foreground">{DRAFT_COPY.draftHint}</p>
            <Button type="button" variant="ink" disabled={drafting} onClick={() => void draft()}>
              {drafting ? DRAFT_COPY.drafting : DRAFT_COPY.draft}
            </Button>
          </section>
        </>
      ) : null}

      {saved && !drafting ? (
        <>
          {reopened ? <p className="font-mono text-(length:--type-label) uppercase tracking-[0.06em] text-muted-foreground">{DRAFT_COPY.reopen}</p> : null}
          <ProposalDraftView key={`${saved.itemId}-${saved.draft.createdAt}`} itemId={saved.itemId} draft={saved.draft} profileId={profileId} orgId={orgId} onOpen={setOpenItem} />
        </>
      ) : null}

      <FirmSourcePreview itemId={openItem} profileId={profileId} onClose={() => setOpenItem(null)} />
    </aside>
  );
}

import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { tagVariants } from "@/components/ui/tag";
import { cn } from "@/lib/utils";
import { DRAFT_COPY, draftStatus, questionsText, type DraftSection, type DraftSource, type ProposalDraft } from "@/lib/proposal-draft-shared";
import { confirmProposalSection } from "@/lib/proposal.functions";

function SourceMark({ source, onOpen }: { source: DraftSource; onOpen: (itemId: string) => void }) {
  if (source.kind === "structure") {
    return (
      <li data-draft-source="structure" className="text-(length:--type-small) text-muted-foreground">
        {DRAFT_COPY.structureFrom(source.boardTitle)}
      </li>
    );
  }
  if (source.shared === false) {
    return (
      <li data-draft-source="unshared" className="text-(length:--type-small) text-muted-foreground">
        {DRAFT_COPY.noLongerShared}
      </li>
    );
  }
  return (
    <li data-draft-source="fact" className="text-(length:--type-small) text-foreground">
      <button type="button" className="underline" onClick={() => onOpen(source.itemId)}>
        {DRAFT_COPY.factFrom(source.itemTitle)}
      </button>
      <blockquote className="mt-0.5 border-l-2 border-border pl-2 text-muted-foreground">{source.quote}</blockquote>
    </li>
  );
}

function SectionCard({ section, busy, onConfirm, onOpen }: { section: DraftSection; busy: boolean; onConfirm: () => void; onOpen: (itemId: string) => void }) {
  const label = section.status === "confirmed" ? DRAFT_COPY.confirmed : section.status === "gap" ? DRAFT_COPY.gap : DRAFT_COPY.notReviewed;
  return (
    <li data-draft-section={section.key} data-draft-status={section.status} className="rounded-[var(--radius)] border border-border bg-background p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="min-w-0 text-(length:--type-body) font-medium text-foreground">{section.heading}</p>
        <span className={cn(tagVariants({ tone: section.status === "confirmed" ? "accent" : section.status === "gap" ? "muted" : "neutral" }), "shrink-0 whitespace-nowrap")}>{label}</span>
      </div>
      <p className="mt-1 whitespace-pre-line text-(length:--type-small) text-foreground">{section.body}</p>
      {section.flags.map((flag) => (
        <p key={flag} data-draft-flag className="mt-1 text-(length:--type-small) text-destructive">
          {flag}
        </p>
      ))}
      {section.sources.length ? (
        <ul className="mt-2 flex flex-col gap-1">
          {section.sources.map((source, index) => (
            <SourceMark key={`${source.kind}-${index}`} source={source} onOpen={onOpen} />
          ))}
        </ul>
      ) : null}
      {section.status !== "confirmed" ? (
        <Button type="button" size="sm" variant="outline" className="mt-2" disabled={busy} onClick={onConfirm}>
          {DRAFT_COPY.confirm}
        </Button>
      ) : null}
    </li>
  );
}

function checksLine(draft: ProposalDraft): string[] {
  const { checks } = draft;
  return [
    checks.names === "passed" ? DRAFT_COPY.namesPassed : checks.names === "redrafted" ? DRAFT_COPY.namesRedrafted : DRAFT_COPY.namesBlocked(checks.blocked),
    checks.figuresRemoved ? DRAFT_COPY.figuresRemoved(checks.figuresRemoved) : null,
    checks.newFacts ? DRAFT_COPY.newFacts(checks.newFacts) : null,
  ].filter((line): line is string => line !== null);
}

/**
 * 17 Nov, Start a proposal step 2: the first draft as sections, each "Draft, not reviewed" until the owner confirms
 * it. No accept-all. A status strip heads it, the checks say what they found in plain words, and the questions for
 * the lead are a block to copy. Nothing is sent from here.
 */
export function ProposalDraftView({
  itemId,
  draft: initial,
  profileId,
  orgId,
  onOpen,
}: {
  itemId: string;
  draft: ProposalDraft;
  profileId: string | null | undefined;
  orgId: string | null | undefined;
  onOpen: (itemId: string) => void;
}) {
  const confirm = useServerFn(confirmProposalSection);
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const status = draftStatus(draft);

  async function confirmSection(key: string) {
    setBusy(key);
    setFailed(false);
    try {
      setDraft(await confirm({ data: { item_id: itemId, section: key, profile_id: profileId ?? null } }));
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  }

  async function copyQuestions() {
    try {
      await navigator.clipboard.writeText(questionsText(draft.questions));
      setCopied(true);
    } catch {
      setFailed(true);
    }
    if (orgId) void import("@/lib/telemetry").then(({ logEvent }) => logEvent("proposal_draft.questions_copied", orgId, {})).catch(() => {});
  }

  return (
    <section aria-label={DRAFT_COPY.title} data-testid="proposal-draft" className="flex flex-col gap-2">
      <h3 className="text-(length:--type-body) font-medium text-foreground">{DRAFT_COPY.title}</h3>
      <p className="text-(length:--type-small) text-muted-foreground">{DRAFT_COPY.onBoard}</p>
      <ul data-draft-status-strip className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-(length:--type-label) uppercase tracking-[0.06em] text-muted-foreground">
        <li>{status.unconfirmed ? DRAFT_COPY.unconfirmed(status.unconfirmed) : DRAFT_COPY.ready}</li>
        <li>{DRAFT_COPY.openQuestions(status.questions)}</li>
        <li>{DRAFT_COPY.feeNotSet}</li>
      </ul>
      <ul data-draft-checks className="flex flex-col gap-0.5">
        {checksLine(draft).map((line) => (
          <li key={line} className="text-(length:--type-small) text-foreground">
            {line}
          </li>
        ))}
      </ul>
      {failed ? <p className="text-(length:--type-small) text-destructive">That did not work. Try again.</p> : null}
      <ol className="flex flex-col gap-2">
        {draft.sections.map((section) => (
          <SectionCard key={section.key} section={section} busy={busy !== null} onConfirm={() => void confirmSection(section.key)} onOpen={onOpen} />
        ))}
      </ol>
      {draft.questions.length ? (
        <div data-draft-questions className="rounded-[var(--radius)] border border-border bg-background p-3">
          <p className="text-(length:--type-body) font-medium text-foreground">{DRAFT_COPY.questionsTitle}</p>
          <p className="text-(length:--type-small) text-muted-foreground">{DRAFT_COPY.questionsHint}</p>
          <ol className="mt-2 flex list-decimal flex-col gap-1 pl-4">
            {draft.questions.map((question) => (
              <li key={question.text} className="text-(length:--type-small) text-foreground">
                {question.text}
                <span className="text-muted-foreground">{` ${DRAFT_COPY.defaultLabel}: ${question.fallback}`}</span>
              </li>
            ))}
          </ol>
          <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => void copyQuestions()}>
            {copied ? DRAFT_COPY.copied : DRAFT_COPY.copyQuestions}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

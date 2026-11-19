import { useQuery } from "@tanstack/react-query";

import { ProposalLedgerFigures } from "@/components/firm-brain/ProposalLedgerFigures";
import { SectionHeader } from "@/components/notebook/SectionHeader";
import { useFeatureFlag } from "@/hooks/use-feature-flag";
import { LEDGER_COPY, ledgerFigureLines, type FirmValueSoFar } from "@/lib/proposal-ledger-shared";
import { firmValueSoFar } from "@/lib/proposal-ledger.functions";

/**
 * 19 Nov, Firm Brain Build Spec step 9: "Proposals: value so far" on the firm view, for admins and leads, behind
 * company-brain. Counts across boards shared with the firm, built only from ledger rows the database shows this
 * reader; every number opens to the rows behind it. Per proposal, never per person: no name, owner or board title is
 * read or shown.
 */
export function FirmProposalsCard({ profileId }: { profileId: string | undefined }) {
  const flagOn = useFeatureFlag("company-brain");
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["firm-proposal-ledger", profileId],
    enabled: flagOn && Boolean(profileId),
    staleTime: 60_000,
    retry: false,
    queryFn: (): Promise<FirmValueSoFar> => firmValueSoFar({ data: { profile_id: profileId as string } }),
  });
  if (!flagOn || !profileId) return null;
  const lines = data ? ledgerFigureLines(data.figures, "firm") : [];

  return (
    <section aria-label={LEDGER_COPY.firmTitle} data-testid="firm-proposals-card">
      <SectionHeader title={LEDGER_COPY.firmTitle} />
      <p className="mb-3 text-sm text-muted-foreground">{LEDGER_COPY.firmLine}</p>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {LEDGER_COPY.loadFailed}{" "}
          <button type="button" className="underline" onClick={() => void refetch()}>
            {LEDGER_COPY.retry}
          </button>
        </p>
      ) : null}
      {isLoading ? <p className="text-sm text-muted-foreground">{LEDGER_COPY.loading}</p> : null}
      {data && lines.length === 0 ? <p data-ledger-empty className="text-sm text-muted-foreground">{LEDGER_COPY.firmEmpty}</p> : null}
      {data ? <ProposalLedgerFigures lines={lines} rows={data.rows} /> : null}
      <p data-ledger-unshared className="mt-3 text-sm text-muted-foreground">{LEDGER_COPY.firmUnshared}</p>
    </section>
  );
}

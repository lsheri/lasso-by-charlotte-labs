import { Link } from "@tanstack/react-router";

import { ProposalDesk } from "@/components/proposals/ProposalDesk";
import { useProposalDesk } from "@/components/proposals/use-proposal-desk";
import { DESK_COPY } from "@/lib/proposal-desk-shared";
import { HOME_PROPOSALS_COPY, HOME_PROPOSAL_ROWS, homeShowsProposals } from "@/lib/role-screens-shared";

type HomeProfile = { id?: string | null; role?: string | null; has_firm_view?: boolean | null; org_type?: string | null; is_guest?: boolean | null };

/**
 * 19 Nov 2026 (Liam): the proposals picture at the top of an admin's Home: how many are open, won and lost, and the
 * open ones closest to their goal first. It is the Proposals page's own dashboard and its own read, shown read only;
 * every change is made on the Proposals page. Nobody but an admin of a company workspace gets it, and for them the
 * server decides the rows. No fee or value is on a proposal row.
 */
export function HomeProposals({ profile }: { profile: HomeProfile | null | undefined }) {
  const show = homeShowsProposals(profile);
  const desk = useProposalDesk(show ? (profile?.id ?? undefined) : undefined);
  if (!show) return null;

  return (
    <section data-testid="home-proposals" aria-labelledby="home-proposals-title" className="mx-4 mt-4 rounded-[var(--radius)] border border-border bg-card p-4 shadow-card md:mx-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="home-proposals-title" className="text-(length:--type-title) font-medium text-foreground">
          {HOME_PROPOSALS_COPY.title}
        </h2>
        <Link to="/proposals" className="text-sm text-muted-foreground underline hover:text-foreground">
          {HOME_PROPOSALS_COPY.open}
        </Link>
      </div>
      {desk.error ? (
        <p role="alert" className="text-sm text-destructive">
          {DESK_COPY.loadFailed}{" "}
          <button type="button" className="underline" onClick={() => void desk.refetch()}>
            {DESK_COPY.retry}
          </button>
        </p>
      ) : null}
      {desk.isLoading ? <p className="text-sm text-muted-foreground">{DESK_COPY.loading}</p> : null}
      {desk.data ? <ProposalDesk data={desk.data} limit={HOME_PROPOSAL_ROWS} /> : null}
    </section>
  );
}

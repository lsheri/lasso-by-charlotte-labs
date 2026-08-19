import { Link } from "@tanstack/react-router";

import { ChecksLibrary } from "@/components/firm/ChecksLibrary";
import { CountList, CountRow, Panel, StatBlock } from "@/components/firm/FirmPanels";
import { PrivacyPanel } from "@/components/firm/PrivacyPanel";
import { PageHeader } from "@/components/layout/PageHeader";
import { useFirmDashboard } from "@/hooks/use-firm-dashboard";
import { isBusinessOrg, useProfile } from "@/hooks/use-profile";
import { ASSURANCE_SUPPRESSED_SENTENCE, relativeDayPhrase } from "@/lib/firm-dashboard-shared";

export function FirmDashboardPage() {
  const { data: profile } = useProfile();
  const canSee =
    isBusinessOrg(profile) && (profile?.role === "admin" || profile?.role === "lead");
  const { data, isLoading, error } = useFirmDashboard(canSee ? profile?.id : undefined);

  if (profile && !canSee) {
    return (
      <div>
        <PageHeader title="Firm view" subtitle="This view is for firm workspaces." />
        <p className="text-sm text-muted-foreground">
          Your workspace does not have a firm view.
        </p>
      </div>
    );
  }

  return (
    <div className="pb-16">
      <PageHeader
        title="Firm view"
        subtitle="How the workspace is being used, in counts and structure only."
      />

      <div className="space-y-5">
        <PrivacyPanel />

        {error ? (
          <p className="text-sm text-destructive">That could not be loaded. Try again.</p>
        ) : null}
        {isLoading || !data ? (
          <p className="text-sm text-muted-foreground">Counting.</p>
        ) : (
          <>
            <Panel
              title="Adoption"
              note={`People and sources across the workspace. Window: last ${data.window_days} days.`}
            >
              <StatBlock label="Active in the last week" stat={data.adoption.weekly_active} />
              <div>
                <p className="micro-label">Seats</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {data.adoption.seats === null
                    ? `${data.adoption.seats_used} people in the workspace. No seat count on file.`
                    : `${data.adoption.seats_used} of ${data.adoption.seats} seats in use. Coaches never use a seat.`}
                </p>
              </div>
              <div>
                <p className="micro-label">Capture coverage</p>
                {data.adoption.capture_coverage.numerator === null ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {data.adoption.capture_coverage.sentence}
                  </p>
                ) : (
                  <>
                    <p className="mt-1 text-3xl font-semibold tabular-nums text-foreground">
                      {data.adoption.capture_coverage.numerator}
                      <span className="text-lg text-muted-foreground">
                        {" of "}
                        {data.adoption.capture_coverage.denominator}
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {data.adoption.capture_coverage.sentence}
                    </p>
                  </>
                )}
              </div>
              <StatBlock
                label="Time to first capture"
                stat={data.adoption.time_to_first_capture}
              />
            </Panel>

            <Panel title="Activity" note={`Counts from the last ${data.window_days} days.`}>
              <StatBlock label="Work captured" stat={data.activity.work_items_captured} />
              <div>
                <p className="micro-label">Deliverables by state</p>
                {data.activity.deliverables_total === 0 ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    No deliverables in the workspace yet.
                  </p>
                ) : (
                  <div className="mt-1">
                    {data.activity.deliverables.map((row) => (
                      <CountRow key={row.status} label={row.label} count={row.count} />
                    ))}
                  </div>
                )}
              </div>
              <StatBlock label="Delivered to accepted" stat={data.activity.cycle_time} />
              <div>
                <p className="micro-label">Analyses run</p>
                <div className="mt-1">
                  <CountList
                    rows={data.activity.analyses_by_preset}
                    empty="No analyses run this period."
                  />
                </div>
              </div>
              <StatBlock label="Questions asked" stat={data.activity.questions_asked} />
            </Panel>

            <Panel
              title="Assurance"
              note="How often the firm asked Lasso to check finished work. Counts only, never results and never a rate."
            >
              {data.assurance.enough ? (
                <div>
                  <CountRow
                    label="Verification analyses run"
                    count={data.assurance.verification_runs}
                  />
                  <CountRow label="Firm checks analyses run" count={data.assurance.firm_check_runs} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{ASSURANCE_SUPPRESSED_SENTENCE}</p>
              )}
            </Panel>

            <Panel title="Coaching" note="The shape of coaching in this workspace.">
              {data.coaching.coaches_active === 0 ? (
                <p className="text-sm text-muted-foreground">No coaches in the workspace yet.</p>
              ) : (
                <div>
                  <CountRow label="Coaches active" count={data.coaching.coaches_active} />
                  <CountRow
                    label="Engagements shared with a coach"
                    count={data.coaching.engagements_shared}
                  />
                  <CountRow label="1:1 preps created" count={data.coaching.one_on_one_preps} />
                </div>
              )}
            </Panel>

            <Panel title="Data health" note="Where work is arriving from, and what is failing.">
              <div>
                <p className="micro-label">Connected sources</p>
                <div className="mt-1">
                  <CountList
                    rows={data.data_health.connectors_by_vendor}
                    empty="No sources connected yet."
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {relativeDayPhrase(data.data_health.last_capture_days_ago)}
              </p>
              <div>
                <p className="micro-label">Failures this period</p>
                <div className="mt-1">
                  <CountList
                    rows={[
                      ...data.data_health.errors_by_kind,
                      ...(data.data_health.connector_errors > 0
                        ? [
                            {
                              label: "connector error",
                              count: data.data_health.connector_errors,
                            },
                          ]
                        : []),
                    ]}
                    empty="Nothing has failed this period."
                  />
                </div>
              </div>
            </Panel>

            <ChecksLibrary profileId={profile?.id} runCount={data.assurance.firm_check_runs} />
          </>
        )}

        <p className="text-sm text-muted-foreground">
          Looking for the roster, invites, or the plan?{" "}
          <Link to="/members" className="text-accent-deep underline underline-offset-2">
            Members
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

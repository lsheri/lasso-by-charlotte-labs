/**
 * R9: the board's Details control opens this glance at the engagement instead
 * of navigating away. Read only — names, the first lines of the brief, and
 * nothing to edit. Everything rendered here comes from the engagement page
 * payload the board already holds, so the popover adds no reads and shows a
 * viewer only what their own access already returns.
 */

import { Link } from "@tanstack/react-router";

import { clientDisplayName, engagementDisplayCode, engagementDisplayTitle } from "@/lib/clients";
import { DETAILS_SEARCH } from "@/lib/engagement-default-view";
import type {
  EngagementCoach,
  EngagementMemberName,
  EngagementRow,
} from "@/lib/engagement-page-shared";

/** Past a glance's worth of brief, the details page is where the rest lives. */
const BRIEF_GLANCE_LENGTH = 220;

export function BoardDetailsContent({
  engagement,
  coaches,
  members,
  engagementId,
}: {
  engagement: EngagementRow | null;
  coaches: EngagementCoach[];
  members: EngagementMemberName[];
  engagementId: string;
}) {
  if (!engagement) {
    return <p className="nb-type-small text-muted">Nothing to show yet.</p>;
  }
  const client = clientDisplayName(engagement);
  const title = engagementDisplayTitle(engagement);
  const code = engagementDisplayCode(engagement);
  const quiet = [engagement.term_label, code].filter(Boolean).join(" · ");
  const brief = engagement.brief?.trim() ?? "";
  const briefTruncated = brief.length > BRIEF_GLANCE_LENGTH;
  // Names only. Who added them and when is provenance about people, and it
  // does not belong on a glance surface.
  const people = [
    ...coaches.map((coach) => coach.display_name),
    ...members.map((member) => member.display_name),
  ];

  return (
    <div className="flex flex-col gap-3">
      <div>
        {client ? (
          <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-soft">{client}</p>
        ) : null}
        <p className="text-[13px] font-medium text-foreground">{title}</p>
        {quiet ? <p className="nb-type-small text-muted">{quiet}</p> : null}
      </div>
      {brief ? (
        <div className="flex flex-col items-start gap-1">
          <p className="nb-type-small line-clamp-4 text-foreground">{brief}</p>
          {briefTruncated ? (
            <Link
              to="/engagements/$id"
              params={{ id: engagementId }}
              search={{ ...DETAILS_SEARCH }}
              className="nb-type-small text-foreground underline underline-offset-2"
            >
              Read the full brief
            </Link>
          ) : null}
        </div>
      ) : null}
      {people.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-soft">
            Who has access
          </p>
          <ul className="flex flex-col gap-0.5">
            {people.map((name) => (
              <li key={name} className="nb-type-small text-foreground">
                {name}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/**
 * R9: the board's Details control opens this glance at the engagement instead
 * of navigating away. Read only — names, the first lines of the brief, and
 * nothing to edit. Everything rendered here comes from the engagement page
 * payload the board already holds, so the popover adds no reads and shows a
 * viewer only what their own access already returns.
 */

import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HANDOFF_VENDORS, readHandoffDestination, writeHandoffDestination, type HandoffDestination } from "@/lib/ask-handoff";

function safeStore(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

import { useSettingsDialogOptional } from "@/lib/settings-dialog-context";
import { clientDisplayName, engagementDisplayCode, engagementDisplayTitle } from "@/lib/clients";
import { DETAILS_SEARCH } from "@/lib/engagement-default-view";
import type {
  EngagementCoach,
  EngagementMemberName,
  EngagementRow,
} from "@/lib/engagement-page-shared";

/* The clamp below is the only truncation boundary; whenever a brief exists the
   details page link is offered, so nothing can be cut with no way to read on. */


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
  const settings = useSettingsDialogOptional();
  const [dest, setDest] = useState<HandoffDestination>(() => readHandoffDestination(engagementId, null));
  const [projectLink, setProjectLink] = useState("");
  const [linkDropped, setLinkDropped] = useState(false);
  useEffect(() => {
    const saved = readHandoffDestination(engagementId, safeStore());
    setDest(saved);
    setProjectLink(saved.url ?? "");
    setLinkDropped(false);
  }, [engagementId]);
  const changeDestination = (next: HandoffDestination, link: string) => {
    writeHandoffDestination(engagementId, next, safeStore());
    const saved = readHandoffDestination(engagementId, safeStore());
    setDest(saved);
    setProjectLink(link);
    setLinkDropped(Boolean(link) && !saved.url);
  };
  if (!engagement) {
    return <p className="nb-type-small text-muted">Nothing to show yet.</p>;
  }
  const client = clientDisplayName(engagement);
  const title = engagementDisplayTitle(engagement);
  const code = engagementDisplayCode(engagement);
  const quiet = [engagement.term_label, code].filter(Boolean).join(" · ");
  const brief = engagement.brief?.trim() ?? "";

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
          <Link
            to="/engagements/$id"
            params={{ id: engagementId }}
            search={{ ...DETAILS_SEARCH }}
            className="nb-type-small text-foreground underline underline-offset-2"
          >
            Read the full brief
          </Link>

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
      {settings ? (
        <button type="button" className="nb-type-small text-muted underline-offset-2 hover:underline" onClick={() => settings.openSettings("your-work", "deep_link")}>Where Ask Lasso opens</button>
      ) : null}
      <fieldset className="flex min-w-0 flex-col gap-2 nb-type-small text-muted">
        <legend>Continue conversations in</legend>
        <div className="flex gap-3">
          {HANDOFF_VENDORS.map((vendor) => (
            <label key={vendor.id} className="flex items-center gap-1">
              <input type="radio" name={`ask-handoff-${engagementId}`} value={vendor.id} checked={dest.vendor === vendor.id} onChange={() => changeDestination({ vendor: vendor.id, ...(projectLink ? { url: projectLink } : {}) }, projectLink)} />
              {vendor.label}
            </label>
          ))}
        </div>
        <input type="text" aria-label="Project link" placeholder="Project link (optional)" className="min-w-0 rounded border border-border bg-background px-2 py-1 text-foreground" value={projectLink} onChange={(event) => changeDestination({ vendor: dest.vendor, url: event.target.value }, event.target.value)} />
        {linkDropped ? <p>That link is not a {HANDOFF_VENDORS.find((vendor) => vendor.id === dest.vendor)?.label} link.</p> : null}
      </fieldset>
    </div>
  );
}

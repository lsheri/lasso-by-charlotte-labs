import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { NewEngagementDialog } from "@/components/engagements/NewEngagementDialog";
import { GraphiteIcon } from "@/components/notebook/icons";
import { useDecisions } from "@/hooks/use-decisions";
import { useEngagements } from "@/hooks/use-engagements";
import { useProfile } from "@/hooks/use-profile";
import * as roles from "@/lib/role-access";
import { isEduOrg } from "@/lib/edu-vocab";

import {
  groupEngagementsByClient,
  isSyntheticShelf,
  UNMAPPED_SHELF_ID,
  readCollapsedClients,
  writeCollapsedClients,
  type NavEngagement,
} from "@/lib/nav-groups";

import { coachNavGroups, eduNavGroups, navGroups } from "./nav-config";
import { engagementDisplayCode, engagementDisplayTitle } from "@/lib/clients";

const linkClass = "nb-nav-item";
const activeProps = { className: "nb-nav-item-active" };

/** One engagement row, at top level or nested under a client shelf. */
function EngagementRow({
  engagement,
  nested,
  hideCode,
  onNavigate,
}: {
  engagement: NavEngagement;
  nested?: boolean;
  /** Inside the Unmapped shelf the shelf already says it; the code adds nothing. */
  hideCode?: boolean;
  onNavigate?: (() => void) | undefined;
}) {
  const code = hideCode ? null : (engagementDisplayCode(engagement) ?? "Folder");
  return (
    <Link
      to="/engagements/$id"
      params={{ id: engagement.id }}
      onClick={onNavigate}
      className={nested ? `${linkClass} nb-nav-item-nested` : linkClass}
      activeProps={activeProps}
    >
      <GraphiteIcon name={nested ? "chevron-right" : "engagement"} size={nested ? 14 : 16} />
      <span className="flex min-w-0 items-center gap-1.5">
        {code ? <span className="font-mono text-xs text-muted-foreground">{code}</span> : null}
        <span className="truncate">{engagementDisplayTitle(engagement)}</span>
      </span>
    </Link>
  );
}

export function SidebarNav({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  const { data: profile } = useProfile();
  const { data: engagements } = useEngagements(profile?.id);
  const { data: decisions } = useDecisions();
  const decisionCount = (decisions ?? []).length;
  // Reflect is the owner's private space, it never appears for a coach profile.
  const isCoach = roles.isCoach(profile);
  const canManageMembers = roles.canManageMembers(profile);
  const canSeeFirmView = roles.canSeeFirmView(profile);
  const groupsForOrg = isEduOrg(profile) ? eduNavGroups : navGroups;
  const membersLabel = roles.membersLabel(profile);

  // Engagements sit under their client, with quick folders and clientless
  // engagements flat at top level. Grouping reads only the joined relation.
  const { groups, flat } = groupEngagementsByClient(
    (engagements ?? []) as unknown as NavEngagement[],
  );
  const [collapsedClients, setCollapsedClients] = useState<string[]>(() => readCollapsedClients());
  function toggleClient(clientId: string) {
    setCollapsedClients((prev) => {
      const next = prev.includes(clientId)
        ? prev.filter((id) => id !== clientId)
        : [...prev, clientId];
      writeCollapsedClients(next);
      return next;
    });
  }

  // A coach gets their own short nav. Worker and admin items are unchanged.
  if (isCoach) {
    return (
      <nav className="flex flex-col gap-7">
        {coachNavGroups.map((group) => (
          <div key={group.label}>
            <div className="nb-group-header px-2">{group.label}</div>
            <div className="mt-2 flex flex-col gap-0.5">
              {group.items.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  className={linkClass}
                  activeProps={activeProps}
                >
                  <GraphiteIcon name={item.icon} size={16} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col gap-7">
      {groupsForOrg.map((group) => {
        const isEngagementGroup = group.id === "engagements";

        const visibleItems = group.items
          .filter((item) => !(isCoach && item.to === "/reflect"))
          .filter((item) => !(item.to === "/members" && !canManageMembers))
          .filter((item) => !(item.to === "/firm" && !canSeeFirmView))
          .map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={linkClass}
              activeProps={activeProps}
            >
              <GraphiteIcon name={item.icon} size={16} />
              <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                <span className="truncate">
                  {item.to === "/members" ? membersLabel : item.label}
                </span>
                {item.to === "/decisions" && decisionCount > 0 ? (
                  <span className="count-pill">{decisionCount}</span>
                ) : null}
              </span>
            </Link>
          ));

        // Groups with no visible items are silent, except Engagements which
        // always carries its shelf list and the new-engagement action.
        if (!isEngagementGroup && visibleItems.length === 0) {
          return null;
        }

        return (
          <div key={group.label}>
            <div className="nb-group-header px-2">{group.label}</div>
            <div className="mt-2 flex flex-col gap-0.5">
              {visibleItems}

              {isEngagementGroup ? (
                <>
                  {flat.map((engagement) => (
                    <EngagementRow
                      key={engagement.id}
                      engagement={engagement}
                      onNavigate={onNavigate}
                    />
                  ))}
                  {groups.map((shelf) => {
                    const collapsed = collapsedClients.includes(shelf.clientId);
                    return (
                      <div key={shelf.clientId}>
                        <button
                          type="button"
                          aria-expanded={!collapsed}
                          onClick={() => toggleClient(shelf.clientId)}
                          className={`${linkClass} nb-nav-shelf w-full text-left`}
                        >
                          <GraphiteIcon name="engagement" size={16} />
                          <span className="flex min-w-0 flex-1 items-center gap-1.5">
                            <span className="truncate">{shelf.name}</span>
                            {isSyntheticShelf(shelf.clientId) ? (
                              <span className="font-mono text-[10px] text-muted-foreground">
                                · {shelf.engagements.length}
                              </span>
                            ) : null}
                          </span>
                          <GraphiteIcon
                            name="chevron-right"
                            size={13}
                            className={collapsed ? "" : "rotate-90"}
                          />
                        </button>

                        {collapsed
                          ? null
                          : shelf.engagements.map((engagement) => (
                              <EngagementRow
                                key={engagement.id}
                                engagement={engagement}
                                nested
                                hideCode={shelf.clientId === UNMAPPED_SHELF_ID}
                                onNavigate={onNavigate}
                              />
                            ))}
                      </div>
                    );
                  })}
                  {engagements && engagements.length === 0 ? (
                    <p className="px-2 py-1.5 text-sm text-muted-foreground">No engagements yet</p>
                  ) : null}
                  <NewEngagementDialog
                    onDone={onNavigate}
                    trigger={
                      <button type="button" className="nb-nav-item w-full text-left">
                        <GraphiteIcon name="plus" size={16} />
                        <span>New engagement</span>
                      </button>
                    }
                  />
                </>
              ) : null}

              {group.emptyState && !isEngagementGroup ? (
                <p className="px-2 py-1.5 text-sm text-muted-foreground">{group.emptyState}</p>
              ) : null}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

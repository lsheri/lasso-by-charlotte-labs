import { Link } from "@tanstack/react-router";

import { NewEngagementDialog } from "@/components/engagements/NewEngagementDialog";
import { useDecisions } from "@/hooks/use-decisions";
import { useEngagements } from "@/hooks/use-engagements";
import { isBusinessOrg, useProfile } from "@/hooks/use-profile";

import { coachNavGroups, navGroups } from "./nav-config";
import { engagementDisplayCode, engagementDisplayTitle } from "@/lib/clients";

const linkClass =
  "rounded-md px-3 py-1.5 text-sm text-foreground/80 transition-colors hover:bg-accent-soft hover:text-accent-deep";

export function SidebarNav({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  const { data: profile } = useProfile();
  const { data: engagements } = useEngagements(profile?.id);
  const { data: decisions } = useDecisions();
  const decisionCount = (decisions ?? []).length;
  // Reflect is the owner's private space, it never appears for a coach profile.
  const isCoach = profile?.role === "coach";
  const canManageMembers = profile?.role === "admin" || profile?.role === "lead";
  // The firm view aggregates a roster. A solo workspace has none, so the link
  // is absent as well as the route being refused server side.
  const canSeeFirmView = canManageMembers && isBusinessOrg(profile);
  // A solo workspace has no roster to administer, only the coaches it invited.
  const membersLabel = isBusinessOrg(profile) ? "Members" : "Your coaches";

  // A coach gets their own short nav. Worker and admin items are unchanged.
  if (isCoach) {
    return (
      <nav className="flex flex-col gap-7">
        {coachNavGroups.map((group) => (
          <div key={group.label}>
            <div className="micro-label px-3">{group.label}</div>
            <div className="mt-2 flex flex-col gap-0.5">
              {group.items.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  className={linkClass}
                  activeProps={{ className: "bg-accent-soft text-accent-deep font-medium" }}
                >
                  {item.label}
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
      {navGroups.map((group) => (
        <div key={group.label}>
          <div className="micro-label px-3">{group.label}</div>
          <div className="mt-2 flex flex-col gap-0.5">
            {group.items
              .filter((item) => !(isCoach && item.to === "/reflect"))
              .filter((item) => !(item.to === "/members" && !canManageMembers))
              .filter((item) => !(item.to === "/firm" && !canSeeFirmView))
              .map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  className={linkClass}
                  activeProps={{ className: "bg-accent-soft text-accent-deep font-medium" }}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span>{item.to === "/members" ? membersLabel : item.label}</span>
                    {item.to === "/decisions" && decisionCount > 0 ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {decisionCount}
                      </span>
                    ) : null}
                  </span>
                </Link>
              ))}

            {group.label === "Engagements" ? (
              <>
                {(engagements ?? []).map((engagement) => (
                  <Link
                    key={engagement.id}
                    to="/engagements/$id"
                    params={{ id: engagement.id }}
                    onClick={onNavigate}
                    className={linkClass}
                    activeProps={{ className: "bg-accent-soft text-accent-deep font-medium" }}
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      {engagementDisplayCode(engagement) ?? "Folder"}
                    </span>{" "}
                    <span className="truncate">{engagementDisplayTitle(engagement)}</span>
                  </Link>
                ))}
                {engagements && engagements.length === 0 ? (
                  <p className="px-3 py-1.5 text-sm text-muted-foreground">No engagements yet</p>
                ) : null}
                <NewEngagementDialog
                  onDone={onNavigate}
                  trigger={
                    <button
                      type="button"
                      className="rounded-md px-3 py-1.5 text-left text-sm text-accent-deep transition-colors hover:bg-accent-soft"
                    >
                      + New engagement
                    </button>
                  }
                />
              </>
            ) : null}

            {group.emptyState && group.label !== "Engagements" ? (
              <p className="px-3 py-1.5 text-sm text-muted-foreground">{group.emptyState}</p>
            ) : null}
          </div>
        </div>
      ))}
    </nav>
  );
}

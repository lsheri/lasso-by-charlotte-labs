import { Link } from "@tanstack/react-router";

import { NewEngagementDialog } from "@/components/engagements/NewEngagementDialog";
import { useDecisions } from "@/hooks/use-decisions";
import { useEngagements } from "@/hooks/use-engagements";
import { useProfile } from "@/hooks/use-profile";

import { navGroups } from "./nav-config";

const linkClass =
  "rounded-md px-3 py-1.5 text-sm text-foreground/80 transition-colors hover:bg-accent-soft hover:text-accent-deep";

export function SidebarNav({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  const { data: profile } = useProfile();
  const { data: engagements } = useEngagements(profile?.id);
  const { data: decisions } = useDecisions();
  const decisionCount = (decisions ?? []).length;
  // Reflect is the owner's private space — it never appears for a coach profile.
  const isCoach = profile?.role === "coach";

  return (
    <nav className="flex flex-col gap-7">
      {profile?.role === "coach" ? (
        <div>
          <div className="micro-label px-3">Coaching</div>
          <div className="mt-2 flex flex-col gap-0.5">
            <Link
              to="/coaching"
              onClick={onNavigate}
              className={linkClass}
              activeProps={{ className: "bg-accent-soft text-accent-deep font-medium" }}
            >
              People you coach
            </Link>
          </div>
        </div>
      ) : null}
      {navGroups.map((group) => (
        <div key={group.label}>
          <div className="micro-label px-3">{group.label}</div>
          <div className="mt-2 flex flex-col gap-0.5">
            {group.items
              .filter((item) => !(isCoach && item.to === "/reflect"))
              .map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                className={linkClass}
                activeProps={{ className: "bg-accent-soft text-accent-deep font-medium" }}
              >
                <span className="flex items-center justify-between gap-2">
                  <span>{item.label}</span>
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
                      {engagement.code}
                    </span>{" "}
                    <span className="truncate">{engagement.title}</span>
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

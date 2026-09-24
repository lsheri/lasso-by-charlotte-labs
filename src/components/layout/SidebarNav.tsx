import { useQueryClient } from "@tanstack/react-query";
import { Link, useMatchRoute, useSearch } from "@tanstack/react-router";
import { Fragment, useState, useSyncExternalStore } from "react";

import { NewEngagementDialog } from "@/components/engagements/NewEngagementDialog";
import { GraphiteIcon } from "@/components/notebook/icons";
import { CircleMark } from "@/components/notebook/CircleMark";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAffiliation } from "@/hooks/use-affiliation";
import { useUnreadNotesAboutMe } from "@/hooks/use-coach-note-thread";
import { useHasLiveCoachLink } from "@/hooks/use-coaching-links";
import { useCoachingReach } from "@/hooks/use-coaching-reach";
import { useSharedWithMe } from "@/hooks/use-shared-with-me";

import { useDecisions } from "@/hooks/use-decisions";
import { useEngagements } from "@/hooks/use-engagements";
import { useProfile } from "@/hooks/use-profile";
import * as roles from "@/lib/role-access";
import { isEduOrg, vocabFor } from "@/lib/edu-vocab";
import { bucket, logEvent } from "@/lib/telemetry";


import {
  groupEngagementsByClient,
  isSyntheticShelf,
  UNMAPPED_SHELF_ID,
  readCollapsedClients,
  writeCollapsedClients,
  type NavEngagement,
} from "@/lib/nav-groups";

import { coachNavGroups, coachingGroup, eduNavGroups, navGroups } from "./nav-config";
import { engagementDisplayCode, engagementDisplayTitle } from "@/lib/clients";

const linkClass = "nb-nav-item";
const activeProps = { className: "nb-nav-item-active" };

type CachedNavTask = { id: string; name: string; is_wrap?: boolean };
const EMPTY_NAV_TASKS: CachedNavTask[] = [];

/** The indent mark on a nested engagement row. Hand-drawn, not a chevron:
    it marks depth, it is not a control. Decorative, so it is hidden from
    assistive tech and the row's link text carries the meaning. */
function PencilIndent() {
  return (
    <svg
      width="28"
      height="20"
      viewBox="0 0 28 20"
      aria-hidden="true"
      focusable="false"
      className="nb-nav-indent shrink-0"
    >
      <path
        d="M5 0 C 5.5 4.2, 4.4 8.1, 5.3 11.6 C 5.9 14.1, 8.6 13.5, 11.2 13.8 C 15.4 14.2, 19.8 13.6, 24 14.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function useCachedEngagementTasks(engagementId: string | undefined) {
  const queryClient = useQueryClient();
  return useSyncExternalStore(
    (onStoreChange) =>
      queryClient.getQueryCache().subscribe((event) => {
        if (
          engagementId &&
          event.query.queryKey[0] === "engagement-tasks" &&
          event.query.queryKey[1] === engagementId
        ) {
          onStoreChange();
        }
      }),
    () =>
      engagementId
        ? (queryClient.getQueryData<CachedNavTask[]>([
            "engagement-tasks",
            engagementId,
          ]) ?? EMPTY_NAV_TASKS)
        : EMPTY_NAV_TASKS,
    () => EMPTY_NAV_TASKS,
  );
}

/** One engagement row, at top level or nested under a client shelf. */
function EngagementRow({
  engagement,
  nested,
  hideCode,
  onNavigate,
  scope,
}: {
  engagement: NavEngagement;
  nested?: boolean;
  /** Inside the Unmapped shelf the shelf already says it; the code adds nothing. */
  hideCode?: boolean;
  onNavigate?: (() => void) | undefined;
  scope?: { tasks: CachedNavTask[]; workId: string | undefined } | undefined;
}) {
  const code = hideCode ? null : (engagementDisplayCode(engagement) ?? "Folder");
  return (
    <>
      <Link
        to="/engagements/$id"
        params={{ id: engagement.id }}
        search={{ work: undefined }}
        onClick={onNavigate}
        className={nested ? `${linkClass} nb-nav-item-nested` : linkClass}
        activeProps={activeProps}
        activeOptions={{ includeSearch: false }}
      >
        {nested ? <PencilIndent /> : <GraphiteIcon name="engagement" size={20} />}
        <span className="flex min-w-0 items-center gap-1.5">
          {code ? <span className="font-mono text-xs text-muted-foreground">{code}</span> : null}
          <span className="truncate">{engagementDisplayTitle(engagement)}</span>
        </span>
      </Link>
      {scope ? (
        <div>
          <Link
            to="/engagements/$id"
            params={{ id: engagement.id }}
            search={{ work: undefined }}
            onClick={onNavigate}
            className={`${linkClass} nb-nav-item-nested-2 ${scope.workId === undefined ? "nb-nav-item-active" : ""}`}
          >
            <PencilIndent />
            <span className="truncate">Everything in this engagement</span>
          </Link>
          {/* PASS 143 — a wrap-up sits last whatever its position, marked with
              a green dot rather than any extra label. */}
          {[...scope.tasks]
            .sort((a, b) => Number(a.is_wrap === true) - Number(b.is_wrap === true))
            .map((task) => (
              <Link
                key={task.id}
                to="/engagements/$id"
                params={{ id: engagement.id }}
                search={{ work: task.id }}
                onClick={onNavigate}
                className={`${linkClass} nb-nav-item-nested ${scope.workId === task.id ? "nb-nav-item-active" : ""}`}
              >
                <PencilIndent />
                {task.is_wrap === true ? (
                  <span
                    aria-hidden="true"
                    className="h-[5px] w-[5px] shrink-0 rounded-full"
                    style={{ background: "var(--nb-green)" }}
                  />
                ) : null}
                <span className="truncate">{task.name}</span>
              </Link>
            ))}
        </div>
      ) : null}
    </>
  );
}

/**
 * S5a — what someone handed you, under the name of the person who handed it.
 * Silent when nothing was handed over: no section, no empty line. The person's
 * name is a label, not a place to go; the boards under it are the links.
 */
function SharedWithMeGroup({
  profiles,
  orgId,
  onNavigate,
}: {
  profiles: ReturnType<typeof useProfile>["profiles"];
  orgId: string | undefined;
  onNavigate?: (() => void) | undefined;
}) {
  const { groups } = useSharedWithMe(profiles);
  if (groups.length === 0) return null;
  // S5b · the event says how big the section is, never which row was opened.
  const grantersBand = bucket(groups.length);
  const boardsBand = bucket(
    groups.reduce((total, group) => total + group.engagements.length, 0),
  );
  return (
    <div>
      <div className="nb-group-header nb-shared-ink px-2">Shared with me</div>
      <div className="mt-2 flex flex-col gap-0.5">
        {groups.map((group) => (
          <div key={group.granterId}>
            <div className="nb-shared-ink nb-shared-name truncate px-2 py-1">
              {group.granterName}
            </div>
            {group.engagements.map((engagement) => (
              <Link
                key={engagement.id}
                to="/engagements/$id"
                params={{ id: engagement.id }}
                search={{ work: undefined }}
                onClick={() => {
                  if (orgId) {
                    logEvent("shared.board_opened", orgId, {
                      boards_band: boardsBand,
                      granters_band: grantersBand,
                    });
                  }
                  onNavigate?.();
                }}
                className={`${linkClass} nb-nav-item-nested`}
                activeProps={activeProps}
                activeOptions={{ includeSearch: false }}
              >
                <PencilIndent />
                <span className="flex min-w-0 items-center gap-1.5">
                  {engagement.code ? (
                    <span className="font-mono text-xs text-muted-foreground">
                      {engagement.code}
                    </span>
                  ) : null}
                  <span className="truncate">{engagement.title}</span>
                </span>
              </Link>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SidebarNav({
  onNavigate,
  onOpenSettings,
}: {
  onNavigate?: (() => void) | undefined;
  onOpenSettings?: (() => void) | undefined;
}) {
  const { data: profile, profiles } = useProfile();
  // Pass 186: an affiliated workspace gets one extra item at the top of
  // "Your account", named for the institution. Nothing is inserted when
  // there is no affiliation.
  const { data: affiliation } = useAffiliation();
  const institution = affiliation?.institution ?? null;
  const { data: engagements } = useEngagements(profile?.id);
  const { data: decisions } = useDecisions();
  // The pill counts what is WAITING on you, which is the drafts. A confirmed
  // call needs nothing, so counting it would ask for attention that is not due.
  const decisionCount = (decisions ?? []).filter((row) => row.status === "draft").length;
  const guestNav = roles.usesGuestNav(profile);
  const canManageMembers = roles.canManageMembers(profile);
  const canSeeFirmView = roles.canSeeFirmView(profile);
  const groupsForOrg = isEduOrg(profile) ? eduNavGroups : navGroups;
  const vocab = vocabFor(profile);
  // Whether a coaching destination exists at all is decided by what this
  // person was given on a board, never by their workspace role.
  const reach = useCoachingReach(profiles);
  const coachingGroups = reach.canReach ? [coachingGroup] : [];

  const membersLabel = roles.membersLabel(profile);
  // "Your coach" is only a real place when someone is actually coaching you.
  // A firm or school role has that by arrangement; a solo workspace has to
  // have a live link, so only there does the sidebar ask.
  const byArrangement = roles.hasCoachByArrangement(profile);
  const soloHasCoach = useHasLiveCoachLink(
    !guestNav && profile?.org_type === "personal" && Boolean(profile?.id),
  );
  const canBeCoached = byArrangement || soloHasCoach;
  // One query for the circle, shared with every other surface that draws it.
  // A guest never asks: there are no circles on a guest's screen.
  const { data: unreadNotes } = useUnreadNotesAboutMe(guestNav ? undefined : profile?.id);
  const hasNewNotes = (unreadNotes ?? []).length > 0;


  const matchRoute = useMatchRoute();
  const engagementMatch = matchRoute({ to: "/engagements/$id", fuzzy: false });
  const activeEngagementId = engagementMatch ? engagementMatch.id : undefined;
  const search = useSearch({ strict: false });
  const activeWorkId =
    "work" in search && typeof search.work === "string" ? search.work : undefined;
  const cachedTasks = useCachedEngagementTasks(activeEngagementId);
  const scopeFor = (engagementId: string) =>
    engagementId === activeEngagementId && cachedTasks.length > 0
      ? { tasks: cachedTasks, workId: activeWorkId }
      : undefined;

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

  // A guest gets their own short nav. Worker and admin items are unchanged.
  // The coaching destination sits on top of it only when a board was shared.
  if (guestNav) {
    const shared = (
      <SharedWithMeGroup profiles={profiles} orgId={profile?.org_id} onNavigate={onNavigate} />
    );
    return (
      <nav className="flex flex-col gap-7">
        {coachingGroups.length === 0 ? shared : null}
        {[...coachingGroups, ...coachNavGroups].map((group) => (
          <Fragment key={group.label}>
            <div>
              <div className="nb-group-header px-2">{group.label}</div>
              <div className="mt-2 flex flex-col gap-0.5">
                {group.items.map((item) =>
                  item.to === "/settings" ? (
                    <button
                      key={item.to}
                      type="button"
                      onClick={() => {
                        onOpenSettings?.();
                        onNavigate?.();
                      }}
                      className={`${linkClass} w-full text-left`}
                    >
                      <GraphiteIcon name={item.icon} size={20} />
                      <span>{item.label}</span>
                    </button>
                  ) : (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={onNavigate}
                      className={linkClass}
                      activeProps={activeProps}
                    >
                      <GraphiteIcon name={item.icon} size={20} />
                      <span>{item.label}</span>
                    </Link>
                  ),
                )}
              </div>
            </div>
            {group.id === "coaching" ? shared : null}
          </Fragment>
        ))}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col gap-7">
      {[...groupsForOrg, ...coachingGroups].map((group) => {
        const isEngagementGroup = group.id === "engagements";

        const itemsForGroup =
          group.id === "account" && institution
            ? [
                {
                  label: `What ${institution.name} sees`,
                  to: "/affiliation",
                  icon: "messages" as const,
                },
                ...group.items,
              ]
            : group.items;

        const visibleItems = itemsForGroup
          .filter((item) => !(item.to === "/members" && !canManageMembers))
          .filter((item) => !(item.to === "/firm" && !canSeeFirmView))
          .map((item) =>
            item.disabled ? (
              <TooltipProvider key={`${item.to}:${item.label}`} delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-disabled="true"
                      className={`${linkClass} nb-nav-item-disabled w-full text-left`}
                    >
                      <GraphiteIcon name={item.icon} size={20} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.disabledReason ?? "Coming soon"}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : item.to === "/settings" ? (
              <button
                key={item.to}
                type="button"
                onClick={() => {
                  onOpenSettings?.();
                  onNavigate?.();
                }}
                className={`${linkClass} w-full text-left`}
              >
                <GraphiteIcon name={item.icon} size={20} />
                <span className="truncate">{item.label}</span>
              </button>
            ) : item.to === "/coach-notes" && hasNewNotes ? (
              // The circle, not a count: it says look here, and nothing more.
              <CircleMark key={item.to} className="block" label="New note from your coach">
                <Link
                  to={item.to}
                  onClick={onNavigate}
                  className={linkClass}
                  activeProps={activeProps}
                >
                  <GraphiteIcon name={item.icon} size={20} />
                  <span className="truncate">{item.label}</span>
                </Link>
              </CircleMark>
            ) : (
              <Link
                 key={`${item.to}:${item.label}`}
                to={item.to}
                 {...(item.search ? { search: item.search } : {})}
                onClick={onNavigate}
                className={item.nested ? `${linkClass} nb-nav-item-nested` : linkClass}
                activeProps={activeProps}
              >
                {item.nested ? <PencilIndent /> : null}
                <GraphiteIcon name={item.icon} size={20} />
                <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                  <span className="truncate">
                    {item.to === "/members" ? membersLabel : item.label}
                  </span>
                  {item.to === "/decisions" && decisionCount > 0 ? (
                    <span className="count-pill">{decisionCount}</span>
                  ) : null}
                </span>
              </Link>
            ),

          );

        // Groups with no visible items are silent, except Engagements which
        // always carries its shelf list and the new-engagement action.
        if (!isEngagementGroup && visibleItems.length === 0) {
          return null;
        }
        if (group.id === "coach" && !canBeCoached) return null;

        return (
          <Fragment key={group.label}>
          <div>
            <div className="nb-group-header px-2">{group.label}</div>
            <div className="mt-2 flex flex-col gap-0.5">
              {/* Past work belongs under the shelves, after everything that is
                  still running, so it renders below rather than above them. */}
              {isEngagementGroup ? null : visibleItems}


              {isEngagementGroup ? (
                <>
                  {flat.map((engagement) => (
                    <EngagementRow
                      key={engagement.id}
                      engagement={engagement}
                      onNavigate={onNavigate}
                      scope={scopeFor(engagement.id)}
                    />
                  ))}
                  {groups.map((shelf) => {
                    const collapsed = collapsedClients.includes(shelf.clientId);
                    // A synthetic shelf is a grouping, not a client, so it has
                    // nowhere to go: it stays a plain toggle.
                    const synthetic = isSyntheticShelf(shelf.clientId);
                    return (
                      <div key={shelf.clientId}>
                        {synthetic ? (
                          <button
                            type="button"
                            aria-expanded={!collapsed}
                            onClick={() => toggleClient(shelf.clientId)}
                            className={`${linkClass} nb-nav-shelf w-full text-left`}
                          >
                            <GraphiteIcon name="engagement" size={20} />
                            <span className="flex min-w-0 flex-1 items-center gap-1.5">
                              <span className="truncate">{shelf.clientId === UNMAPPED_SHELF_ID ? `No ${vocab.client.toLowerCase()}` : shelf.name}</span>
                              <span className="font-mono text-[10px] text-muted-foreground">
                                · {shelf.engagements.length}
                              </span>
                            </span>
                            <GraphiteIcon
                              name="chevron-right"
                              size={13}
                              className={collapsed ? "" : "rotate-90"}
                            />
                          </button>
                        ) : (
                          <div
                            className={`${linkClass} nb-nav-shelf group/shelf w-full text-left`}
                          >
                            <GraphiteIcon name="engagement" size={20} />
                            <Link
                              to="/clients/$id"
                              params={{ id: shelf.clientId }}
                              onClick={onNavigate}
                              className="flex min-w-0 flex-1 items-center gap-1.5"
                            >
                              <span className="truncate">{shelf.name}</span>
                            </Link>
                            <NewEngagementDialog
                              onDone={onNavigate}
                              initialClientId={shelf.clientId}
                              from="sidebar_client"
                              trigger={
                                <button
                                  type="button"
                                  aria-label={`${vocab.newEngagement} in ${shelf.name}`}
                                  className="shrink-0 opacity-0 transition-opacity focus-visible:opacity-100 group-hover/shelf:opacity-100 group-focus-within/shelf:opacity-100"
                                >
                                  <GraphiteIcon name="plus" size={14} />
                                </button>
                              }
                            />
                            <button
                              type="button"
                              aria-expanded={!collapsed}
                              aria-label={collapsed ? "Expand" : "Collapse"}
                              onClick={() => toggleClient(shelf.clientId)}
                              className="shrink-0"
                            >
                              <GraphiteIcon
                                name="chevron-right"
                                size={13}
                                className={collapsed ? "" : "rotate-90"}
                              />
                            </button>
                          </div>
                        )}

                        {collapsed
                          ? null
                          : shelf.engagements.map((engagement) => (
                              <EngagementRow
                                key={engagement.id}
                                engagement={engagement}
                                nested
                                hideCode={shelf.clientId === UNMAPPED_SHELF_ID}
                                onNavigate={onNavigate}
                                scope={scopeFor(engagement.id)}
                              />
                            ))}
                      </div>
                    );
                  })}
                  {engagements && engagements.length === 0 ? (
                    <p className="px-2 py-1.5 text-sm text-muted-foreground">
                      {vocab.noEngagements}
                    </p>
                  ) : null}
                  <NewEngagementDialog
                    onDone={onNavigate}
                    trigger={
                      <button type="button" className="nb-nav-item w-full text-left">
                        <GraphiteIcon name="plus" size={20} />
                        <span>{vocab.newEngagement}</span>
                      </button>
                    }
                  />

                  {visibleItems}
                </>
              ) : null}


              {group.emptyState && !isEngagementGroup ? (
                <p className="px-2 py-1.5 text-sm text-muted-foreground">{group.emptyState}</p>
              ) : null}
            </div>
          </div>
          {isEngagementGroup ? (
            <SharedWithMeGroup
              profiles={profiles}
              orgId={profile?.org_id}
              onNavigate={onNavigate}
            />
          ) : null}
          </Fragment>
        );
      })}
    </nav>
  );
}

import { clientsEnabled } from "@/lib/workspace-settings";
import { useQueryClient } from "@tanstack/react-query";
import { BoardNewPill } from "@/components/board/BoardNewPill";
import { Link, useMatchRoute, useSearch } from "@tanstack/react-router";
import { Fragment, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";

import { NewEngagementDialog } from "@/components/engagements/NewEngagementDialog";
import { SidebarCreateActions, type CreatingKind } from "@/components/engagements/SidebarCreateActions";
import { canCreateClient } from "@/components/engagements/create-permissions";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { GraphiteIcon } from "@/components/notebook/icons";
import { SidebarItemMenu } from "@/components/layout/SidebarItemMenu";
import { SidebarDragProvider, useSidebarDrag } from "@/components/layout/sidebar-drag";
import { applyContainerMoves, applyWorkboardMoves, type PendingMoves } from "@/lib/sidebar-drag";
import { NavActiveCatch } from "./NavActiveCatch";
import { boardHueIndex } from "@/lib/board-hue";
import { CircleMark } from "@/components/notebook/CircleMark";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useUnreadNotesAboutMe } from "@/hooks/use-coach-note-thread";
import { FromYourPeopleGroup } from "./FromYourPeople";
import { useSharedWithMe } from "@/hooks/use-shared-with-me";
import { SharedWithYouSection } from "./SharedWithYou";
import { useSharedBoardMarks } from "@/hooks/use-shared-board-marks";

import { useWorkItems } from "@/hooks/use-work-items";
import { groupConversations } from "@/lib/work-types";
import { useEngagements } from "@/hooks/use-engagements";
import { isBusinessOrg, useProfile } from "@/hooks/use-profile";
import * as roles from "@/lib/role-access";
import { bucket, logEvent } from "@/lib/telemetry";


import { useClients } from "@/hooks/use-clients";
import {
  buildContainerTree,
  flattenForSidebar,
  groupEngagementsByClient,
  INTERNAL_SHELF_ID,
  isSyntheticShelf,
  allContainerIds,
  descendantContainerIds,
  mergeContainerRows,
  notInContainerLabel,
  type ContainerNode,
  UNMAPPED_SHELF_ID,
  type NavEngagement,
} from "@/lib/nav-groups";

import { navFor, type NavItemId } from "./nav-config";
import { useNavCtx } from "./use-nav-ctx";
import { BoardFinder } from "./BoardFinder";
import { activeBoardChain, filterBoardTree, treeBoards, useContainerOpenState, TREE_COPY } from "@/lib/sidebar-tree-state";
import type { NavOpenedDims } from "@/lib/telemetry-shared";
import { engagementDisplayTitle } from "@/lib/clients";
import {
  containerColourStyle,
  inheritedColour,
  type ContainerColour,
} from "@/lib/container-colour";

const linkClass = "nb-nav-item";
const activeProps = { className: "nb-nav-item-active" };

type CachedNavTask = { id: string; name: string; is_wrap?: boolean };
const EMPTY_NAV_TASKS: CachedNavTask[] = [];

function subscribeToHash(onStoreChange: () => void) {
  window.addEventListener("hashchange", onStoreChange);
  return () => window.removeEventListener("hashchange", onStoreChange);
}

function useLocationHash() {
  return useSyncExternalStore(
    subscribeToHash,
    () => window.location.hash.slice(1),
    () => "",
  );
}

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

/** Unit 4a: move, rename and delete are offered on the member nav, never to a
 *  guest (coaches use the guest nav). The database decides every write. */
function useCanEditContainers(): boolean {
  const { data: profile } = useProfile();
  return Boolean(profile) && !roles.usesGuestNav(profile);
}

/** One engagement row, at top level or nested under a client shelf. */
function EngagementRow({
  engagement,
  nested,
  treeDepth,
  onNavigate,
  scope,
}: {
  engagement: NavEngagement;
  nested?: boolean;
  treeDepth?: number;
  onNavigate?: (() => void) | undefined;
  scope?: { tasks: CachedNavTask[]; workId: string | undefined } | undefined;
}) {
  const canEdit = useCanEditContainers();
  const sharedBy = useSharedBoardMarks().get(engagement.id);
  const [menuOpen, setMenuOpen] = useState(false);
  const drag = useSidebarDrag();
  const link = (
      <Link
        to="/engagements/$id"
        params={{ id: engagement.id }}
        search={{ work: undefined }}
        onClick={onNavigate}
        aria-label={sharedBy ? `${engagementDisplayTitle(engagement)}, Shared by ${sharedBy}` : undefined}
        className={treeDepth === undefined && nested ? `${linkClass} nb-nav-item-nested` : linkClass}
        data-tree-depth={treeDepth}
        data-board-hue={boardHueIndex(engagement.id)}
        activeProps={activeProps}
        activeOptions={{ includeSearch: false }}
      >
        <NavActiveCatch />
        {nested ? <PencilIndent /> : <GraphiteIcon name="workboard" size={20} />}
        {nested ? <GraphiteIcon name="workboard" size={20} /> : null}
        {sharedBy ? (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="nb-shared-ink inline-flex shrink-0" aria-hidden="true">
                  <GraphiteIcon name="members" size={16} animate={false} />
                </span>
              </TooltipTrigger>
              <TooltipContent side="right">Shared by {sharedBy}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
        <span className="truncate">{engagementDisplayTitle(engagement)}</span>
        <BoardNewPill engagementId={engagement.id} />
      </Link>
  );
  return (
    <>
      {canEdit ? (
        <div
          className="flex items-center gap-1 pr-1"
          data-drag-row="workboard"
          {...(drag
            ? drag.dragSource({
                type: "workboard",
                id: engagement.id,
                clientId: engagement.clients?.quick_folder === false ? engagement.clients.id : null,
              })
            : {})}
          onContextMenu={(event) => {
            event.preventDefault();
            setMenuOpen(true);
          }}
        >
          <div className="min-w-0 flex-1">{link}</div>
          <SidebarItemMenu
            open={menuOpen}
            onOpenChange={setMenuOpen}
            target={{
              type: "workboard",
              id: engagement.id,
              name: engagementDisplayTitle(engagement),
              clientId: engagement.clients?.id ?? null,
              archivedAt: engagement.archived_at ?? null,
            }}
          />
        </div>
      ) : (
        link
      )}
      {scope ? (
        <div>
          <Link
            to="/engagements/$id"
            params={{ id: engagement.id }}
            search={{ work: undefined }}
            onClick={onNavigate}
            className={`${linkClass} nb-nav-item-nested-2 ${scope.workId === undefined ? "nb-nav-item-active" : ""}`}
          >
            <NavActiveCatch />
            <PencilIndent />
            <span className="truncate">Everything in this workboard</span>
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
                <NavActiveCatch />
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
                data-board-hue={boardHueIndex(engagement.id)}
                activeProps={activeProps}
                activeOptions={{ includeSearch: false }}
              >
                <NavActiveCatch />
                <PencilIndent />
                <span className="truncate">{engagement.title}</span>
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
  surface = "sidebar",
}: {
  onNavigate?: (() => void) | undefined;
  onOpenSettings?: (() => void) | undefined;
  surface?: "sidebar" | "drawer";
}) {
  // useAffiliation remains the source of the institution, through useNavCtx.
  const { ctx: navCtx, profile, profiles, institution, vocab, guestNav, labels } = useNavCtx();
  const { data: engagements } = useEngagements(profile?.id);
  // MN-3b: the create menu opens the same dialog and inline rows the tile did.
  const [newBoardOpen, setNewBoardOpen] = useState(false);
  const [creating, setCreating] = useState<CreatingKind>(null);
  const isPartnerOrg = profile?.org_type === "partner";
  const navGroupsForPerson = navFor(navCtx, labels).filter((group) => group.placement !== "workspace_menu");
  const openNavItem = (item: NavItemId) => {
    if (profile?.org_id) logEvent("nav.opened", profile.org_id, { item, surface });
    onNavigate?.();
  };
  const coachingGroups = navGroupsForPerson.filter((group) => group.id === "coaching");
  // The guest shell's own short list, below its coaching group.
  const coachNavGroups = navGroupsForPerson.filter((group) => group.id !== "coaching");
  // The affiliation link is only ever drawn for an affiliated business workspace.
  const affiliationShown = (group: { id: string }) =>
    Boolean(group.id === "account" && institution && isBusinessOrg(profile));
  const affiliationLabel = institution ? `Your ${institution.name} link` : null;
  // One query for the circle, shared with every other surface that draws it.
  // A guest never asks: there are no circles on a guest's screen.
  const { data: unreadNotes } = useUnreadNotesAboutMe(guestNav ? undefined : profile?.id);
  const hasNewNotes = (unreadNotes ?? []).length > 0;
  const unreadCount = (unreadNotes ?? []).length;
  const createMenu = (
    <SidebarCreateMenu
      items={[
        { id: "workboard", label: vocab.newEngagement, onSelect: () => setNewBoardOpen(true) },
        ...(canCreateClient(profile)
          ? [{ id: "client", label: `New ${vocab.client.toLowerCase()}`, onSelect: () => setCreating("client") }]
          : []),
        { id: "folder", label: "New folder", onSelect: () => setCreating("folder") },
      ]}
      onOpen={() => {
        if (profile?.org_id) logEvent("nav.opened", profile.org_id, { item: "create_menu", surface });
      }}
    />
  );


  const matchRoute = useMatchRoute();
  const locationHash = useLocationHash();
  const archiveMatch = Boolean(matchRoute({ to: "/archive", fuzzy: false }));
  const engagementMatch = matchRoute({ to: "/engagements/$id", fuzzy: true });
  const activeEngagementId = engagementMatch ? engagementMatch.id : undefined;
  const search = useSearch({ strict: false });
  const activeWorkId =
    "work" in search && typeof search.work === "string" ? search.work : undefined;
  const cachedTasks = useCachedEngagementTasks(activeEngagementId);
  const scopeFor = (engagementId: string) =>
    engagementId === activeEngagementId && cachedTasks.length > 0
      ? { tasks: cachedTasks, workId: activeWorkId }
      : undefined;

  const [pendingMoves, setPendingMoves] = useState<PendingMoves>({});
  const rawEngagementList = ((engagements ?? []) as unknown as NavEngagement[]).filter(
    (engagement) => !engagement.archived_at,
  );
  // Unit 3c: the container tree is built from the workspace's own container
  // rows plus workboards. Built from workboard joins alone, a client or folder
  // with nothing in it was in no group and rendered nothing. A guest never
  // reads the clients table: they see only containers behind shared boards.
  const { data: clientRows } = useClients(guestNav ? undefined : profile?.org_id);
  // Unit 4e: a drag shows its move at once; the overlay clears on reconcile.
  const containerRows = applyContainerMoves(
    mergeContainerRows(clientRows ?? [], rawEngagementList),
    pendingMoves,
  );
  const engagementList = applyWorkboardMoves(rawEngagementList, containerRows, pendingMoves);
  // Only the synthetic groupings (clientless work, quick folders) come from here.
  const { groups } = groupEngagementsByClient(engagementList);
  const fullContainerRoots = buildContainerTree(containerRows, engagementList);
  const [findQuery, setFindQuery] = useState("");
  const filtering = findQuery.trim().length > 0;
  const containerRoots = filterBoardTree(fullContainerRoots, findQuery);
  const split = clientsEnabled(profile);
  const clientRoots = flattenForSidebar(
    containerRoots.filter((node) => !split || node.kind === "client"),
  );
  const topLevelFolders = split
    ? flattenForSidebar(containerRoots.filter((node) => node.kind === "folder"))
    : [];
  const showFolders = topLevelFolders.length > 0;
  const allSyntheticShelves = groups.filter((shelf) => isSyntheticShelf(shelf.clientId));
  const boardsInTree = [...treeBoards(fullContainerRoots), ...allSyntheticShelves.flatMap((shelf) => shelf.engagements)];
  const syntheticShelves = filtering ? allSyntheticShelves.flatMap((shelf) => {
    const engagements = shelf.engagements.filter((board) => board.title.toLocaleLowerCase().includes(findQuery.trim().toLocaleLowerCase()) || board.clients?.name.toLocaleLowerCase().includes(findQuery.trim().toLocaleLowerCase()));
    return engagements.length ? [{ ...shelf, engagements }] : [];
  }) : allSyntheticShelves;
  const everyCollapsibleId = [...allContainerIds(fullContainerRoots), ...allSyntheticShelves.map((shelf) => shelf.clientId)];
  const { collapsed: savedCollapsed, setCollapsed: setCollapsedClients } = useContainerOpenState(
    profile?.id, everyCollapsibleId, activeBoardChain(fullContainerRoots, activeEngagementId),
  );
  const collapsedClients = filtering ? [] : savedCollapsed;
  const boardNavigate = () => {
    // CS-3: a tree board click is a board open; a filtered one stays a find result.
    if (profile?.org_id) logEvent("nav.opened", profile.org_id, { item: filtering ? "find_result" : "board", surface } satisfies NavOpenedDims);
    onNavigate?.();
  };
  function toggleClient(clientId: string) {
    const next = savedCollapsed.includes(clientId)
      ? savedCollapsed.filter((id) => id !== clientId)
      : [...new Set([...savedCollapsed, clientId, ...descendantContainerIds(fullContainerRoots, clientId)])];
    setCollapsedClients(next);
  }
  const allCollapsed = everyCollapsibleId.length > 0 && everyCollapsibleId.every((id) => savedCollapsed.includes(id));
  function toggleAll() { setCollapsedClients(allCollapsed ? [] : everyCollapsibleId); }
  function expandClient(clientId: string) { setCollapsedClients(savedCollapsed.filter((id) => id !== clientId)); }

  function renderShelf(shelf: (typeof groups)[number]) {
                    const collapsed = collapsedClients.includes(shelf.clientId);
                    // A synthetic shelf is a grouping, not a client, so it has
                    // nowhere to go: it stays a plain toggle.
                    const synthetic = isSyntheticShelf(shelf.clientId);
                    return (
                      <div key={shelf.clientId}>
                        {synthetic ? (
                          <ShelfDropZone topLevel={shelf.clientId === INTERNAL_SHELF_ID}>
                          <button
                            type="button"
                            aria-expanded={!collapsed}
                            onClick={() => toggleClient(shelf.clientId)}
                            className={`${linkClass} w-full text-left text-muted-foreground`}
                          >
                            {/* A grouping, not a container: no container icon, quiet ink. */}
                            <span className="flex min-w-0 flex-1 items-center gap-1.5">
                              <span className="truncate italic">{shelf.clientId === UNMAPPED_SHELF_ID ? `No ${vocab.client.toLowerCase()}` : shelf.clientId === INTERNAL_SHELF_ID ? notInContainerLabel(vocab.client) : shelf.name}</span>
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
                          </ShelfDropZone>
                        ) : (
                          <div
                            className={`${linkClass} nb-nav-shelf group/shelf w-full text-left`}
                          >
                            <GraphiteIcon name="folder" size={20} />
                            <Link
                              to="/clients/$id"
                              params={{ id: shelf.clientId }}
                              onClick={onNavigate}
                              className="flex min-w-0 flex-1 items-center gap-1.5"
                            >
                              <NavActiveCatch />
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

                        {collapsed ? null : (
                          <>
                            {shelf.engagements.map((engagement) => (
                                <EngagementRow
                                  key={engagement.id}
                                  engagement={engagement}
                                  nested
                                  onNavigate={boardNavigate}
                                  scope={scopeFor(engagement.id)}
                                />
                              ))}
                          </>
                        )}
                      </div>
                    );
  }

  // SH-6b: a board guest sees only the boards shared with them, never the
  // host's folders, All work or Look back.
  if (profile?.is_guest) {
    return (
      <nav className="lasso-sidebar-nav flex flex-col gap-7">
        <SharedWithYouSection onNavigate={onNavigate} />
      </nav>
    );
  }

  // A guest gets their own short nav. Worker and admin items are unchanged.
  // The coaching destination sits on top of it only when a board was shared.
  if (guestNav) {
    const shared = (
      <SharedWithMeGroup profiles={profiles} orgId={profile?.org_id} onNavigate={onNavigate} />
    );
    return (
      <nav className="lasso-sidebar-nav flex flex-col gap-7">
        <SharedWithYouSection onNavigate={onNavigate} />
        {coachingGroups.length === 0 ? shared : null}
        {[...coachingGroups, ...coachNavGroups].map((group) => (
          <Fragment key={group.label}>
            {/* In a partner workspace Shared with me is the primary surface,
                so it renders above the coaching group rather than after it. */}
            {isPartnerOrg && group.id === "coaching" ? shared : null}
            <div data-nav-placement={group.placement}>
              <div className="nb-group-header px-2">{group.label}</div>
              <div className="mt-2 flex flex-col gap-0.5">
                {group.items.map((item) =>
                  item.action === "openSettings" ? (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onOpenSettings?.();
                        openNavItem(item.id);
                      }}
                      className={`${linkClass} w-full text-left`}
                    >
                      <GraphiteIcon name={item.icon} size={20} />
                      <span>{item.label}</span>
                    </button>
                  ) : (
                    <Link
                      key={item.id}
                      to={item.to as string}
                      onClick={() => openNavItem(item.id)}
                      className={linkClass}
                      activeProps={activeProps}
                    >
                      <NavActiveCatch />
                      <GraphiteIcon name={item.icon} size={20} />
                      <span>{item.label}</span>
                    </Link>
                  ),
                )}
              </div>
            </div>
            {!isPartnerOrg && group.id === "coaching" ? shared : null}
          </Fragment>
        ))}
      </nav>
    );
  }

  return (
    <nav className="lasso-sidebar-nav flex shrink-0 flex-col gap-7">
      <SharedWithYouSection onNavigate={onNavigate} />
      {navGroupsForPerson.map((group) => {
        if (group.id === "from_your_people") {
          return <FromYourPeopleGroup key="from_your_people" onOpen={() => openNavItem("from_your_people")} />;
        }
        const isEngagementGroup = group.id === "engagements";
        const groupLabel = group.label;

        const itemsForGroup = group.items
          .filter((item) => item.id !== "affiliation" || affiliationShown(group))
          .map((item) =>
            item.id === "affiliation" && affiliationLabel ? { ...item, label: affiliationLabel } : item,
          );

        const visibleItems = itemsForGroup
          .map((item) => {
            const archiveItem = item.to === "/archive";
            const archiveItemActive =
              archiveItem && archiveMatch && (item.hash ?? "") === locationHash;
            return (
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
            ) : item.action === "openSettings" ? (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onOpenSettings?.();
                  openNavItem(item.id);
                }}
                className={`${linkClass} w-full text-left`}
              >
                <GraphiteIcon name={item.icon} size={20} />
                <span className="truncate">{item.label}</span>
              </button>
            ) : item.id === "your_coach" ? (
              <Link
                key={item.id}
                to={item.to as string}
                onClick={() => openNavItem(item.id)}
                className={linkClass}
                activeProps={activeProps}
                aria-label={unreadCount > 0 ? `${item.label}, ${unreadCount} new ${unreadCount === 1 ? "note" : "notes"}` : undefined}
              >
                <NavActiveCatch />
                <GraphiteIcon name={item.icon} size={20} />
                <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                  <span className="truncate">{item.label}</span>
                  {unreadCount > 0 ? (
                    <span className="font-mono text-[10px] text-soft" aria-hidden>{unreadCount}</span>
                  ) : null}
                </span>
              </Link>
            ) : item.to === "/coach-notes" && hasNewNotes ? (
              // The circle, not a count: it says look here, and nothing more.
              <CircleMark key={item.to} className="block" label="New note from your coach">
                <Link
                  to={item.to as string}
                  onClick={() => openNavItem(item.id)}
                  className={linkClass}
                  activeProps={activeProps}
                >
                  <NavActiveCatch />
                  <GraphiteIcon name={item.icon} size={20} />
                  <span className="truncate">{item.label}</span>
                </Link>
              </CircleMark>
            ) : (
              <Link
                 key={`${item.to}:${item.label}`}
                to={item.to as string}
                 {...(item.hash ? { hash: item.hash } : {})}
                 {...(item.search ? { search: item.search } : {})}
                onClick={() => openNavItem(item.id)}
                className={`${item.nested ? `${linkClass} nb-nav-item-nested` : linkClass}${archiveItemActive ? " nb-nav-item-active" : ""}`}
                {...(archiveItem ? {} : { activeProps })}
              >
                {item.nested ? <PencilIndent /> : null}
                <GraphiteIcon name={item.icon} size={20} />
                <NavActiveCatch />
                <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                  <span className="truncate">
                    {item.label}
                  </span>
                </span>
              </Link>
            ));
          },

          );

        // Groups with no visible items are silent, except Engagements which
        // always carries its shelf list and the new-engagement action.
        if (!isEngagementGroup && visibleItems.length === 0) {
          return null;
        }

        return (
          <Fragment key={group.label}>
          <div data-nav-placement={group.placement} className={isEngagementGroup ? "flex shrink-0 flex-col" : "shrink-0"}>
            {isEngagementGroup && everyCollapsibleId.length > 0 ? (
              <div className="flex items-center justify-between gap-2 px-2">
                <div className="nb-group-header">{groupLabel}</div>
                <span className="ml-auto flex items-center gap-2">
                {createMenu}
                <button
                  type="button"
                  data-testid="nav-collapse-all"
                  onClick={toggleAll}
                  className="font-mono text-[9px] uppercase tracking-[0.08em] text-soft transition-colors hover:text-foreground"
                >
                  {allCollapsed ? "Expand all" : "Collapse all"}
                </button>
                </span>
              </div>
            ) : isEngagementGroup ? (
              <div className="flex items-center justify-between gap-2 px-2">
                <div className="nb-group-header">{groupLabel}</div>
                {createMenu}
              </div>
            ) : group.headless ? null : (
              <div className="nb-group-header px-2">{groupLabel}</div>
            )}
            <div className={group.headless ? "flex flex-col gap-0.5" : "mt-2 flex flex-col gap-0.5"}>
              {/* Anything still in this group (a partner firm's extra rows)
                  renders after the shelves, never above them. */}
              {isEngagementGroup ? null : visibleItems}


              {isEngagementGroup ? (
                <SidebarDragProvider
                  rows={containerRows}
                  orgId={profile?.org_id}
                  setPending={setPendingMoves}
                >
                <BoardFinder profileId={profile?.id} boards={boardsInTree} query={findQuery} onQueryChange={setFindQuery}
                  onOpen={() => { if (profile?.org_id) logEvent("nav.opened", profile.org_id, { item: "recent_board", surface }); onNavigate?.(); }} />
                <NoBoardNavRow onNavigate={onNavigate} />
                <div className="nb-nav-tree-scroll">
                <TopLevelDropZone>
                  <FolderRows
                    rows={clientRoots}
                    collapsedIds={collapsedClients}
                    onToggle={toggleClient}
                    onExpand={expandClient}
                    onNavigate={onNavigate}
                    onBoardNavigate={boardNavigate}
                    newEngagementLabel={vocab.newEngagement}
                    scopeFor={scopeFor}
                  />
                  {showFolders ? (
                    <FolderSection
                      rows={topLevelFolders}
                      collapsedIds={collapsedClients}
                      onToggle={toggleClient}
                      onExpand={expandClient}
                      onNavigate={onNavigate}
                      onBoardNavigate={boardNavigate}
                      newEngagementLabel={vocab.newEngagement}
                      scopeFor={scopeFor}
                    />
                  ) : null}
                  {syntheticShelves.map((shelf) => renderShelf(shelf))}
                </TopLevelDropZone>
                  {filtering && containerRoots.length === 0 && syntheticShelves.length === 0 ? <p className="px-2 py-1.5 text-sm text-muted-foreground">{TREE_COPY.noMatch}</p> : null}
                  {engagements && engagements.length === 0 ? (
                    <p className="px-2 py-1.5 text-sm text-muted-foreground">
                      {vocab.noEngagements}
                    </p>
                  ) : null}
                </div>
                  <div className="nb-nav-actions">
                  <NewEngagementDialog
                    onDone={onNavigate}
                    from="sidebar"
                    open={newBoardOpen}
                    onOpenChange={setNewBoardOpen}
                  />
                  <SidebarCreateActions
                    empty={!!engagements && engagements.length === 0}
                    creating={creating}
                    onCreatingChange={setCreating}
                  />
                  {visibleItems}
                  </div>
                </SidebarDragProvider>
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

/** MN-3b: the one "+" beside Where it goes. Same dropdown as the workspace menu. */
function SidebarCreateMenu({
  items,
  onOpen,
}: {
  items: { id: string; label: string; onSelect: () => void }[];
  onOpen: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={(value) => { setOpen(value); if (value) onOpen(); }}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="New workboard, client or folder"
          aria-expanded={open}
          data-testid="nav-create-menu"
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => { if (!open) onOpen(); setOpen((value) => !value); }}
          className="shrink-0 rounded-[var(--radius-md)] p-0.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          <GraphiteIcon name="plus" size={14} />
        </button>
      </DropdownMenuTrigger>
      {open ? (
        <DropdownMenuContent align="end" className="min-w-[200px] bg-sidebar">
          {items.map((item) => (
            <DropdownMenuItem key={item.id} data-create-item={item.id} onSelect={item.onSelect}>
              <GraphiteIcon name="plus" size={16} />
              <span>{item.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      ) : null}
    </DropdownMenu>
  );
}

/** Folder shelf rows shared by client shelves and the top-level Folders section. */
function FolderRows({
  rows,
  collapsedIds,
  onToggle,
  onExpand,
  onNavigate,
  onBoardNavigate,
  newEngagementLabel,
  scopeFor,
}: {
  rows: { node: ContainerNode<NavEngagement>; depth: number }[];
  collapsedIds: string[];
  onToggle: (id: string) => void;
  onExpand?: ((id: string) => void) | undefined;
  onNavigate?: (() => void) | undefined;
  onBoardNavigate?: (() => void) | undefined;
  newEngagementLabel: string;
  scopeFor: (id: string) => { tasks: CachedNavTask[]; workId: string | undefined } | undefined;
}) {
  // The flat list identifies the visible roots. Descendants render from each
  // node so one branch wrapper can draw a continuous guide for that level.
  return rows
    .filter(({ depth }) => depth === 0)
    .map(({ node }) => (
      <ContainerShelfRow
        key={node.clientId}
        node={node}
        depth={0}
        collapsedIds={collapsedIds}
        onToggle={onToggle}
        onExpand={onExpand}
        onNavigate={onNavigate}
        onBoardNavigate={onBoardNavigate}
        newEngagementLabel={newEngagementLabel}
        scopeFor={scopeFor}
        ancestors={[]}
      />
    ));
}

function ContainerShelfRow({
  node,
  depth,
  collapsedIds,
  onToggle,
  onExpand,
  onNavigate,
  onBoardNavigate,
  newEngagementLabel,
  scopeFor,
  ancestors,
}: {
  node: ContainerNode<NavEngagement>;
  depth: number;
  collapsedIds: string[];
  onToggle: (id: string) => void;
  onExpand?: ((id: string) => void) | undefined;
  onNavigate?: (() => void) | undefined;
  onBoardNavigate?: (() => void) | undefined;
  newEngagementLabel: string;
  scopeFor: (id: string) => { tasks: CachedNavTask[]; workId: string | undefined } | undefined;
  ancestors: readonly { color?: unknown }[];
}) {
  const canEdit = useCanEditContainers();
  const [menuOpen, setMenuOpen] = useState(false);
  const collapsed = collapsedIds.includes(node.clientId);
  const hasChildren = node.engagements.length > 0 || node.children.length > 0;
  const drag = useSidebarDrag();
  const colour = inheritedColour(node, ancestors);
  const colourStyle = colour ? containerColourStyle(colour) : null;
        return (
          <div key={node.clientId} className="nb-tree-child" data-tree-node={node.clientId}>
            <div
              className={`${linkClass} nb-nav-shelf group/shelf w-full text-left`}
              data-tree-depth={depth}
              data-drag-row="container"
              {...(drag && canEdit
                ? {
                    ...drag.dragSource({ type: "container", id: node.clientId, kind: node.kind }),
                    ...drag.dropTarget({ type: "container", id: node.clientId }, () =>
                      onExpand?.(node.clientId),
                    ),
                  }
                : {})}
              onContextMenu={
                canEdit
                  ? (event) => {
                      event.preventDefault();
                      setMenuOpen(true);
                    }
                  : undefined
              }
            >
              <span
                className="flex shrink-0"
                style={colourStyle ? { color: colourStyle.dot } : undefined}
              >
                <GraphiteIcon name="folder" size={20} />
              </span>
              <Link
                to="/clients/$id"
                params={{ id: node.clientId }}
                onClick={onNavigate}
                className="flex min-w-0 flex-1 items-center gap-1.5"
              >
                <NavActiveCatch />
                <span className="truncate">{node.name}</span>
              </Link>
              <NewEngagementDialog
                onDone={onNavigate}
                initialClientId={node.clientId}
                from="sidebar_client"
                trigger={
                  <button
                    type="button"
                    aria-label={`${newEngagementLabel} in ${node.name}`}
                    className="shrink-0 opacity-0 transition-opacity focus-visible:opacity-100 group-hover/shelf:opacity-100 group-focus-within/shelf:opacity-100"
                  >
                    <GraphiteIcon name="plus" size={14} />
                  </button>
                }
              />
              {canEdit ? (
                <SidebarItemMenu
                  open={menuOpen}
                  onOpenChange={setMenuOpen}
                  target={{
                    type: "container",
                    id: node.clientId,
                    name: node.name,
                    kind: node.kind,
                    workboards: node.engagements.length,
                    folders: node.children.length,
                    color: node.color as ContainerColour | null,
                    archivedAt: node.archived_at,
                  }}
                />
              ) : null}
              <button
                type="button"
                aria-expanded={!collapsed}
                aria-label={collapsed ? "Expand" : "Collapse"}
                onClick={() => onToggle(node.clientId)}
                className="shrink-0"
              >
                <GraphiteIcon name="chevron-right" size={13} className={collapsed ? "" : "rotate-90"} />
              </button>
            </div>
            {!collapsed && node.engagements.length === 0 && node.children.length === 0 ? (
              <p className="px-2 py-1 pl-10 text-sm italic text-muted-foreground" data-tree-depth={depth + 1}>Nothing in here yet</p>
            ) : null}
            {collapsed || !hasChildren ? null : (
              <div
                className="nb-tree-branch"
                data-container-colour={colour ?? undefined}
                style={colourStyle ? { "--container-wash": colourStyle.wash } as CSSProperties : undefined}
              >
                {node.engagements.map((engagement) => (
                  <div key={engagement.id} className="nb-tree-child" data-tree-depth={depth + 1}>
                  <EngagementRow
                    engagement={engagement}
                    nested
                    treeDepth={depth + 1}
                    onNavigate={onBoardNavigate ?? onNavigate}
                    scope={scopeFor(engagement.id)}
                  />
                  </div>
                ))}
                {node.children.map((child) => (
                  <ContainerShelfRow
                    key={child.clientId}
                    node={child}
                    depth={depth + 1}
                    collapsedIds={collapsedIds}
                    onToggle={onToggle}
                    onExpand={onExpand}
                    onNavigate={onNavigate}
                    onBoardNavigate={onBoardNavigate}
                    newEngagementLabel={newEngagementLabel}
                    scopeFor={scopeFor}
                    ancestors={[node, ...ancestors]}
                  />
                ))}
              </div>
            )}
          </div>
        );
}

/** The top-level Folders section. */
function FolderSection(props: Parameters<typeof FolderRows>[0]) {
  return (
    <>
      <div className="px-2 pt-2 text-sm text-muted-foreground">Folders</div>
      <FolderRows {...props} />
    </>
  );
}


/** Unit 4e: the whole tree list is the top-level drop target; rows inside
 *  take their own drops first. Also swallows a click at the end of a drag. */
function TopLevelDropZone({ children }: { children: ReactNode }) {
  const drag = useSidebarDrag();
  if (!drag) return <>{children}</>;
  return (
    <div
      className="nb-drop-zone flex flex-col gap-0.5"
      data-drop-zone="top"
      {...drag.dropTarget({ type: "top" })}
      onClickCapture={drag.onClickCapture}
    >
      {children}
    </div>
  );
}

/** "Not in a client yet" takes a drop as top level. Other groupings do not. */
function ShelfDropZone({ topLevel, children }: { topLevel: boolean; children: ReactNode }) {
  const drag = useSidebarDrag();
  if (!drag || !topLevel) return <>{children}</>;
  return (
    <div data-drop-zone="not-in-container" {...drag.dropTarget({ type: "top" })}>
      {children}
    </div>
  );
}

/**
 * NAV-3: the count of grouped entries with no board, counted the way All work
 * counts them. Hidden at zero. Fires nothing; the filter chip owns that event.
 */
function NoBoardNavRow({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  const { data } = useWorkItems();
  const count = groupConversations((data?.items ?? []).filter((i) => i.visibility === "unmapped")).length;
  if (count === 0) return null;
  return (
    <Link
      to="/work"
      search={{ filter: "no-board" }}
      onClick={onNavigate}
      className={`${linkClass} shrink-0`}
      aria-label={`No board, ${count} ${count === 1 ? "piece" : "pieces"}`}
      data-testid="nav-no-board"
    >
      <NavActiveCatch />
      <span>No board</span>
      <span className="ml-auto font-mono text-[10px] text-soft" aria-hidden>
        {count}
      </span>
    </Link>
  );
}

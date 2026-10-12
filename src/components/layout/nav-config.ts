import type { GraphiteIconName } from "@/components/notebook/icons";
import { EDU_VOCAB, type Vocab } from "@/lib/edu-vocab";
import type { OrgType } from "@/lib/org-type";
import * as roles from "@/lib/role-access";

export type NavItem = {
  label: string;
  to: string;
  icon: GraphiteIconName;
  hash?: string;
  nested?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  search?: { view: "asked" };
};
export type NavGroup = { id?: string; label: string; items: NavItem[]; emptyState?: string };

/* ------------------------------------------------------------------------ *
 * MN-2a: the navigation manifest. One list of every nav place, its group,
 * its wording and who sees it. The sidebar renders from navFor(ctx); the
 * legacy group exports below are derived from it for existing importers.
 * ------------------------------------------------------------------------ */

export type NavPlacement = "main" | "bottom" | "workspace_menu";

export type NavItemId =
  | "home"
  | "all-work"
  | "ai-record"
  | "connectors"
  | "workshop-keys"
  | "adding-people"
  | "past-work"
  | "archived"
  | "past-ask"
  | "find-it"
  | "decisions"
  | "classes"
  | "assignments"
  | "projects"
  | "portfolio"
  | "one-on-one"
  | "coach-notes"
  | "firm-view"
  | "members"
  | "affiliation"
  | "settings"
  | "people-you-coach"
  | "guest-one-on-one"
  | "guest-settings"
  | "trust" | "why" | "feedback" | "sign-out"
  /** MN-3b: the lean sidebar rows and the create menu. */
  | "look_back" | "your_coach" | "connect_tools" | "create_menu"
  /** MN-5: boards people shared with a partner workspace. */
  | "from_your_people";

export type NavGroupId =
  | "landed"
  | "engagements"
  | "from_your_people"
  | "lookback"
  | "school"
  | "coach"
  | "firm"
  | "account"
  | "coaching"
  | "guest-account"
  | "workspace";

export type NavAction = "openSettings" | "signOut" | "openFeedback";

export const TAB_ITEMS = {
  work: { id: "all-work", label: "Work", to: "/work", icon: "work" },
  workboards: { id: "workboards", label: "Workboards", icon: "engagement", action: "engagements" },
  more: { id: "more", label: "More", icon: "overview", action: "more" },
  coaching: { id: "people-you-coach", label: "Coaching", to: "/coaching", icon: "members" },
  prep: { id: "guest-one-on-one", label: "1:1 prep", to: "/one-on-one", icon: "one-on-one" },
  coachAsk: { id: "people-you-coach", label: "Ask", icon: "ask-lasso", action: "coach-ask" },
} as const;

export type NavCtx = {
  type: OrgType;
  role: string;
  canReview: boolean;
  canManageMembers: boolean;
  canSeeFirmView: boolean;
  hasCoachLink: boolean;
  affiliated: boolean;
  clientsEnabled: boolean;
  /** MN-3b: how many work items the workspace holds; undefined while unknown. */
  workItemCount?: number;
  /** MN-5: how many boards people shared with this partner workspace; undefined while unknown. */
  partnerShareCount?: number;
};

/** What wording may depend on. `legacy` is set only when deriving the old exports. */
export type NavLabelCtx = {
  vocab: Vocab;
  type: OrgType;
  institutionName: string | null;
  legacy?: boolean;
};

type Label = string | ((l: NavLabelCtx) => string);

export type NavManifestItem = {
  id: NavItemId;
  placement: NavPlacement;
  group: NavGroupId;
  label: Label;
  to?: string;
  action?: NavAction;
  hash?: string;
  search?: { view: "asked" };
  icon: GraphiteIconName;
  nested?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  /** Structural presence by workspace type; absent means every type. */
  types?: OrgType[];
  /** Runtime-only items (e.g. the affiliation link) never enter the legacy exports. */
  runtimeOnly?: boolean;
  /** MN-3b: kept only for the legacy exports; never rendered by navFor. */
  retired?: boolean;
  /** MN-3b: the group the legacy exports file this item under, when it moved. */
  legacyGroup?: NavGroupId;
  show?: (ctx: NavCtx) => boolean;
};

export type NavManifestGroup = {
  id: NavGroupId;
  label: Label;
  emptyState?: string;
  types?: OrgType[];
  /** Guest groups belong to the guest shell; the rest to the worker shell. */
  guest?: boolean;
  shared?: boolean;
  /** Shown even with no visible items (the engagement shelves). */
  alwaysShow?: boolean;
  /** MN-3b: a one-row group renders its row without a heading. */
  headless?: boolean;
  show?: (ctx: NavCtx) => boolean;
};

const asProfile = (ctx: NavCtx) => ({ role: ctx.role, org_type: ctx.type });
const isBusinessType = (type: OrgType) => type === "company" || type === "partner";

/**
 * The weekly loop: what landed, where it goes, what you look back on, your
 * coach, run the firm, your account. Group order is the render order.
 */
export const NAV_GROUPS: NavManifestGroup[] = [
  { id: "landed", label: "What landed" },
  {
    id: "engagements",
    label: (l) =>
      l.type === "edu" ? EDU_VOCAB.engagements : l.type === "partner" ? "Your clients" : "Where it goes",
    emptyState: "No workboards yet",
    alwaysShow: true,
  },
  // MN-5: directly below Where it goes; partner only, absent when nothing is shared.
  { id: "from_your_people", label: "From your people", types: ["partner"], show: (ctx) => (ctx.partnerShareCount ?? 0) > 0 },
  { id: "lookback", label: "Look back", headless: true },
  {
    // "Your coach" is only a real place when someone is actually coaching
    // you: by arrangement in a firm or school, by a live link when solo.
    // A partner workspace never has it.
    id: "coach",
    label: "Your coach",
    headless: true,
    types: ["company", "personal", "edu"],
    show: (ctx) =>
      roles.hasCoachByArrangement(asProfile(ctx)) || (ctx.type === "personal" && ctx.hasCoachLink),
  },
  {
    id: "firm",
    label: (l) =>
      l.type === "partner"
        ? "Your practice"
        : !l.legacy && !isBusinessType(l.type)
          ? "Who you share with"
          : "Run the firm",
  },
  { id: "account", label: "Your account" },
  // Shown only to someone given Review on at least one engagement.
  { id: "coaching", label: "Coaching", show: (ctx) => ctx.canReview },
  { id: "guest-account", label: "Your account", guest: true },
  { id: "workspace", label: "Workspace", shared: true },
];

/** MN-3b: whether the Your coach row shows, by the coach group's own rule. */
export function showsYourCoach(ctx: Pick<NavCtx, "type" | "role" | "hasCoachLink">): boolean {
  const group = NAV_GROUPS.find((g) => g.id === "coach");
  if (!group || roles.usesGuestNav(asProfile(ctx as NavCtx))) return false;
  return presentFor(group.types, ctx.type) && (!group.show || group.show(ctx as NavCtx));
}

export const NAV_ITEMS: NavManifestItem[] = [
  { id: "home", placement: "main", group: "landed", label: "Home", to: "/home", icon: "overview" },
  { id: "all-work", placement: "main", group: "landed", label: "All work", to: "/work", icon: "work" },
  { id: "ai-record", placement: "main", group: "landed", label: "All AI Conversations", to: "/ai-record", icon: "ai-record" },
  // MN-3b: shown only while the workspace holds no work items.
  { id: "connect_tools", placement: "main", group: "landed", label: "Connect your AI tools", to: "/connectors", icon: "connectors", runtimeOnly: true, show: (ctx) => ctx.workItemCount === 0 },
  // A partner's extra rows render after the shelves.
  { id: "workshop-keys", placement: "workspace_menu", group: "engagements", label: "Workshop keys", to: "/requests", icon: "members", types: ["partner"], show: (ctx) => ctx.canManageMembers },
  { id: "adding-people", placement: "workspace_menu", group: "engagements", label: "Adding people", to: "/adding-people", icon: "members", types: ["partner"], show: (ctx) => ctx.canManageMembers },
  // Past work first, because it is where finished work is found.
  { id: "past-work", retired: true, placement: "main", group: "lookback", label: "Past work", to: "/archive", icon: "firm" },
  { id: "archived", retired: true, placement: "main", group: "lookback", label: "Archived", to: "/archive", hash: "archived", icon: "history" },
  { id: "past-ask", retired: true, placement: "main", group: "lookback", label: "Past Ask Lasso chats", to: "/ai-record", icon: "history", search: { view: "asked" } },
  { id: "find-it", retired: true, placement: "main", group: "lookback", label: "Find it", to: "/find-it", icon: "work", disabled: true, disabledReason: "Coming soon" },
  { id: "decisions", retired: true, placement: "main", group: "lookback", label: "Decision log", to: "/decisions", icon: "decisions", disabled: true, disabledReason: "Coming soon" },
  { id: "from_your_people", placement: "main", group: "from_your_people", label: "From your people", icon: "members", types: ["partner"], runtimeOnly: true, show: (ctx) => (ctx.partnerShareCount ?? 0) > 0 },
  { id: "look_back", placement: "bottom", group: "lookback", label: "Look back", to: "/archive", icon: "history", runtimeOnly: true },
  { id: "one-on-one", retired: true, placement: "main", group: "coach", label: "1:1 prep", to: "/one-on-one", icon: "one-on-one" },
  { id: "coach-notes", retired: true, placement: "main", group: "coach", label: "Notes from your coach", to: "/coach-notes", icon: "messages" },
  { id: "your_coach", placement: "bottom", group: "coach", label: "Your coach", to: "/one-on-one", icon: "one-on-one", runtimeOnly: true },
  { id: "firm-view", placement: "workspace_menu", group: "firm", label: "Firm view", to: "/firm", icon: "firm", show: (ctx) => ctx.canSeeFirmView },
  {
    id: "members", placement: "bottom",
    group: "firm",
    label: (l) => (l.legacy ? "Members" : roles.membersLabel({ role: "", org_type: l.type })),
    to: "/members",
    icon: "members",
    show: (ctx) => ctx.canManageMembers,
  },
  {
    // An affiliated business workspace names its institution first.
    id: "affiliation", placement: "bottom",
    group: "account",
    label: (l) => `Your ${l.institutionName ?? ""} link`,
    to: "/affiliation",
    icon: "messages",
    runtimeOnly: true,
    show: (ctx) => ctx.affiliated && isBusinessType(ctx.type),
  },
  { id: "settings", placement: "workspace_menu", group: "account", label: "Settings", action: "openSettings", icon: "settings" },
  // MN-3b: once work has arrived, the sources page lives in the workspace menu.
  { id: "connectors", placement: "workspace_menu", group: "account", legacyGroup: "landed", label: "Where work comes from", to: "/connectors", icon: "connectors", show: (ctx) => ctx.workItemCount !== 0 },
  { id: "people-you-coach", placement: "main", group: "coaching", label: "People you coach", to: "/coaching", icon: "members" },
  { id: "guest-one-on-one", placement: "main", group: "guest-account", label: "1:1 prep", to: "/one-on-one", icon: "one-on-one" },
  { id: "guest-settings", placement: "workspace_menu", group: "guest-account", label: "Settings", action: "openSettings", icon: "settings" },
  { id: "trust", placement: "workspace_menu", group: "workspace", label: "Trust & data", to: "/trust", icon: "settings", runtimeOnly: true },
  { id: "why", placement: "workspace_menu", group: "workspace", label: "Why Lasso", to: "/why", icon: "overview", runtimeOnly: true },
  { id: "feedback", placement: "workspace_menu", group: "workspace", label: "Feedback", action: "openFeedback", icon: "messages", runtimeOnly: true },
  { id: "sign-out", placement: "workspace_menu", group: "workspace", label: "Sign out", action: "signOut", icon: "chevron-right", runtimeOnly: true },
];

export type ResolvedNavItem = Omit<NavManifestItem, "label" | "show" | "types" | "runtimeOnly" | "retired" | "legacyGroup"> & {
  label: string;
};
export type ResolvedNavGroup = { placement: NavPlacement; id: NavGroupId; label: string; emptyState?: string; headless?: boolean; items: ResolvedNavItem[] };

const resolve = (label: Label, l: NavLabelCtx) => (typeof label === "string" ? label : label(l));
const presentFor = (types: OrgType[] | undefined, type: OrgType) => !types || types.includes(type);

/**
 * The groups a person sees, in order, with their visible items. A guest
 * gets the guest shell; everyone else the weekly loop. Groups with no
 * visible items are dropped, except the engagement shelves.
 */
export function navFor(ctx: NavCtx, l: Omit<NavLabelCtx, "type">): ResolvedNavGroup[] {
  const guest = roles.usesGuestNav(asProfile(ctx));
  const labels: NavLabelCtx = { ...l, type: ctx.type };
  const placed: Record<NavPlacement, ResolvedNavGroup[]> = { main: [], bottom: [], workspace_menu: [] };
  for (const group of NAV_GROUPS) {
    if (!group.shared && Boolean(group.guest) !== guest && group.id !== "coaching") continue;
    if (!presentFor(group.types, ctx.type)) continue;
    if (group.show && !group.show(ctx)) continue;
    const items = NAV_ITEMS.filter(
      (item) =>
        item.group === group.id && !item.retired && presentFor(item.types, ctx.type) && (!item.show || item.show(ctx)),
    ).map(({ label, show: _s, types: _t, runtimeOnly: _r, retired: _x, legacyGroup: _g, ...rest }) => ({
      ...rest,
      placement: rest.id === "members" && isBusinessType(ctx.type) ? "workspace_menu" as const : rest.placement,
      label: resolve(label, labels),
    }));
    for (const placement of ["main", "bottom", "workspace_menu"] as const) {
      const rows = items.filter((item) => item.placement === placement);
      if (rows.length === 0 && !(group.alwaysShow && placement === "main")) continue;
      placed[placement].push({ id: group.id, placement, label: resolve(group.label, labels),
        ...(group.emptyState ? { emptyState: group.emptyState } : {}),
        ...(group.headless && placement === "bottom" ? { headless: true } : {}), items: rows });
    }
  }
  // MN-3b: main rows first, People you coach right after What landed, then
  // the bottom rows, then the workspace menu.
  const coaching = guest ? [] : placed.main.filter((g) => g.id === "coaching");
  const main = placed.main.filter((g) => !coaching.includes(g));
  const landedAt = main.findIndex((g) => g.id === "landed") + 1;
  main.splice(landedAt, 0, ...coaching);
  return [...main, ...placed.bottom, ...placed.workspace_menu];
}

/* ---- Legacy exports, derived from the manifest for existing importers. ---- */

function legacyItem(item: NavManifestItem, l: NavLabelCtx): NavItem {
  return {
    label: resolve(item.label, l),
    to: item.to ?? (item.action === "openSettings" ? "/settings" : ""),
    icon: item.icon,
    ...(item.hash ? { hash: item.hash } : {}),
    ...(item.nested ? { nested: item.nested } : {}),
    ...(item.disabled ? { disabled: item.disabled } : {}),
    ...(item.disabledReason ? { disabledReason: item.disabledReason } : {}),
    ...(item.search ? { search: item.search } : {}),
  };
}

function legacyGroups(type: OrgType, ids: NavGroupId[]): NavGroup[] {
  const l: NavLabelCtx = { vocab: EDU_VOCAB, type, institutionName: null, legacy: true };
  return NAV_GROUPS.filter((g) => ids.includes(g.id) && presentFor(g.types, type)).map((group) => ({
    id: group.id,
    label: resolve(group.label, l),
    items: NAV_ITEMS.filter(
      (item) => (item.legacyGroup ?? item.group) === group.id && !item.runtimeOnly && presentFor(item.types, type),
    ).map((item) => legacyItem(item, l)),
    ...(group.emptyState ? { emptyState: group.emptyState } : {}),
  }));
}

const WORKER_GROUPS: NavGroupId[] = ["landed", "engagements", "lookback", "coach", "firm", "account"];

/** Legacy: the company worker groups, unfiltered by role. */
export const navGroups: NavGroup[] = legacyGroups("company", WORKER_GROUPS);

/** Legacy: the coaching group. */
export const coachingGroup: NavGroup = legacyGroups("company", ["coaching"])[0] as NavGroup;

/** Legacy: the guest shell's own list. */
export const coachNavGroups: NavGroup[] = legacyGroups("company", ["guest-account"]).map(
  ({ id: _id, ...group }) => group,
);

/** Legacy: a school workspace's groups. */
export const eduNavGroups: NavGroup[] = legacyGroups("edu", WORKER_GROUPS);

/** Legacy: a partner firm's groups. */
export const partnerNavGroups: NavGroup[] = legacyGroups("partner", WORKER_GROUPS);

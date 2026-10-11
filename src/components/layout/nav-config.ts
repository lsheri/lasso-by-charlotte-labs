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
  | "guest-settings";

export type NavGroupId =
  | "landed"
  | "engagements"
  | "lookback"
  | "school"
  | "coach"
  | "firm"
  | "account"
  | "coaching"
  | "guest-account";

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
  show?: (ctx: NavCtx) => boolean;
};

export type NavManifestGroup = {
  id: NavGroupId;
  label: Label;
  emptyState?: string;
  types?: OrgType[];
  /** Guest groups belong to the guest shell; the rest to the worker shell. */
  guest?: boolean;
  /** Shown even with no visible items (the engagement shelves). */
  alwaysShow?: boolean;
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
  { id: "lookback", label: "Look back" },
  // A school workspace adds its own section after Look back.
  { id: "school", label: "Your classes", types: ["edu"] },
  {
    // "Your coach" is only a real place when someone is actually coaching
    // you: by arrangement in a firm or school, by a live link when solo.
    // A partner workspace never has it.
    id: "coach",
    label: "Your coach",
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
];

export const NAV_ITEMS: NavManifestItem[] = [
  { id: "home", group: "landed", label: "Home", to: "/home", icon: "overview" },
  { id: "all-work", group: "landed", label: "All work", to: "/work", icon: "work" },
  { id: "ai-record", group: "landed", label: "All AI Conversations", to: "/ai-record", icon: "ai-record" },
  { id: "connectors", group: "landed", label: "Where work comes from", to: "/connectors", icon: "connectors" },
  // A partner's extra rows render after the shelves.
  { id: "workshop-keys", group: "engagements", label: "Workshop keys", to: "/requests", icon: "members", types: ["partner"] },
  { id: "adding-people", group: "engagements", label: "Adding people", to: "/adding-people", icon: "members", types: ["partner"] },
  // Past work first, because it is where finished work is found.
  { id: "past-work", group: "lookback", label: "Past work", to: "/archive", icon: "firm" },
  { id: "archived", group: "lookback", label: "Archived", to: "/archive", hash: "archived", icon: "history" },
  { id: "past-ask", group: "lookback", label: "Past Ask Lasso chats", to: "/ai-record", icon: "history", search: { view: "asked" } },
  { id: "find-it", group: "lookback", label: "Find it", to: "/find-it", icon: "work", disabled: true, disabledReason: "Coming soon" },
  { id: "decisions", group: "lookback", label: "Decision log", to: "/decisions", icon: "decisions", disabled: true, disabledReason: "Coming soon" },
  { id: "classes", group: "school", label: () => EDU_VOCAB.classes, to: "/classes", icon: "engagement" },
  { id: "assignments", group: "school", label: () => EDU_VOCAB.assignments, to: "/assignments", icon: "work" },
  { id: "projects", group: "school", label: () => EDU_VOCAB.projects, to: "/projects", icon: "overview" },
  { id: "portfolio", group: "school", label: () => EDU_VOCAB.portfolio, to: "/portfolio", icon: "firm" },
  { id: "one-on-one", group: "coach", label: "1:1 prep", to: "/one-on-one", icon: "one-on-one" },
  { id: "coach-notes", group: "coach", label: "Notes from your coach", to: "/coach-notes", icon: "messages" },
  { id: "firm-view", group: "firm", label: "Firm view", to: "/firm", icon: "firm", show: (ctx) => ctx.canSeeFirmView },
  {
    id: "members",
    group: "firm",
    label: (l) => (l.legacy ? "Members" : roles.membersLabel({ role: "", org_type: l.type })),
    to: "/members",
    icon: "members",
    show: (ctx) => ctx.canManageMembers,
  },
  {
    // An affiliated business workspace names its institution first.
    id: "affiliation",
    group: "account",
    label: (l) => `Your ${l.institutionName ?? ""} link`,
    to: "/affiliation",
    icon: "messages",
    runtimeOnly: true,
    show: (ctx) => ctx.affiliated && isBusinessType(ctx.type),
  },
  { id: "settings", group: "account", label: "Settings", action: "openSettings", icon: "settings" },
  { id: "people-you-coach", group: "coaching", label: "People you coach", to: "/coaching", icon: "members" },
  { id: "guest-one-on-one", group: "guest-account", label: "1:1 prep", to: "/one-on-one", icon: "one-on-one" },
  { id: "guest-settings", group: "guest-account", label: "Settings", action: "openSettings", icon: "settings" },
];

export type ResolvedNavItem = Omit<NavManifestItem, "label" | "show" | "types" | "runtimeOnly"> & {
  label: string;
};
export type ResolvedNavGroup = { id: NavGroupId; label: string; emptyState?: string; items: ResolvedNavItem[] };

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
  const out: ResolvedNavGroup[] = [];
  for (const group of NAV_GROUPS) {
    if (Boolean(group.guest) !== guest && group.id !== "coaching") continue;
    if (!presentFor(group.types, ctx.type)) continue;
    if (group.show && !group.show(ctx)) continue;
    const items = NAV_ITEMS.filter(
      (item) =>
        item.group === group.id && presentFor(item.types, ctx.type) && (!item.show || item.show(ctx)),
    ).map(({ label, show: _s, types: _t, runtimeOnly: _r, ...rest }) => ({
      ...rest,
      label: resolve(label, labels),
    }));
    if (!group.alwaysShow && items.length === 0) continue;
    out.push({
      id: group.id,
      label: resolve(group.label, labels),
      ...(group.emptyState ? { emptyState: group.emptyState } : {}),
      items,
    });
  }
  return out;
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
      (item) => item.group === group.id && !item.runtimeOnly && presentFor(item.types, type),
    ).map((item) => legacyItem(item, l)),
    ...(group.emptyState ? { emptyState: group.emptyState } : {}),
  }));
}

const WORKER_GROUPS: NavGroupId[] = ["landed", "engagements", "lookback", "school", "coach", "firm", "account"];

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

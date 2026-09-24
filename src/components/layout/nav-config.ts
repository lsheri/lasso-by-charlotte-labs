import type { GraphiteIconName } from "@/components/notebook/icons";
import { EDU_VOCAB } from "@/lib/edu-vocab";

export type NavItem = {
  label: string;
  to: string;
  icon: GraphiteIconName;
  nested?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  search?: { view: "asked" };
};
export type NavGroup = { id?: string; label: string; items: NavItem[]; emptyState?: string };

/**
 * The weekly loop: what landed, where it goes, what you look back on, your
 * coach, run the firm, your account. Match on ids, never labels, when deriving
 * variants below.
 *
 * PASS A1 — Overview and Reflect no longer appear here. Overview's panels now
 * live on the Inbox and Reflect folds into All AI conversations, so a nav row
 * for either would be a second door onto the same page.
 */
export const navGroups: NavGroup[] = [
  {
    id: "landed",
    label: "What landed",
    items: [
      { label: "Home", to: "/home", icon: "overview" },
      { label: "Inbox", to: "/work", icon: "work" },
      { label: "All AI Conversations", to: "/ai-record", icon: "ai-record" },
      { label: "Where work comes from", to: "/connectors", icon: "connectors" },
    ],
  },
  {
    // The shelves render first, then these items, so Past work reads as the
    // place everything finished ends up.
    id: "engagements",
    label: "Where it goes",
    items: [{ label: "Past work", to: "/archive", icon: "firm" }],
    emptyState: "No engagements yet",
  },
  {
    id: "lookback",
    label: "Look back",
    items: [
      { label: "Past Ask Lasso chats", to: "/ai-record", icon: "history", search: { view: "asked" } },
      { label: "Find it", to: "/find-it", icon: "work", disabled: true, disabledReason: "Coming soon" },
      { label: "Decision log", to: "/decisions", icon: "decisions", disabled: true, disabledReason: "Coming soon" },
    ],
  },
  {
    id: "coach",
    label: "Your coach",
    items: [
      { label: "1:1 prep", to: "/one-on-one", icon: "one-on-one" },
      { label: "Notes from your coach", to: "/coach-notes", icon: "messages" },
    ],
  },
  {
    id: "firm",
    label: "Run the firm",
    items: [
      { label: "Firm view", to: "/firm", icon: "firm" },
      { label: "Members", to: "/members", icon: "members" },
    ],
  },
  {
    id: "account",
    label: "Your account",
    items: [{ label: "Settings", to: "/settings", icon: "settings" }],
  },
];

/**
 * The coaching group, shown only to someone who was given Review on at least
 * one engagement. Both the guest nav and the worker nav draw it from here, so
 * the destination cannot drift between them.
 */
export const coachingGroup: NavGroup = {
  id: "coaching",
  label: "Coaching",
  items: [{ label: "People you coach", to: "/coaching", icon: "members" }],
};

/**
 * A guest is just that: no work of their own and no engagements of their own,
 * so the worker nav would be mostly dead ends. Worker and admin items above
 * are untouched. The firm archive is firm-internal, so it is not here, and a
 * guest hitting /archive is redirected away. The coaching group is added by
 * the nav itself, only when there is something to review.
 */
export const coachNavGroups: NavGroup[] = [
  {
    label: "Your account",
    items: [
      { label: "1:1 prep", to: "/one-on-one", icon: "one-on-one" },
      { label: "Settings", to: "/settings", icon: "settings" },
    ],
  },
];


/**
 * A school workspace keeps the same weekly-loop headings as every other
 * workspace and just adds its own "Your classes" section after "Look back".
 * Only the engagement shelves group gets a true school vocabulary swap,
 * because there the underlying concept genuinely differs.
 */
export const eduNavGroups: NavGroup[] = navGroups.flatMap((group) => {
  if (group.id === "lookback") {
    return [
      group,
      {
        id: "school",
        label: "Your classes",
        items: [
          { label: EDU_VOCAB.classes, to: "/classes", icon: "engagement" as const },
          { label: EDU_VOCAB.assignments, to: "/assignments", icon: "work" as const },
          { label: EDU_VOCAB.projects, to: "/projects", icon: "overview" as const },
          { label: EDU_VOCAB.portfolio, to: "/portfolio", icon: "firm" as const },
        ],
      },
    ];
  }
  if (group.id === "engagements") return [{ ...group, label: EDU_VOCAB.engagements }];
  return [group];
});

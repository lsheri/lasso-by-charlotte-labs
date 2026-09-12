import type { GraphiteIconName } from "@/components/notebook/icons";
import { EDU_VOCAB } from "@/lib/edu-vocab";

export type NavItem = { label: string; to: string; icon: GraphiteIconName };
export type NavGroup = { id?: string; label: string; items: NavItem[]; emptyState?: string };

/**
 * The weekly loop: what landed, where it goes, what you learned, run the firm,
 * your account. Match on ids, never labels, when deriving variants below.
 */
export const navGroups: NavGroup[] = [
  {
    id: "landed",
    label: "What landed",
    items: [
      { label: "Inbox", to: "/work", icon: "work" },
      { label: "Where work comes from", to: "/connectors", icon: "connectors" },
    ],
  },
  {
    id: "engagements",
    label: "Where it goes",
    items: [],
    emptyState: "No engagements yet",
  },
  {
    id: "learned",
    label: "What you learned",
    items: [
      { label: "Past work", to: "/archive", icon: "firm" },
      { label: "Chat library", to: "/ai-record", icon: "ai-record" },
      { label: "Reflect", to: "/reflect", icon: "reflect" },
      { label: "Decision log", to: "/decisions", icon: "decisions" },
      { label: "Overview", to: "/overview", icon: "overview" },
      { label: "1:1 prep", to: "/one-on-one", icon: "one-on-one" },
      { label: "Notes about your work", to: "/coach-notes", icon: "messages" },
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
 * A coach is a guest: they have no work of their own and no engagements of
 * their own, so the worker nav would be mostly dead ends. Worker and admin
 * items above are untouched. The firm archive is firm-internal, so coaches
 * do not see it in the nav and are redirected away if they hit /archive.
 */
export const coachNavGroups: NavGroup[] = [
  { label: "Coaching", items: [{ label: "People you coach", to: "/coaching", icon: "members" }] },
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
 * workspace and just adds its own "Your classes" section after "What you
 * learned". Only the engagement shelves group gets a true school vocabulary
 * swap, because there the underlying concept genuinely differs.
 */
export const eduNavGroups: NavGroup[] = navGroups.flatMap((group) => {
  if (group.id === "learned") {
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

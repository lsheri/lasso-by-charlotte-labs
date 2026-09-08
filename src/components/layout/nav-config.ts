import type { GraphiteIconName } from "@/components/notebook/icons";
import { EDU_VOCAB } from "@/lib/edu-vocab";

export type NavItem = { label: string; to: string; icon: GraphiteIconName };
export type NavGroup = { id?: string; label: string; items: NavItem[]; emptyState?: string };

export const navGroups: NavGroup[] = [
  {
    label: "Connectors",
    items: [{ label: "Where work lives", to: "/connectors", icon: "connectors" }],
  },
  { label: "Work", items: [{ label: "All work & mapping", to: "/work", icon: "work" }] },
  // Pass 138: shipped work is a destination of its own, open to every role.
  { label: "Your organization", items: [{ label: "Past work", to: "/archive", icon: "firm" }] },
  { id: "engagements", label: "Engagements", items: [], emptyState: "No engagements yet" },

  {
    label: "Your work",
    items: [
      { label: "Overview", to: "/overview", icon: "overview" },
      { label: "Reflect", to: "/reflect", icon: "reflect" },

      { label: "Chat library", to: "/ai-record", icon: "ai-record" },
      { label: "1:1 prep", to: "/one-on-one", icon: "one-on-one" },
      // Pass 161: notes written about your work, across every engagement.
      { label: "Notes about your work", to: "/coach-notes", icon: "messages" },
      { label: "Decision log", to: "/decisions", icon: "decisions" },
      { label: "Settings", to: "/settings", icon: "settings" },
    ],
  },
  {
    label: "Admin",
    items: [
      { label: "Firm view", to: "/firm", icon: "firm" },
      { label: "Members", to: "/members", icon: "members" },
    ],
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
 * A school workspace reads the same places under school words, plus its own
 * section. Every other workspace is untouched: navGroups above is unchanged.
 */
export const eduNavGroups: NavGroup[] = navGroups.flatMap((group) => {
  if (group.label === "Your organization") {
    return [
      { ...group, label: EDU_VOCAB.orgGroup },
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

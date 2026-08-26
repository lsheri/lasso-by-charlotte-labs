import type { GraphiteIconName } from "@/components/notebook/icons";

export type NavItem = { label: string; to: string; icon: GraphiteIconName };
export type NavGroup = { label: string; items: NavItem[]; emptyState?: string };

export const navGroups: NavGroup[] = [
  {
    label: "Connectors",
    items: [{ label: "Where work lives", to: "/connectors", icon: "connectors" }],
  },
  { label: "Work", items: [{ label: "All work & mapping", to: "/work", icon: "work" }] },
  { label: "Engagements", items: [], emptyState: "No engagements yet" },
  {
    label: "Your work",
    items: [
      { label: "Overview", to: "/overview", icon: "overview" },
      { label: "Reflect", to: "/reflect", icon: "reflect" },
      { label: "AI record", to: "/ai-record", icon: "ai-record" },
      { label: "1:1 prep", to: "/one-on-one", icon: "one-on-one" },
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
 * items above are untouched.
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

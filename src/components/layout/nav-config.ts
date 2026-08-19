export type NavItem = { label: string; to: string };
export type NavGroup = { label: string; items: NavItem[]; emptyState?: string };

export const navGroups: NavGroup[] = [
  { label: "Connectors", items: [{ label: "Where work lives", to: "/connectors" }] },
  { label: "Work", items: [{ label: "All work & mapping", to: "/work" }] },
  { label: "Engagements", items: [], emptyState: "No engagements yet" },
  {
    label: "Your work",
    items: [
      { label: "Overview", to: "/overview" },
      { label: "Reflect", to: "/reflect" },
      { label: "AI record", to: "/ai-record" },
      { label: "1:1 prep", to: "/one-on-one" },
      { label: "Decision log", to: "/decisions" },
      { label: "Firm view", to: "/firm" },
      { label: "Members", to: "/members" },
      { label: "Settings", to: "/settings" },
    ],
  },
];

/**
 * A coach is a guest: they have no work of their own and no engagements of
 * their own, so the worker nav would be mostly dead ends. Worker and admin
 * items above are untouched.
 */
export const coachNavGroups: NavGroup[] = [
  { label: "Coaching", items: [{ label: "People you coach", to: "/coaching" }] },
  {
    label: "Your account",
    items: [
      { label: "1:1 prep", to: "/one-on-one" },
      { label: "Settings", to: "/settings" },
    ],
  },
];

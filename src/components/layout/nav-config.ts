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
      { label: "1:1 prep", to: "/one-on-one" },
      { label: "Decision log", to: "/decisions" },
      { label: "Settings", to: "/settings" },
    ],
  },
];
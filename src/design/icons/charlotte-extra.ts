/* The 10 glyphs Charlotte drew first. Since PR4b they are shared GraphiteIcon names with a Lasso path each
   (ICON_NAMES is 52); charlotte.ts spreads them into CHARLOTTE_GLYPHS. Same grid and stroke as charlotte.ts. */
import type { ExhibitPath } from "./charlotte";

export const CHARLOTTE_EXTRA_NAMES = [
  "sign-out",
  "pin",
  "lock",
  "trash",
  "edit",
  "link",
  "download",
  "info",
  "bell",
  "submit",
] as const;

export type CharlotteExtraName = (typeof CHARLOTTE_EXTRA_NAMES)[number];

export const CHARLOTTE_EXTRA_GLYPHS: Record<CharlotteExtraName, readonly ExhibitPath[]> = {
  "sign-out": [
    "M8 3.5H4.5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1H8",
    "M12.5 6.5 16 10l-3.5 3.5",
    "M16 10H7.5",
  ],
  pin: ["M7.5 3h5l-1 4.5 3 3H5.5l3-3z", "M10 10.5V17"],
  lock: [
    "M5.5 9h9a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-9a1 1 0 0 1 -1 -1v-6a1 1 0 0 1 1 -1z",
    "M7 9V6.5a3 3 0 0 1 6 0V9",
  ],
  trash: ["M3.5 5.5h13", "M8 5.5v-2h4v2", "M5 5.5l.75 11h8.5l.75-11", "M8.5 8.5v5M11.5 8.5v5"],
  edit: ["M12.5 4 16 7.5 7.5 16H4v-3.5z", "M10.5 6 14 9.5"],
  link: [
    "M8.5 11.5a3 3 0 0 0 4.25 0l2.5-2.5a3 3 0 0 0-4.25-4.25L10 5.75",
    "M11.5 8.5a3 3 0 0 0-4.25 0l-2.5 2.5a3 3 0 0 0 4.25 4.25L10 14.25",
  ],
  download: ["M10 3.5v9", "M6.5 9 10 12.5 13.5 9", "M3.5 16.5h13"],
  info: ["M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0z", "M10 9v4.5", "M10 6.5h.01"],
  bell: ["M5 14V9a5 5 0 0 1 10 0v5l1.5 1.5h-13z", "M8.25 17a2 2 0 0 0 3.5 0"],
  submit: ["M10 16V4.5", "M5.5 9 10 4.5 14.5 9"],
};

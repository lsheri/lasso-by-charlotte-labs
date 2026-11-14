/* Charlotte (Exhibit) glyphs, keyed by the same names as GraphiteIcon. Viewbox 20, stroke 1.5, round caps and joins.
   Ported from the 13 Nov glyph spec (Drive: SPEC 13 Nov, Charlotte glyph map). The spec's RR (rounded rectangle) and
   DOT (circle) helpers are precomputed into literal path strings; a test checks them against the formulas.
   Storybook only until PR4 makes GraphiteIcon skin-aware. A test fences these files out of the app. */
import type { GraphiteIconName } from "@/components/notebook/icons";

/** A path string, or a dashed path (drawn with EXHIBIT_DASH). */
export type ExhibitPath = string | { d: string; dashed: true };

export const EXHIBIT_DASH = "2.1 1.9";
export const EXHIBIT_STROKE = 1.5;

export const CHARLOTTE_GLYPHS: Record<GraphiteIconName, readonly ExhibitPath[]> = {
  connectors: ["M7.5 3v3.5M12.5 3v3.5", "M5 6.5h10v3a5 5 0 0 1-10 0z", "M10 14.5V17"],
  work: ["M10 3.25 17 6.75 10 10.25 3 6.75z", "M3 10.25l7 3.5 7-3.5", "M3 13.75l7 3.5 7-3.5"],
  engagement: [
    "M4.5 3.5h11a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1 -1.5 1.5h-11a1.5 1.5 0 0 1 -1.5 -1.5v-10a1.5 1.5 0 0 1 1.5 -1.5z",
    "M3 7.25h14",
    "M6.5 10.5h2.5M6.5 13.25h2.5M11.5 10.5h2.5",
  ],
  folder: [
    "M3 15.5V5.5a1 1 0 0 1 1-1h3.4L9 6.25h7a1 1 0 0 1 1 1v8.25a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z",
    "M3 8.75h14",
  ],
  workboard: [
    "M4.5 3.5h11a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1 -1.5 1.5h-11a1.5 1.5 0 0 1 -1.5 -1.5v-10a1.5 1.5 0 0 1 1.5 -1.5z",
    "M3 7.25h14",
    "M6.5 10.5h2.5M6.5 13.25h2.5M11.5 10.5h2.5",
  ],
  overview: ["M3.25 9 10 3.5 16.75 9", "M5 7.6v8.9h10V7.6", "M8.5 16.5v-4h3v4"],
  reflect: ["M16 10a6 6 0 1 1-1.76-4.24", "M14.25 2.75v3h-3"],
  "ai-record": ["M4.5 3.5h11v9.5H11l-3 3v-3H4.5z", "M7.5 7h5M7.5 9.75h3"],
  "one-on-one": [
    "M10.5 2.75h6a1 1 0 0 1 1 1v3.25a1 1 0 0 1-1 1H16v1.75L13.75 8H10.5a1 1 0 0 1-1-1V3.75a1 1 0 0 1 1-1z",
    "M3.5 9.5h7a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1H7.25L4.5 17v-2h-1a1 1 0 0 1-1-1v-3.5a1 1 0 0 1 1-1z",
  ],
  decisions: ["M10 17v-4.5L5.5 8V3.5", "M10 12.5 14.5 8V3.5", "M12.75 5.25l1.75-1.75 1.75 1.75"],
  firm: [
    "M4.5 17V3.5h11V17",
    "M3 17h14",
    "M7.5 6.75h1.5M11 6.75h1.5M7.5 9.75h1.5M11 9.75h1.5",
    "M8.75 17v-3.5h2.5V17",
  ],
  members: [
    "M4.75 6.5a2.75 2.75 0 1 0 5.5 0a2.75 2.75 0 1 0 -5.5 0z",
    "M2.75 16.5c.35-2.9 2.1-4.5 4.75-4.5s4.4 1.6 4.75 4.5",
    "M13 4a2.5 2.5 0 0 1 0 5",
    "M14.5 12.2c1.6.35 2.5 1.75 2.75 4.3",
  ],
  settings: [
    "M3 6.5h7M14 6.5h3M3 13.5h3M10 13.5h7",
    "M10 6.5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0z",
    "M6 13.5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0z",
  ],
  "ask-lasso": [
    "M14.6 5.4A6.5 6.5 0 1 0 14.6 14.6",
    "M12.3 7.7A3.25 3.25 0 1 0 12.3 12.3",
    "M10 10h.01",
  ],
  messages: [
    "M4.5 4h11a1 1 0 0 1 1 1v7.5a1 1 0 0 1-1 1H9l-3.5 3v-3h-1a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z",
  ],
  history: ["M4.4 6.75A6.5 6.5 0 1 1 3.5 10", "M3.5 3.75V7h3.25", "M10 6.5V10l2.5 1.75"],
  analyses: [
    "M12 5h5M13 8.5h4M14 12h3",
    "M3.25 7.75a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0z",
    "M9.25 10.25 12 13",
  ],
  send: ["M17 3 3.25 8.5 9 11l2.5 6z", "M9 11l3.5-3.5"],
  attach: ["M13.25 6.5l-5.5 5.5a1.75 1.75 0 0 0 2.5 2.5l5.75-5.75a3.5 3.5 0 0 0-5-5L5.25 9.5"],
  search: ["M4 8.75a4.75 4.75 0 1 0 9.5 0a4.75 4.75 0 1 0 -9.5 0z", "M12.25 12.25 16.5 16.5"],
  plus: ["M10 4v12M4 10h12"],
  close: ["M5 5l10 10M15 5 5 15"],
  "chevron-right": ["M8 4.5l5.5 5.5L8 15.5"],
  "drag-handle": ["M7.5 5.5h.01M12.5 5.5h.01M7.5 10h.01M12.5 10h.01M7.5 14.5h.01M12.5 14.5h.01"],
  check: ["M4 10.5l3.75 3.75L16 6"],
  "external-link": [
    "M9.5 3.5h-5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-5",
    "M12.5 3.5h4v4",
    "M16.5 3.5l-7 7",
  ],
  workstreams: [
    "M4.5 3.5h11a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1 -1.5 1.5h-11a1.5 1.5 0 0 1 -1.5 -1.5v-10a1.5 1.5 0 0 1 1.5 -1.5z",
    "M7.75 3.5v13M12.25 3.5v13",
  ],
  "preview-cards": [
    "M2.5 10S5.25 4.75 10 4.75 17.5 10 17.5 10 14.75 15.25 10 15.25 2.5 10 2.5 10z",
    "M7.5 10a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0z",
  ],
  sticky: [
    "M4.5 3.5h11a1 1 0 0 1 1 1V12L12 16.5H4.5a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1z",
    "M12 16.5V13a1 1 0 0 1 1-1h3.5",
  ],
  "working-from": [
    "M5.5 3h9a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-9a1 1 0 0 1 -1 -1v-12a1 1 0 0 1 1 -1z",
    "M7.5 6.75h5M7.5 9.75h5M7.5 12.75h3",
  ],
  text: ["M4.5 4.5h11M10 4.5v11M7.75 15.5h4.5"],
  grouping: [
    "M15.6 13.4A6.5 6.5 0 1 0 13.4 15.6",
    "M7.5 8.5h.01M12 8h.01M9.75 12h.01",
    "M14.5 14.5l2 2",
  ],
  "example-board": [
    "M3.5 3.5h5.5v5.5H3.5zM11 3.5h5.5v5.5H11zM3.5 11h5.5v5.5H3.5zM11 11h5.5v5.5H11z",
  ],
  share: [
    "M7 9l6-3.5M7 11l6 3.5",
    "M2.75 10a2.25 2.25 0 1 0 4.5 0a2.25 2.25 0 1 0 -4.5 0z",
    "M12.75 5a2.25 2.25 0 1 0 4.5 0a2.25 2.25 0 1 0 -4.5 0z",
    "M12.75 15a2.25 2.25 0 1 0 4.5 0a2.25 2.25 0 1 0 -4.5 0z",
  ],
  fit: ["M3.5 7V3.5H7M13 3.5h3.5V7M16.5 13v3.5H13M7 16.5H3.5V13"],
  expand: ["M12 3.5h4.5V8M16.5 3.5l-5 5M8 16.5H3.5V12M3.5 16.5l5-5"],
  minus: ["M4 10h12"],
  more: ["M4.5 10h.01M10 10h.01M15.5 10h.01"],
  workstream: [
    "M4.5 3.5h11a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1 -1.5 1.5h-11a1.5 1.5 0 0 1 -1.5 -1.5v-10a1.5 1.5 0 0 1 1.5 -1.5z",
    "M5.65 7.5a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0 -2.2 0z",
    "M12.15 7.5a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0 -2.2 0z",
    "M8.9 12.75a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0 -2.2 0z",
    "M8.1 7.5h3.8M7.4 8.7l1.9 2.9M12.6 8.7l-1.9 2.9",
  ],
  section: [
    {
      d: "M4 4.5h12a1 1 0 0 1 1 1v9a1 1 0 0 1 -1 1h-12a1 1 0 0 1 -1 -1v-9a1 1 0 0 1 1 -1z",
      dashed: true,
    },
    "M5.75 7.5h3.5",
  ],
  "draw-workstream": [
    "M6.5 3h7a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1 -1.5 1.5h-7a1.5 1.5 0 0 1 -1.5 -1.5v-11a1.5 1.5 0 0 1 1.5 -1.5z",
    "M5 6.75h10",
    "M7.5 10h5M7.5 13h5",
  ],
  "suggest-workstreams": ["M14.6 5.4A6.5 6.5 0 1 0 14.6 14.6", "M8 8.5h.01M12 8.5h.01M10 12h.01"],
};

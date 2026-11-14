/* Charlotte work-kind glyphs: 12 kinds in 6 families. These will replace the Lucide kind icons in
   src/lib/work-identity.ts in a later PR; here they are Storybook only. Each family maps onto a --t-* token,
   which several --hue-* tokens will share (a token remap, no code change). Those tokens do not exist yet. */
import { CHARLOTTE_GLYPHS, type ExhibitPath } from "./charlotte";

export const KIND_FAMILIES = {
  talk: { label: "Conversation", token: "--t-talk" },
  words: { label: "Words", token: "--t-words" },
  numbers: { label: "Numbers", token: "--t-numbers" },
  slides: { label: "Slides", token: "--t-slides" },
  visual: { label: "Visual", token: "--t-visual" },
  code: { label: "Code", token: "--t-code" },
} as const;

export type KindFamily = keyof typeof KIND_FAMILIES;

export type CharlotteKind = {
  label: string;
  /** Today's kind ids, Lucide icon and hue, from the spec. */
  source: string;
  family: KindFamily;
  d: readonly ExhibitPath[];
};

export const CHARLOTTE_KINDS: readonly CharlotteKind[] = [
  {
    label: "AI thread",
    source: "ai_thread · MessageSquare · slate-blue",
    family: "talk",
    d: [
      "M4.5 4h11a1 1 0 0 1 1 1v7.5a1 1 0 0 1-1 1H9l-3.5 3v-3h-1a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z",
      "M7 7.5h6M7 10h3.5",
    ],
  },
  {
    label: "Message",
    source: "message · MessageSquare (same as AI thread)",
    family: "talk",
    d: CHARLOTTE_GLYPHS.messages,
  },
  {
    label: "Call",
    source: "call · Phone · plum",
    family: "talk",
    d: [
      "M5.25 3.5h2.5l1.25 3.75-1.75 1.25a8.5 8.5 0 0 0 4.25 4.25L12.75 11l3.75 1.25v2.5a1.75 1.75 0 0 1-1.75 1.75A12.5 12.5 0 0 1 3.5 5.25 1.75 1.75 0 0 1 5.25 3.5z",
    ],
  },
  {
    label: "Email",
    source: "email · Mail · cyan",
    family: "talk",
    d: [
      "M3.75 4.5h12.5a1 1 0 0 1 1 1v9a1 1 0 0 1 -1 1h-12.5a1 1 0 0 1 -1 -1v-9a1 1 0 0 1 1 -1z",
      "M3 5.5l7 5.5 7-5.5",
    ],
  },
  {
    label: "Document",
    source: "document, markdown · FileText · sand",
    family: "words",
    d: [
      "M5.5 3h6l4 4v9a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z",
      "M11.5 3v4h4",
      "M7.5 10.5h5M7.5 13.25h5",
    ],
  },
  {
    label: "Research report",
    source: "research_report · BookOpen · indigo",
    family: "words",
    d: [
      "M5.5 3h9a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-9a1 1 0 0 1 -1 -1v-12a1 1 0 0 1 1 -1z",
      "M8 3v5.5l1.5-1 1.5 1V3",
      "M7.5 12h5M7.5 14.5h3",
    ],
  },
  {
    label: "Deck",
    source: "deck · Presentation · clay",
    family: "slides",
    d: [
      "M3 4h14",
      "M4 4v8.5a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5V4",
      "M10 13v2.25",
      "M7 17l3-1.75L13 17",
    ],
  },
  {
    label: "Sheet",
    source: "sheet · Table2 · sage",
    family: "numbers",
    d: [
      "M4.5 3.5h11a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1 -1.5 1.5h-11a1.5 1.5 0 0 1 -1.5 -1.5v-10a1.5 1.5 0 0 1 1.5 -1.5z",
      "M3 7.5h14M3 12h14M8 7.5v9",
    ],
  },
  {
    label: "Image",
    source: "image, svg · ImageIcon · amber",
    family: "visual",
    d: [
      "M4.5 3.5h11a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1 -1.5 1.5h-11a1.5 1.5 0 0 1 -1.5 -1.5v-10a1.5 1.5 0 0 1 1.5 -1.5z",
      "M3 13.5l4-4 3.5 3.5 2-2L17 15",
      "M12 7a1.25 1.25 0 1 0 2.5 0a1.25 1.25 0 1 0 -2.5 0z",
    ],
  },
  {
    label: "Diagram",
    source: "mermaid · Code2 labelled Diagram",
    family: "visual",
    d: ["M3 3.5h5v4H3zM12 3.5h5v4h-5zM12 12.5h5v4h-5z", "M5.5 7.5v7H12", "M8 5.5h4"],
  },
  {
    label: "Code",
    source: "artifact_code, react, html · Code2 · moss",
    family: "code",
    d: ["M7 6 3 10l4 4", "M13 6l4 4-4 4", "M11.25 4.5l-2.5 11"],
  },
  {
    label: "File",
    source: "page, file, other · File · neutral",
    family: "words",
    d: ["M5.5 3h6l4 4v9a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z", "M11.5 3v4h4"],
  },
];

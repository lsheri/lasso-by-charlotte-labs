import type { Register } from "@/lib/register";

export type TourSource = "claude" | "chatgpt" | "gemini" | "drive" | "granola" | "email";

export type TourCard = {
  title: string;
  source: TourSource;
  inSet: boolean;
};

export type TourClaim = {
  text: string;
  sourceCardTitle: string;
};

export type TourChatLink = {
  label: string;
  cardTitle: string;
};

export type TourAct = {
  id: 1 | 2 | 3 | 4 | 5;
  captionPointer: string;
  captionTouch: string;
  why: string;
  files?: readonly string[];
  cards?: readonly TourCard[];
  contextSentence?: string;
  frameTitle?: string;
  question?: string;
  answer?: readonly TourClaim[];
  chatLink?: TourChatLink;
  closingLine?: string;
  primaryActionLabel?: string;
};

const FILES = [
  "Q3 strategy deck.pdf",
  "Discovery call.txt",
  "Pricing model.xlsx",
  "whiteboard.png",
] as const;

const DO_LINES = {
  2: "Click the three cards that go together.",
  3: "Draw a box around them.",
  4: "Click Ask.",
  5: "Click Keep.",
} as const;

export const TOUR_CONTEXT_SENTENCE =
  "Grouped work shares context. When you ask a question of this box, Lasso reads these three and nothing else.";
const CLOSING_LINE = "That is the whole thing. Everything else is more of it.";
const START_LABEL = "Start with my own work";

const STAGE_COPY = {
  skip: "Skip the tour",
  back: "Back",
  stageLabel: "First run tour",
  railLabel: "Tour progress",
} as const;

function acts(
  cards: readonly TourCard[],
  frameTitle: string,
  question: string,
  answer: readonly TourClaim[],
  chatLink: TourChatLink,
): readonly TourAct[] {
  return [
    {
      id: 1,
      captionPointer: "Drag a file onto the board.",
      captionTouch: "Tap a file to put it on the board.",
      why: "Files, AI chats and call transcripts all land here. Lasso keeps each one with a link back to where it came from.",
      files: FILES,
    },
    {
      id: 2,
      captionPointer: DO_LINES[2],
      captionTouch: DO_LINES[2],
      why: "You are deciding which work, AI chats and transcripts share context. They all went into the same final piece of work.",
      cards,
    },
    {
      id: 3,
      captionPointer: DO_LINES[3],
      captionTouch: DO_LINES[3],
      why: `The box is a ${frameTitle === "Workstream" ? "workstream" : frameTitle}. Everything inside it shares context, so a question answers from those pieces and nothing else on the board.`,
      contextSentence: TOUR_CONTEXT_SENTENCE,
      frameTitle,
    },
    {
      id: 4,
      captionPointer: DO_LINES[4],
      captionTouch: DO_LINES[4],
      why: "Lasso reads only what is inside the box, and shows you which piece every part of the answer came from.",
      question,
      answer,
      chatLink,
    },
    {
      id: 5,
      captionPointer: DO_LINES[5],
      captionTouch: DO_LINES[5],
      why: "The answer stays on the board with links back to the chat and the files behind it, so you can open the original months later.",
      closingLine: CLOSING_LINE,
      primaryActionLabel: START_LABEL,
    },
  ];
}

const COMPANY_CARDS = [
  { title: "Q3 strategy deck", source: "drive", inSet: true },
  { title: "Discovery call, 14 Sep", source: "granola", inSet: true },
  { title: "Claude: pricing options", source: "claude", inSet: true },
  { title: "Pricing model v4", source: "drive", inSet: false },
  { title: "Travel receipts", source: "email", inSet: false },
] as const satisfies readonly TourCard[];

const COMPANY_ANSWER = [
  { text: "You floated usage based pricing and dropped it after the discovery call.", sourceCardTitle: "Claude: pricing options" },
  { text: "A phased rollout was discussed on the call and never reached the deck.", sourceCardTitle: "Discovery call, 14 Sep" },
  { text: "The deck kept the tiered option only.", sourceCardTitle: "Q3 strategy deck" },
] as const satisfies readonly TourClaim[];

const PERSONAL_CARDS = [
  { title: "Side project plan", source: "drive", inSet: true },
  { title: "Research notes", source: "drive", inSet: true },
  { title: "ChatGPT: how to price this", source: "chatgpt", inSet: true },
  { title: "Grocery list", source: "drive", inSet: false },
  { title: "Flight confirmation", source: "email", inSet: false },
] as const satisfies readonly TourCard[];

const PERSONAL_ANSWER = [
  { text: "You considered project pricing and dropped it after comparing monthly retainers.", sourceCardTitle: "ChatGPT: how to price this" },
  { text: "The research notes raised a lower entry tier that never reached the final version.", sourceCardTitle: "Research notes" },
  { text: "The final version kept the three-tier offer.", sourceCardTitle: "Side project plan" },
] as const satisfies readonly TourClaim[];

const EDU_CARDS = [
  { title: "Essay draft 2", source: "drive", inSet: true },
  { title: "Lecture notes, week 4", source: "drive", inSet: true },
  { title: "Claude: outline my argument", source: "claude", inSet: true },
  { title: "Reading list", source: "drive", inSet: false },
  { title: "Timetable", source: "email", inSet: false },
] as const satisfies readonly TourCard[];

const EDU_ANSWER = [
  { text: "You considered leading with incentives and dropped that structure from the essay.", sourceCardTitle: "Claude: outline my argument" },
  { text: "A point about informal institutions stayed in the notes but not the essay.", sourceCardTitle: "Lecture notes, week 4" },
  { text: "The essay kept the argument about institutions shaping individual choices.", sourceCardTitle: "Essay draft 2" },
] as const satisfies readonly TourClaim[];

export const TOUR_CONTENT: Readonly<
  Record<Register, { acts: readonly TourAct[]; stage: typeof STAGE_COPY }>
> = {
  company: {
    stage: STAGE_COPY,
    acts: acts(
      COMPANY_CARDS,
      "Workstream",
      "What ideas did I have that did not make the final deck? Give me the link to the AI chat I worked them out in.",
      COMPANY_ANSWER,
      { label: "Open the chat", cardTitle: "Claude: pricing options" },
    ),
  },
  partner: {
    stage: STAGE_COPY,
    acts: acts(
      COMPANY_CARDS,
      "Workstream",
      "What ideas did I have that did not make the final deck? Give me the link to the AI chat I worked them out in.",
      COMPANY_ANSWER,
      { label: "Open the chat", cardTitle: "Claude: pricing options" },
    ),
  },
  personal: {
    stage: STAGE_COPY,
    acts: acts(
      PERSONAL_CARDS,
      "Step",
      "What ideas did I have that did not make the final version? Give me the link to the chat I worked them out in.",
      PERSONAL_ANSWER,
      { label: "Open the chat", cardTitle: "ChatGPT: how to price this" },
    ),
  },
  edu: {
    stage: STAGE_COPY,
    acts: acts(
      EDU_CARDS,
      "Assignment",
      "What points did I drop from the essay? Give me the link to the chat I worked them out in.",
      EDU_ANSWER,
      { label: "Open the chat", cardTitle: "Claude: outline my argument" },
    ),
  },
};
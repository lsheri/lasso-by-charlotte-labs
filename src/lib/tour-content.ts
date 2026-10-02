import type { Register } from "@/lib/register";

export type TourSource = "claude" | "chatgpt" | "drive" | "granola" | "email";

export type TourCard = {
  title: string;
  source: TourSource;
  inSet: boolean;
};

export type TourClaim = {
  text: string;
  sourceCardTitle: string;
};

export type TourAct = {
  id: 1 | 2 | 3 | 4 | 5;
  captionPointer: string;
  captionTouch: string;
  files?: readonly string[];
  cards?: readonly TourCard[];
  contextSentence?: string;
  frameTitle?: string;
  question?: string;
  answer?: readonly TourClaim[];
  closingLine?: string;
  primaryActionLabel?: string;
};

const FILES = [
  "Q3 strategy deck.pdf",
  "Discovery call.txt",
  "Pricing model.xlsx",
  "whiteboard.png",
] as const;

const SHARED_CAPTIONS = {
  2: "Select the three pieces that belong together.",
  3: "Draw a box around them. That is a workstream.",
  4: "Now ask the box a question.",
  5: "Keep it. Now the answer lives next to what it came from.",
} as const;

const CONTEXT_SENTENCE =
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
): readonly TourAct[] {
  return [
    {
      id: 1,
      captionPointer: "Drag the deck onto the board.",
      captionTouch: "Tap the deck to put it on the board.",
      files: FILES,
    },
    {
      id: 2,
      captionPointer: SHARED_CAPTIONS[2],
      captionTouch: SHARED_CAPTIONS[2],
      cards,
    },
    {
      id: 3,
      captionPointer: SHARED_CAPTIONS[3],
      captionTouch: SHARED_CAPTIONS[3],
      contextSentence: CONTEXT_SENTENCE,
      frameTitle,
    },
    {
      id: 4,
      captionPointer: SHARED_CAPTIONS[4],
      captionTouch: SHARED_CAPTIONS[4],
      question,
      answer,
    },
    {
      id: 5,
      captionPointer: SHARED_CAPTIONS[5],
      captionTouch: SHARED_CAPTIONS[5],
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
  { text: "The Q3 strategy deck recommends tiered pricing for the client.", sourceCardTitle: "Q3 strategy deck" },
  { text: "The discovery call records the client's request for a phased starting point.", sourceCardTitle: "Discovery call, 14 Sep" },
  { text: "Claude compared three options and favored a retainer with milestones.", sourceCardTitle: "Claude: pricing options" },
] as const satisfies readonly TourClaim[];

const PERSONAL_CARDS = [
  { title: "Side project plan", source: "drive", inSet: true },
  { title: "Research notes", source: "drive", inSet: true },
  { title: "ChatGPT: how to price this", source: "chatgpt", inSet: true },
  { title: "Grocery list", source: "drive", inSet: false },
  { title: "Flight confirmation", source: "email", inSet: false },
] as const satisfies readonly TourCard[];

const PERSONAL_ANSWER = [
  { text: "The side project plan sets out a three-tier offer.", sourceCardTitle: "Side project plan" },
  { text: "The research notes show comparable services using monthly retainers.", sourceCardTitle: "Research notes" },
  { text: "ChatGPT suggested testing the highest tier first.", sourceCardTitle: "ChatGPT: how to price this" },
] as const satisfies readonly TourClaim[];

const EDU_CARDS = [
  { title: "Essay draft 2", source: "drive", inSet: true },
  { title: "Lecture notes, week 4", source: "drive", inSet: true },
  { title: "Claude: outline my argument", source: "claude", inSet: true },
  { title: "Reading list", source: "drive", inSet: false },
  { title: "Timetable", source: "email", inSet: false },
] as const satisfies readonly TourCard[];

const EDU_ANSWER = [
  { text: "The essay draft argues that institutions shape individual choices.", sourceCardTitle: "Essay draft 2" },
  { text: "The lecture notes explain how incentives influence institutional behavior.", sourceCardTitle: "Lecture notes, week 4" },
  { text: "Claude organized the argument from institutions to incentives to choices.", sourceCardTitle: "Claude: outline my argument" },
] as const satisfies readonly TourClaim[];

export const TOUR_CONTENT: Readonly<
  Record<Register, { acts: readonly TourAct[]; stage: typeof STAGE_COPY }>
> = {
  company: {
    stage: STAGE_COPY,
    acts: acts(
      COMPANY_CARDS,
      "Workstream",
      "What did we tell the client about pricing, and where did that come from?",
      COMPANY_ANSWER,
    ),
  },
  partner: {
    stage: STAGE_COPY,
    acts: acts(
      COMPANY_CARDS,
      "Workstream",
      "What did we tell the client about pricing, and where did that come from?",
      COMPANY_ANSWER,
    ),
  },
  personal: {
    stage: STAGE_COPY,
    acts: acts(
      PERSONAL_CARDS,
      "Step",
      "What did I decide about pricing, and where did I work it out?",
      PERSONAL_ANSWER,
    ),
  },
  edu: {
    stage: STAGE_COPY,
    acts: acts(
      EDU_CARDS,
      "Assignment",
      "What is the argument here, and which source does each part come from?",
      EDU_ANSWER,
    ),
  },
};
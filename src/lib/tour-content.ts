import type { Register } from "@/lib/register";

export type TourSource = "claude" | "chatgpt" | "gemini" | "drive" | "granola" | "email";

export type TourCard = {
  title: string;
  source: TourSource;
  inSet: boolean;
  preview: readonly [string, string];
  layout: { x: number; y: number; rotation: number };
};

export type TourAmbientCard = {
  title: string;
  source: "chatgpt" | "claude" | "gemini";
  excerpt: readonly [string, string];
  layout: { x: number; y: number; rotation: number };
};

export const TOUR_AMBIENT_CARDS: readonly TourAmbientCard[] = [
  { title: "ChatGPT: competitor pricing teardown", source: "chatgpt", excerpt: ["Compared entry tiers and service limits", "Flagged the strongest pricing contrast"], layout: { x: 5, y: 13, rotation: -0.7 } },
  { title: "ChatGPT: objection handling script", source: "chatgpt", excerpt: ["Drafted responses to budget concerns", "Kept the language direct and specific"], layout: { x: 49, y: 8, rotation: 0.8 } },
  { title: "Gemini: market size, 3 scenarios", source: "gemini", excerpt: ["Built low, middle and high cases", "Compared assumptions behind each case"], layout: { x: 10, y: 53, rotation: 0.5 } },
  { title: "Claude: positioning draft", source: "claude", excerpt: ["Explored a sharper category position", "Turned the argument into a draft"], layout: { x: 53, y: 49, rotation: -0.6 } },
] as const;

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
  2: "Click one of the outlined work cards.",
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
      why: "You are telling Lasso which work, AI chats and transcripts share context. These three all went into the same final piece of work.",
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
  { title: "Q3 strategy deck", source: "drive", inSet: true, preview: ["Commercial plan and rollout choices", "Recommendation for the next quarter"], layout: { x: 4, y: 12, rotation: -0.8 } },
  { title: "Discovery call, 14 Sep", source: "granola", inSet: true, preview: ["Client priorities and open questions", "Notes from the pricing discussion"], layout: { x: 31, y: 43, rotation: 0.7 } },
  { title: "Claude: pricing options", source: "claude", inSet: true, preview: ["Compared tiered and usage options", "Outlined tradeoffs for each route"], layout: { x: 48, y: 9, rotation: 0.5 } },
  { title: "Pricing model v4", source: "drive", inSet: false, preview: ["Base case and sensitivity ranges", "Quarterly revenue assumptions"], layout: { x: 6, y: 57, rotation: 0.9 } },
  { title: "Travel receipts", source: "email", inSet: false, preview: ["September travel costs", "Receipts and payment notes"], layout: { x: 59, y: 56, rotation: -0.7 } },
] as const satisfies readonly TourCard[];

const COMPANY_ANSWER = [
  { text: "You floated usage based pricing and dropped it after the discovery call.", sourceCardTitle: "Claude: pricing options" },
  { text: "A phased rollout was discussed on the call and never reached the deck.", sourceCardTitle: "Discovery call, 14 Sep" },
  { text: "The deck kept the tiered option only.", sourceCardTitle: "Q3 strategy deck" },
] as const satisfies readonly TourClaim[];

const PERSONAL_CARDS = [
  { title: "Side project plan", source: "drive", inSet: true, preview: ["Offer shape and launch sequence", "Decisions for the first release"], layout: { x: 4, y: 12, rotation: -0.8 } },
  { title: "Research notes", source: "drive", inSet: true, preview: ["Examples from adjacent products", "Questions to test before launch"], layout: { x: 31, y: 43, rotation: 0.7 } },
  { title: "ChatGPT: how to price this", source: "chatgpt", inSet: true, preview: ["Compared project and monthly prices", "Drafted three possible packages"], layout: { x: 48, y: 9, rotation: 0.5 } },
  { title: "Grocery list", source: "drive", inSet: false, preview: ["Fruit, coffee and rice", "Things to get this week"], layout: { x: 6, y: 57, rotation: 0.9 } },
  { title: "Flight confirmation", source: "email", inSet: false, preview: ["Booking details and departure time", "Return journey confirmation"], layout: { x: 59, y: 56, rotation: -0.7 } },
] as const satisfies readonly TourCard[];

const PERSONAL_ANSWER = [
  { text: "You considered project pricing and dropped it after comparing monthly retainers.", sourceCardTitle: "ChatGPT: how to price this" },
  { text: "The research notes raised a lower entry tier that never reached the final version.", sourceCardTitle: "Research notes" },
  { text: "The final version kept the three-tier offer.", sourceCardTitle: "Side project plan" },
] as const satisfies readonly TourClaim[];

const EDU_CARDS = [
  { title: "Essay draft 2", source: "drive", inSet: true, preview: ["Institutions and individual choices", "Second pass at the central argument"], layout: { x: 4, y: 12, rotation: -0.8 } },
  { title: "Lecture notes, week 4", source: "drive", inSet: true, preview: ["Seminar examples and definitions", "Questions raised in discussion"], layout: { x: 31, y: 43, rotation: 0.7 } },
  { title: "Claude: outline my argument", source: "claude", inSet: true, preview: ["Tested three possible structures", "Connected evidence to each section"], layout: { x: 48, y: 9, rotation: 0.5 } },
  { title: "Reading list", source: "drive", inSet: false, preview: ["Core articles and book chapters", "Reading for the next seminar"], layout: { x: 6, y: 57, rotation: 0.9 } },
  { title: "Timetable", source: "email", inSet: false, preview: ["Classes and submission dates", "Room changes for this term"], layout: { x: 59, y: 56, rotation: -0.7 } },
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
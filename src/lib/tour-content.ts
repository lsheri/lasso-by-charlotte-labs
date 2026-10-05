import type { Register } from "@/lib/register";

export type TourSource = "claude" | "chatgpt" | "gemini" | "drive" | "granola" | "email";

export type TourCard = {
  title: string;
  source: TourSource;
  inSet: boolean;
  preview: readonly [string, string];
};

export type TourAmbientCard = {
  title: string;
  source: "chatgpt" | "claude" | "gemini";
  excerpt: readonly [string, string];
};

export type TourBoardCopy = {
  title: string;
  owner: string;
  pieceCount: number;
  whiteboardTitle: string;
  whiteboardCaption: string;
  deckTitle: string;
};

export type TourLayoutItem = {
  id: `primary-${0 | 1 | 2 | 3 | 4}` | `chat-${0 | 1 | 2 | 3}` | "artifact" | "whiteboard" | "deck" | "answer";
  kind: "primary" | "chat" | "artifact" | "image" | "answer";
  x: number;
  y: number;
  widthBasis: number;
  rotation: number;
  earliestAct: TourActId;
};

/** The sole geometry source for every item on the five-act tour board. */
export const TOUR_BOARD_LAYOUT: readonly TourLayoutItem[] = [
  { id: "primary-0", kind: "primary", x: 3, y: 19, widthBasis: 21, rotation: -0.8, earliestAct: 1 },
  { id: "primary-1", kind: "primary", x: 31, y: 17.5, widthBasis: 22, rotation: 0.7, earliestAct: 1 },
  { id: "primary-2", kind: "primary", x: 60, y: 20.5, widthBasis: 21, rotation: 0.5, earliestAct: 1 },
  { id: "primary-3", kind: "primary", x: 5, y: 44, widthBasis: 18, rotation: 0.9, earliestAct: 1 },
  { id: "primary-4", kind: "primary", x: 6.5, y: 59, widthBasis: 19, rotation: -0.7, earliestAct: 1 },
  { id: "answer", kind: "answer", x: 33, y: 82, widthBasis: 23, rotation: 0, earliestAct: 5 },
  { id: "chat-0", kind: "chat", x: 32, y: 42, widthBasis: 21, rotation: -0.7, earliestAct: 1 },
  { id: "chat-1", kind: "chat", x: 62, y: 44.5, widthBasis: 22, rotation: 0.8, earliestAct: 1 },
  { id: "chat-2", kind: "chat", x: 30, y: 63.5, widthBasis: 22, rotation: 0.5, earliestAct: 1 },
  { id: "chat-3", kind: "chat", x: 61, y: 65.5, widthBasis: 21, rotation: -0.6, earliestAct: 1 },
  { id: "artifact", kind: "artifact", x: 84.5, y: 66, widthBasis: 13, rotation: 0.4, earliestAct: 1 },
  { id: "whiteboard", kind: "image", x: 5, y: 78.5, widthBasis: 18, rotation: -0.4, earliestAct: 1 },
  { id: "deck", kind: "image", x: 72, y: 84, widthBasis: 20, rotation: 0.3, earliestAct: 5 },
] as const;

export const TOUR_AMBIENT_CARDS: readonly TourAmbientCard[] = [
  { title: "ChatGPT: athleisure trend teardown", source: "chatgpt", excerpt: ["Compared fabric and fit trends for fall", "Flagged the strongest growth segment"] },
  { title: "ChatGPT: seeding partner outreach", source: "chatgpt", excerpt: ["Drafted first notes to seeding partners", "Kept the language direct and specific"] },
  { title: "Gemini: city by city demand", source: "gemini", excerpt: ["Sized Austin, Denver and Toronto", "Compared assumptions behind each market"] },
  { title: "Claude: positioning lines", source: "claude", excerpt: ["Explored a sharper category position", "Turned the argument into a draft"] },
] as const;

export function tourAmbientCards(_register: Register): readonly TourAmbientCard[] {
  return TOUR_AMBIENT_CARDS;
}

const BOARD_COPY: TourBoardCopy = {
  title: "Fall Marketing Launch",
  owner: "LYKOS LOUNGEWARE",
  pieceCount: 12,
  whiteboardTitle: "Moodboard photo",
  whiteboardCaption: "Shots from the fabric session",
  deckTitle: "Launch deck, slide 12",
};

export function tourBoardCopy(_register: Register): TourBoardCopy {
  return BOARD_COPY;
}

export type TourClaim = {
  text: string;
  sourceCardTitle: string;
};

export type TourChatLink = {
  label: string;
  cardTitle: string;
};

/** Act slot ids. Wider than today's five acts so acts can be inserted by id. */
export type TourActId = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type TourAct = {
  id: TourActId;
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

const COMPANY_FILES = [
  "Fall launch plan.pdf",
  "Creator call.txt",
  "Media budget.xlsx",
  "moodboard.png",
] as const;

const DO_LINES = {
  2: "Click one of the outlined work cards.",
  3: "Draw a box around them.",
  4: "Click Ask.",
  5: "Click Keep.",
} as const satisfies Partial<Record<TourActId, string>>;

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
  files: readonly string[] = FILES,
): readonly TourAct[] {
  return [
    {
      id: 1,
      captionPointer: "Drag a file onto the board.",
      captionTouch: "Tap a file to put it on the board.",
      why: "Files, AI chats and call transcripts all land here. Lasso keeps each one with a link back to where it came from.",
      files,
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
  { title: "Fall launch plan v3", source: "drive", inSet: true, preview: ["Channel mix, budget split and launch week", "Recommendation for the 29 Sep start"] },
  { title: "ChatGPT: creator brief, draft 2", source: "chatgpt", inSet: true, preview: ["Drafted the brief for seeding partners", "Listed Toronto as a third launch city"] },
  { title: "Claude: channel mix options", source: "claude", inSet: true, preview: ["Compared TikTok first and retail first", "Outlined tradeoffs for each route"] },
  { title: "Creator call, 14 Sep", source: "granola", inSet: false, preview: ["Agency rates and posting cadence", "Which markets they actually cover"] },
  { title: "Sample shipping receipts", source: "email", inSet: false, preview: ["Seeding costs for September", "Receipts and payment notes"] },
] as const satisfies readonly TourCard[];

const COMPANY_ANSWER = [
  { text: "You floated a TikTok first launch and dropped it.", sourceCardTitle: "Claude: channel mix options" },
  { text: "Toronto made the creator brief and never reached the plan.", sourceCardTitle: "ChatGPT: creator brief, draft 2" },
  { text: "The plan kept Austin and Denver only.", sourceCardTitle: "Fall launch plan v3" },
] as const satisfies readonly TourClaim[];

export const TOUR_CONTENT: Readonly<
  Record<Register, { acts: readonly TourAct[]; stage: typeof STAGE_COPY }>
> = {
  company: {
    stage: STAGE_COPY,
    acts: acts(
      COMPANY_CARDS,
      "Workstream",
      "What ideas did I have that did not make the final launch plan? Give me the link to the AI chat I worked them out in.",
      COMPANY_ANSWER,
      { label: "Open the chat", cardTitle: "Claude: channel mix options" },
      COMPANY_FILES,
    ),
  },
  partner: {
    stage: STAGE_COPY,
    acts: acts(
      COMPANY_CARDS,
      "Workstream",
      "What ideas did I have that did not make the final launch plan? Give me the link to the AI chat I worked them out in.",
      COMPANY_ANSWER,
      { label: "Open the chat", cardTitle: "Claude: channel mix options" },
      COMPANY_FILES,
    ),
  },
  personal: {
    stage: STAGE_COPY,
    acts: acts(
      COMPANY_CARDS,
      "Step",
      "What ideas did I have that did not make the final launch plan? Give me the link to the AI chat I worked them out in.",
      COMPANY_ANSWER,
      { label: "Open the chat", cardTitle: "Claude: channel mix options" },
      COMPANY_FILES,
    ),
  },
  edu: {
    stage: STAGE_COPY,
    acts: acts(
      COMPANY_CARDS,
      "Assignment",
      "What ideas did I have that did not make the final launch plan? Give me the link to the AI chat I worked them out in.",
      COMPANY_ANSWER,
      { label: "Open the chat", cardTitle: "Claude: channel mix options" },
      COMPANY_FILES,
    ),
  },
};

/** Look up an act by its id, never by array position. */
export function actById(register: Register, id: TourActId): TourAct | undefined {
  return TOUR_CONTENT[register].acts.find((act) => act.id === id);
}

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
  id: `primary-${0 | 1 | 2 | 3 | 4}` | `chat-${0 | 1 | 2 | 3}` | "artifact" | "whiteboard" | "deck" | "answer" | "deliverable";
  kind: "primary" | "chat" | "artifact" | "image" | "answer" | "deliverable";
  x: number;
  y: number;
  widthBasis: number;
  rotation: number;
  earliestAct: TourActId;
};

/** The sole geometry source for every item on the tour board. */
export const TOUR_BOARD_LAYOUT: readonly TourLayoutItem[] = [
  { id: "primary-0", kind: "primary", x: 3, y: 19, widthBasis: 21, rotation: -0.8, earliestAct: 3 },
  { id: "primary-1", kind: "primary", x: 31, y: 17.5, widthBasis: 22, rotation: 0.7, earliestAct: 3 },
  { id: "primary-2", kind: "primary", x: 60, y: 20.5, widthBasis: 21, rotation: 0.5, earliestAct: 3 },
  { id: "primary-3", kind: "primary", x: 5, y: 44, widthBasis: 18, rotation: 0.9, earliestAct: 3 },
  { id: "primary-4", kind: "primary", x: 6.5, y: 59, widthBasis: 19, rotation: -0.7, earliestAct: 3 },
  { id: "answer", kind: "answer", x: 33, y: 82, widthBasis: 23, rotation: 0, earliestAct: 7 },
  { id: "chat-0", kind: "chat", x: 32, y: 42, widthBasis: 21, rotation: -0.7, earliestAct: 3 },
  { id: "chat-1", kind: "chat", x: 62, y: 44.5, widthBasis: 22, rotation: 0.8, earliestAct: 3 },
  { id: "chat-2", kind: "chat", x: 30, y: 63.5, widthBasis: 22, rotation: 0.5, earliestAct: 3 },
  { id: "chat-3", kind: "chat", x: 61, y: 65.5, widthBasis: 21, rotation: -0.6, earliestAct: 3 },
  { id: "artifact", kind: "artifact", x: 84.5, y: 66, widthBasis: 13, rotation: 0.4, earliestAct: 3 },
  { id: "whiteboard", kind: "image", x: 5, y: 78.5, widthBasis: 18, rotation: -0.4, earliestAct: 3 },
  { id: "deck", kind: "image", x: 72, y: 84, widthBasis: 20, rotation: 0.3, earliestAct: 7 },
  { id: "deliverable", kind: "deliverable", x: 31.5, y: 80, widthBasis: 25, rotation: -0.3, earliestAct: 7 },
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
export type TourActId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type TourChatTurn = {
  role: "user" | "assistant";
  text: string;
};

export type TourPushedChat = {
  title: string;
  source: "claude";
  turns: readonly TourChatTurn[];
  pushLine: string;
  pushLabel: string;
  pushedLabel: string;
};

export type TourConversationList = {
  heading: string;
  arrivedLabel: string;
};

export type TourDeliverable = {
  caption: string;
};

export type TourAct = {
  id: TourActId;
  captionPointer: string;
  captionTouch: string;
  why: string;
  bringIn?: { title: string; source: TourSource };
  chat?: TourPushedChat;
  conversations?: TourConversationList;
  cards?: readonly TourCard[];
  contextSentence?: string;
  frameTitle?: string;
  question?: string;
  answer?: readonly TourClaim[];
  chatLink?: TourChatLink;
  closingLine?: string;
  deliverable?: TourDeliverable;
  primaryActionLabel?: string;
};

const DO_LINES = {
  4: "Click one of the outlined work cards.",
  5: "Draw a box around them.",
  6: "Click Ask.",
  7: "Keep it. Now the answer lives next to what it came from.",
  8: "See the deck connected back to the work.",
} as const satisfies Partial<Record<TourActId, string>>;

export const TOUR_CONTEXT_SENTENCE =
  "Grouped work shares context. When you ask a question of this box, Lasso reads these three and nothing else.";
export const TOUR_PUSHED_CHAT: TourPushedChat = {
  title: "Claude: channel mix options",
  source: "claude",
  turns: [
    { role: "user", text: "Compare TikTok first with retail first for the fall launch." },
    { role: "assistant", text: "Compared TikTok first and retail first. TikTok is faster to test; retail builds presence more slowly." },
    { role: "user", text: "What does each route need from the team?" },
    { role: "assistant", text: "Outlined tradeoffs for each route. TikTok needs creator volume; retail needs samples and store support." },
    { role: "user", text: "Creator rates went up on the call. Does that change it?" },
    { role: "assistant", text: "Yes. A broad TikTok launch now costs more before you know what works." },
    { role: "user", text: "So lead with retail?" },
    { role: "assistant", text: "Lead with retail and keep TikTok as a small test in Austin and Denver." },
  ],
  pushLine: "Push this to Lasso.",
  pushLabel: "Push to Lasso",
  pushedLabel: "Pushed to Lasso",
};

export const TOUR_CONVERSATION_LIST: TourConversationList = {
  heading: "All AI Conversations",
  arrivedLabel: "Just arrived",
};

export const TOUR_DELIVERABLE: TourDeliverable = {
  caption: "The deck is what the client sees. Every line in it can still show the chat or file it came from.",
};

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
      captionPointer: "Push the chat into Lasso.",
      captionTouch: "Push the chat into Lasso.",
      why: "You keep working in the AI tools you already use. One push brings the whole conversation into Lasso, with a link back to where it happened.",
      chat: TOUR_PUSHED_CHAT,
    },
    {
      id: 2,
      captionPointer: "It is already here. You did not have to file it.",
      captionTouch: "It is already here. You did not have to file it.",
      why: "Every chat you push lands in All AI Conversations on its own. Click it to put it to work.",
      conversations: TOUR_CONVERSATION_LIST,
    },
    {
      id: 3,
      captionPointer: "Drag the chat onto the board.",
      captionTouch: "Tap the chat to put it on the board.",
      why: "The chat you just pushed is now yours to place. Files, documents and call transcripts land the same way.",
      bringIn: { title: TOUR_PUSHED_CHAT.title, source: TOUR_PUSHED_CHAT.source },
    },
    {
      id: 4,
      captionPointer: DO_LINES[4],
      captionTouch: DO_LINES[4],
      why: "You are telling Lasso which work, AI chats and transcripts share context. These three all went into the same final piece of work.",
      cards,
    },
    {
      id: 5,
      captionPointer: DO_LINES[5],
      captionTouch: DO_LINES[5],
      why: `The box is a ${frameTitle === "Workstream" ? "workstream" : frameTitle}. Everything inside it shares context, so a question answers from those pieces and nothing else on the board.`,
      contextSentence: TOUR_CONTEXT_SENTENCE,
      frameTitle,
    },
    {
      id: 6,
      captionPointer: DO_LINES[6],
      captionTouch: DO_LINES[6],
      why: "Lasso reads only what is inside the box, and shows you which piece every part of the answer came from.",
      question,
      answer,
      chatLink,
    },
    {
      id: 7,
      captionPointer: DO_LINES[7],
      captionTouch: DO_LINES[7],
      why: "Anything Lasso gives you can be kept on the board as a note. You can come back later and still see what it came from.",
      primaryActionLabel: "See it in the deck",
    },
    {
      id: 8,
      captionPointer: DO_LINES[8],
      captionTouch: DO_LINES[8],
      why: TOUR_DELIVERABLE.caption,
      closingLine: CLOSING_LINE,
      deliverable: TOUR_DELIVERABLE,
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
    ),
  },
};

/** Look up an act by its id, never by array position. */
export function actById(register: Register, id: TourActId): TourAct | undefined {
  return TOUR_CONTENT[register].acts.find((act) => act.id === id);
}

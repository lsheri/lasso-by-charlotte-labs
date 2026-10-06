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
  id: `primary-${0 | 1 | 2 | 3}` | `chat-${0 | 1}` | "artifact" | "whiteboard" | "deck" | "answer" | "deliverable";
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
  { id: "answer", kind: "answer", x: 33, y: 82, widthBasis: 23, rotation: 0, earliestAct: 7 },
  { id: "chat-0", kind: "chat", x: 32, y: 42, widthBasis: 21, rotation: -0.7, earliestAct: 3 },
  { id: "chat-1", kind: "chat", x: 62, y: 44.5, widthBasis: 22, rotation: 0.8, earliestAct: 3 },
  { id: "artifact", kind: "artifact", x: 84.5, y: 66, widthBasis: 13, rotation: 0.4, earliestAct: 3 },
  { id: "whiteboard", kind: "image", x: 5, y: 78.5, widthBasis: 18, rotation: -0.4, earliestAct: 3 },
  { id: "deck", kind: "image", x: 72, y: 84, widthBasis: 20, rotation: 0.3, earliestAct: 3 },
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
  pieceCount: TOUR_BOARD_LAYOUT.filter((item) => item.earliestAct <= 3).length,
  whiteboardTitle: "Austin retail launch page",
  whiteboardCaption: "Store page draft",
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
  source: "claude" | "chatgpt";
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
  companionChat?: TourPushedChat;
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

export const TOUR_CHATGPT_CHAT: TourPushedChat = {
  title: "ChatGPT: launch week checklist",
  source: "chatgpt",
  turns: [
    { role: "user", text: "Make a checklist for launch week." },
    { role: "assistant", text: "Start with store setup, creator posts and daily stock checks." },
    { role: "user", text: "Keep it focused on Austin and Denver." },
    { role: "assistant", text: "I kept both cities and added owners for each handoff." },
    { role: "user", text: "Add a Friday check before the weekend push." },
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
  caption: "Three pieces of work. One slide. The line between them stays.",
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
  register: Register,
  cards: readonly TourCard[],
  frameTitle: string,
  question: string,
  answer: readonly TourClaim[],
  chatLink: TourChatLink,
): readonly TourAct[] {
  return [
    {
      id: 1,
      captionPointer: "Push all of your most important AI Conversations directly to Lasso's inbox.",
      captionTouch: "Push both chats into Lasso, then tap Next.",
      why: "Keep working in whichever AI tool you like. One push brings the whole conversation over, with a link back to where it happened. You can add to your AI conversations and re-push to lasso whenevr you'd like.",
      chat: TOUR_PUSHED_CHAT,
      companionChat: TOUR_CHATGPT_CHAT,
    },
    {
      id: 2,
      captionPointer: "Now that your AI assisted work is in Lasso...Organize it on a workboard",
      captionTouch: "Now that your AI assisted work is in Lasso...Organize it on a workboard",
      why: "All of your most important chats live in Lasso. You can add them to work boards for project/ Homework/ deliverable based organization or find lost conversations with a simple search.",
      conversations: TOUR_CONVERSATION_LIST,
    },
    {
      id: 3,
      captionPointer: "Lasso connects to wherever you work...Drives, Docs, Transcripts, AI chats...All available to organize on work boards.",
      captionTouch: "Tap the Claude chat to put it on the board.",
      why: "Putting work on a board is how you decide what belongs together. Files, documents and call transcripts land here the same way.",
      bringIn: { title: TOUR_PUSHED_CHAT.title, source: TOUR_PUSHED_CHAT.source },
    },
    {
      id: 4,
      captionPointer: "On your board, add groupings to specify which context cards share the same work stream",
      captionTouch: "Tap one of the outlined cards.",
      why: "Lasso can answer from a full board, single piece of work, or grouped works treams. Think of each card as \"context\" for Lasso's AI chat.",
      cards,
    },
    {
      id: 5,
      captionPointer: "Draw a box around the three selected cards.",
      captionTouch: "Tap Add grouping to group the three cards.",
      why: "Three pieces of work that belong to one workstream. Grouped, they answer together, and nothing else on the board gets read.",
      contextSentence: TOUR_CONTEXT_SENTENCE,
      frameTitle,
    },
    {
      id: 6,
      captionPointer: "Click Ask.",
      captionTouch: "Tap Ask.",
      why: "Every line of the answer shows the piece it came from. You can ask this group, one card, or the whole workboard.",
      question,
      answer,
      chatLink,
    },
    {
      id: 7,
      captionPointer: "Click Keep.",
      captionTouch: "Tap Keep.",
      why: "Keep anything Lasso gives you as a note on the board. Months later it still shows the work behind it.",
      primaryActionLabel: "See it in the deck",
    },
    {
      id: 8,
      captionPointer: "See how the deck connects back.",
      captionTouch: "See how the deck connects back.",
      why: "The deck is what the client sees. Every line in it can still point at the chat or file it came from.",
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
      "company",
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
      "partner",
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
      "personal",
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
      "edu",
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

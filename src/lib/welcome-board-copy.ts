import type { OrgType } from "@/lib/org-type";

/**
 * Unit B2. The Home welcome guide, rendered from code. It is Lasso explaining
 * itself and never writes a row. Card copy is founder verbatim.
 */
export type WelcomeCardId =
  | "c1" | "c2" | "c3" | "c4" | "c5" | "c6"
  | "c7" | "c8" | "c9" | "c10" | "c11" | "c12";

export type WelcomeCard = { id: WelcomeCardId; title: string; body: string };
export type WelcomeGroup = { id: string; title: string; cards: readonly WelcomeCard[] };

type Pair = { title: string; body: string };
type ByRegister = Readonly<Record<OrgType, Pair>>;

const shared = (p: Pair): ByRegister => ({ company: p, partner: p, personal: p, edu: p });

const C1: ByRegister = {
  company: { title: "Trace a fact back to its source", body: "Circle any claim in a deliverable and Lasso shows the conversation, the document and the turn it came from. That is the whole product in one gesture." },
  partner: { title: "Trace a fact back to its source", body: "Circle any claim in a deliverable and Lasso shows the conversation, the document and the turn it came from. That is the whole product in one gesture." },
  personal: { title: "Find the chat where you worked it out", body: "You solved it once, in a conversation you cannot find. Lasso keeps those, so next time you are searching your own work instead of starting again." },
  edu: { title: "Keep the chat where the idea came from", body: "The thinking happened in a conversation. Keep it next to the essay it became, so you can show your work without rebuilding it from memory." },
};
const C2: ByRegister = {
  company: { title: "Keep the decisions next to the deliverable", body: "A decision made in a chat and the slide that reflects it usually live in different places. Here they live together, so a year from now the reasoning is still attached." },
  partner: { title: "Keep the decisions next to the deliverable", body: "A decision made in a chat and the slide that reflects it usually live in different places. Here they live together, so a year from now the reasoning is still attached." },
  personal: { title: "Keep the thinking next to the work", body: "The draft and the reasoning behind it belong in the same place. Nothing here asks you to summarise or tidy first." },
  edu: { title: "Put your AI work next to the coursework", body: "The prompts, the drafts and the finished piece sit in one place, under the class they belong to." },
};
const C3: ByRegister = {
  company: { title: "Hand off work with the thinking still attached", body: "When someone picks up your work they get the record, not just the file. That is the difference between a handover and a re-explanation." },
  partner: { title: "Hand off work with the thinking still attached", body: "When someone picks up your work they get the record, not just the file. That is the difference between a handover and a re-explanation." },
  personal: { title: "What you worked out, still there next year", body: "Six months from now you will need the version of you that understood this. It will be here." },
  edu: { title: "A record of how you got there", body: "Not a grade and not a measure of effort. Just the trail of how the work actually happened, kept by you." },
};
const C4 = shared({ title: "Circle a few cards and ask", body: "Select any items on this board, then ask a question about them. Lasso answers from those items only, and shows you which ones it used." });
const C5: ByRegister = {
  company: { title: "Map work to an engagement and a workstream", body: "Nothing is mapped until you map it. Drag an item onto a workstream and it becomes part of that record." },
  partner: { title: "Map work to an engagement and a workstream", body: "Nothing is mapped until you map it. Drag an item onto a workstream and it becomes part of that record." },
  personal: { title: "File work into a project and a step", body: "Nothing is filed until you file it. Drag an item onto a step and it becomes part of that project." },
  edu: { title: "File work into a class and an assignment", body: "Nothing is filed until you file it. Drag an item onto an assignment and it becomes part of that class." },
};
const C6 = shared({ title: "Open the exact turn a claim came from", body: "Every captured conversation keeps its turns in order. Open one and you land on the exact message, not a summary of it." });
const C7 = shared({ title: "Nothing leaves without your yes", body: "No prompt, transcript, document, draft or board leaves your workspace unless you send it. The yes is per item and you can take it back." });
const C8: ByRegister = {
  company: { title: "What a coach sees, and when", body: "A coach sees what you share with them, on the engagement you shared it on. They never see your raw files, and never anything you have not sent." },
  personal: { title: "Invite a coach whenever you want", body: "There is nobody looking at this workspace. If you want a second pair of eyes, you invite them, and you choose what they see." },
  edu: { title: "Share one piece of work when you choose", body: "Sharing is one item at a time, chosen by you, and reversible. Nothing is shared by default." },
  partner: { title: "People join with a link", body: "Each attendee gets their own workspace. You set up the engagement, they choose what to share into it." },
};
const C9: ByRegister = {
  company: { title: "Your organization sees patterns, never your threads", body: "Anything your organization sees is aggregate and floored, so no one person can be read out of it. There is no ranking of people here and no number to ask for." },
  personal: { title: "Nobody reads your threads", body: "Not us, not anyone else. There is no view of this workspace that belongs to someone other than you." },
  edu: { title: "Not your professor, not your school", body: "Your institution has no view into this workspace. Not your drafts, not your prompts, not how long you spent." },
  partner: { title: "You see what people send you, and nothing else", body: "Every attendee owns their own workspace. What arrives on your side is what they chose to send, and they keep all of it when the engagement ends." },
};
const C10 = shared({ title: "Push from Claude or ChatGPT", body: "Set up the connector once, then say \"push this conversation to Lasso\" at the end of a session. The whole conversation arrives. Files it produced land in your inbox for you to place." });
const C11 = shared({ title: "Paste a conversation", body: "For anything without a connector. Paste the thread and it lands here at full fidelity, with its turns intact." });
const C12 = shared({ title: "Upload a file or connect a tool", body: "Drive, Gmail, Granola and meeting transcripts. You pick what comes in, item by item, and nothing arrives on its own." });

export const WELCOME_COPY = {
  guideLabel: "A guide from Lasso. This is not your work.",
  signTitle: "Start here.",
  signBody: "These twelve cards are Lasso, written down. Circle any few of them and ask what they mean. That gesture is the product, and this board is a safe place to try it.",
  hide: "Got it, hide this",
  tryOwn: "Try this with your own work",
  open: "Open",
  close: "Close",
  circle: "Circle",
  circled: "Circled",
  askPlaceholder: "Ask about the circled cards",
  askButton: "Ask",
  askPending: "Thinking",
  defaultQuestion: "What do these mean?",
  answerFailed: "Lasso could not answer just now. Here is what the circled cards say.",
  askHint: "Circle one or more cards first.",
  answerLabel: "Answered from the circled guide cards only",
  answerUsed: "Cards used",
  groups: ["What this is", "How the board works", "What stays yours", "Bring your own work in"] as const,
} as const;

export function welcomeGroups(register: OrgType): readonly WelcomeGroup[] {
  const card = (id: WelcomeCardId, src: ByRegister): WelcomeCard => ({ id, ...src[register] });
  const [g1, g2, g3, g4] = WELCOME_COPY.groups;
  return [
    { id: "what", title: g1, cards: [card("c1", C1), card("c2", C2), card("c3", C3)] },
    { id: "how", title: g2, cards: [card("c4", C4), card("c5", C5), card("c6", C6)] },
    { id: "yours", title: g3, cards: [card("c7", C7), card("c8", C8), card("c9", C9)] },
    { id: "bring", title: g4, cards: [card("c10", C10), card("c11", C11), card("c12", C12)] },
  ];
}

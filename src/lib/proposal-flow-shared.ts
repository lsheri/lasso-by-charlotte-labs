/**
 * 21 Nov 2026, click path cards (Liam: "the click through experience ... opens cards with the proposal steps and send
 * and visuals front and center"). The pure rules of the proposal step card: which steps a person sees, the quiet
 * "Step 2 of 4" marker, and the words. The card reaches the very same server calls as the chat: New proposal's
 * create, the brief read, the lead sheet, and Send the documents. No fee and no person-level number is read here.
 */

import type { DeskProposal } from "./proposal-desk-shared";

/** The steps in order. "done" and "passed" are the card's last word and carry no marker. */
export type FlowStep = "start" | "lead" | "send" | "done" | "brief" | "pass" | "passed";

/**
 * Who sees which steps (the design note: Start a proposal, Pick the lead, Send to the lead). Someone who may pick a
 * lead (an admin or a lead) goes on to pick and ask them; anyone else who may start one stops after Start. Someone who
 * may not start one here (a Member on Home, as in the chat) pastes the brief and passes it to an admin.
 */
export function flowSteps({ mayStart, canPickLead }: { mayStart: boolean; canPickLead: boolean }): FlowStep[] {
  if (!mayStart) return ["brief", "pass"];
  return canPickLead ? ["start", "lead", "send"] : ["start"];
}

/**
 * The marker for a step: its place among the steps the person sees. The lead sheet's ask is the Send step, so a
 * sheet on its ask reads as the step after Pick. None for a closing step, or on a card with one step.
 */
export function flowMarker(step: FlowStep, steps: readonly FlowStep[], asking = false): { n: number; total: number } | null {
  if (steps.length < 2) return null;
  const at = step === "lead" && asking ? "send" : step;
  const i = steps.indexOf(at);
  return i < 0 ? null : { n: i + 1, total: steps.length };
}

/** The step before this one, for the back arrow. None at the start, and none once something was saved. */
export function flowBack(step: FlowStep, steps: readonly FlowStep[], saved: boolean): FlowStep | null {
  if (saved) return null;
  const i = steps.indexOf(step);
  return i > 0 ? steps[i - 1]! : null;
}

/**
 * Whether the send step has anything to do: the proposal has documents, a lead with a login is picked, and some
 * documents are not shared with them yet. Otherwise the card goes straight to its last word.
 */
export function needsSend(proposal: Pick<DeskProposal, "leadDocs" | "contextCount"> | null | undefined): boolean {
  if (!proposal || proposal.contextCount <= 0) return false;
  return proposal.leadDocs === "unsent" || proposal.leadDocs === "more";
}

/** A first name for the copy: the first word of a name, or nothing. */
export function firstWord(name: string | null | undefined): string {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}

export const FLOW_COPY = {
  start: {
    title: "Start a proposal",
    intro: (brand: string) => `Paste the brief or drop the RFP. ${brand} fills in the rest for you to check.`,
    brief: "The brief",
    placeholder: "Paste the email, RFP or notes from the call",
    fill: "Fill in from the brief",
    drop: "Drop the RFP or other documents here",
    filled: (brand: string) => `${brand} filled these in from the brief. Change anything that is wrong.`,
    askLabel: "What they asked for",
    next: "Next: pick the lead",
    start: "Start the proposal",
  },
  brief: {
    title: "Pass on a brief",
    /** A Member: admins and leads start proposals, so the brief goes to them. */
    passIntro: "Paste the client's brief. Admins and leads start proposals, so you can pass it to them from here.",
    label: "The brief",
    placeholder: "Paste the email, RFP or notes from the call",
    tooShort: "Paste a little more of the brief.",
    next: "Next: who to tell",
  },
  lead: {
    title: "Pick the lead",
  },
  send: {
    title: (first: string) => (first ? `Send ${first} the documents` : "Send the lead the documents"),
    to: "To",
    goes: (count: number) => (count === 1 ? "What goes" : `What goes (${count})`),
    countOnly: (count: number) => (count === 1 ? "1 document" : `${count} documents`),
    send: "Send",
    later: "Not now",
    sent: (first: string) => (first ? `${first} can open them on their Home now.` : "The lead can open them on their Home now."),
  },
  done: {
    title: (client: string) => (client ? `${client} is on Proposals` : "The proposal is on Proposals"),
    intro: (goal: number) => `The ${goal} hour clock is running.`,
    lead: "Lead",
    noLead: "Not picked yet",
    documents: "Documents",
    sent: (first: string) => (first ? `Sent to ${first}` : "Sent to the lead"),
    notSent: "Not sent yet",
    none: "None yet",
    due: "Due",
    open: "Open it on Proposals",
    close: "Done",
  },
  pass: {
    title: "Pass the brief to an admin",
  },
  passed: {
    title: "Passed on",
    close: "Done",
  },
} as const;

/** Home's quiet way in, by who may start a proposal. */
export const HOME_START_COPY = {
  start: { line: "Got a new brief? Start the proposal here.", button: "Start a proposal" },
  pass: { line: "Got a brief from a client? Pass it to an admin.", button: "Pass on a brief" },
} as const;

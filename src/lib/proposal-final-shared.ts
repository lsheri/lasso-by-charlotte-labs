/**
 * 21 Nov 2026, chat pill PR 4c (D-97): the Lead decides the final proposal. The final is one document: a file the
 * Lead uploads, a draft made from the desk proposal's brief and sent documents (no board needed), or one of the
 * documents the owner sent. Each choice is a new row and the latest counts, so the Admin later approves exactly what
 * the Lead chose. The pure rules and words.
 *
 * Floors: only the proposal's linked Lead (or the person who started it) chooses, on an open proposal. A document
 * counts only if it is the chooser's own work, or one of this proposal's documents they may open. A draft's model
 * never reads a fee or another client's name (the draft engine's own rule), and figures are removed from it.
 */

export type FinalSource = "upload" | "draft" | "document";

/** The latest final, as the Lead sees it. Where it came from is only counted in the event, never stored. */
export type FinalView = { itemId: string; title: string; chosenAt: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id = (value: unknown): string | null => (typeof value === "string" && UUID.test(value.trim()) ? value.trim().toLowerCase() : null);
type Loose = Record<string, unknown> | null | undefined;

export type ChooseFinalInput = { profile_id: string | null; proposal_id: string; work_item_id: string; source: FinalSource };
export function chooseFinalInput(raw: unknown): ChooseFinalInput {
  const value = raw as Loose;
  const proposal = id(value?.["proposal_id"]);
  const item = id(value?.["work_item_id"]);
  const source = value?.["source"];
  if (!proposal || !item || (source !== "upload" && source !== "draft" && source !== "document")) throw new Error(FINAL_COPY.failed);
  return { profile_id: id(value?.["profile_id"]), proposal_id: proposal, work_item_id: item, source };
}
export type ChooseFinalResult = { ok: true; final: FinalView } | { ok: false; problem: string };

export type DraftFinalInput = { profile_id: string | null; proposal_id: string };
export function draftFinalInput(raw: unknown): DraftFinalInput {
  const value = raw as Loose;
  const proposal = id(value?.["proposal_id"]);
  if (!proposal) throw new Error(FINAL_COPY.draftFailed);
  return { profile_id: id(value?.["profile_id"]), proposal_id: proposal };
}
export type DraftFinalResult = { ok: true; itemId: string; title: string; gaps: number; questions: number } | { ok: false; problem: string };

/** The draft's title: plain, short, and never more than the proposal's own name. */
export function draftTitle(proposalTitle: string): string {
  return `Proposal draft: ${proposalTitle.replace(/\s+/g, " ").trim()}`.slice(0, 200);
}

export const FINAL_COPY = {
  heading: "Final proposal",
  none: "No final proposal chosen yet. Upload it, draft it from the brief, or use one of the documents.",
  chosen: (title: string, day: string) => `${title}, chosen ${day}`,
  upload: "Upload the final",
  uploading: "Uploading",
  draft: "Draft it from the brief",
  drafting: "Drafting from the brief and the documents",
  draftReady: (title: string) => `${title} is in your work.`,
  draftGaps: (gaps: number, questions: number) =>
    `${gaps === 0 ? "Every section has something" : `${gaps} ${gaps === 1 ? "section needs" : "sections need"} your words`}. ${questions} ${questions === 1 ? "question" : "questions"} to answer before it goes out.`,
  useDraft: "Use this draft as the final",
  useDocument: (title: string) => `Use ${title} as the final`,
  use: "Use as final",
  changed: "Final proposal chosen. Choosing again replaces it; the earlier choice stays in the record.",
  notLead: "Only the proposal's lead can choose its final version.",
  closed: "This proposal is already decided.",
  notYours: "That document is not yours to choose, or it is not on this proposal.",
  noBrief: "There is nothing to draft from yet: no brief and no documents sent to you.",
  notReady: "Choosing the final works once the latest database update is in.",
  failed: "That could not be saved. Nothing changed. Try again in a moment.",
  draftFailed: "The draft did not come back. Nothing was saved. Try again in a moment.",
  uploadFailed: (reason: string) => `The file did not upload: ${reason}`,
} as const;

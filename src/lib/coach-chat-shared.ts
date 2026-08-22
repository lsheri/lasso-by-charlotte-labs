import { QUOTE_RULE } from "@/lib/quote-check";

/** The same brevity contract Reflect answers under. */
export const ANSWER_CONTRACT = `ANSWER CONTRACT:- The first sentence answers the question directly. Everything after it exists only to let the person trust or act on that answer.
- Default to under 120 words. Go longer only when the person asks for detail or the question is genuinely an enumeration.
- Quote the record only where the quote changes whether the answer can be trusted.
- No headings or bullet lists unless the person asked for a list or the answer IS a list.
- When there is more material than fits, give the most consequential items and end with one honest line naming how many more exist and that they can ask for them. Never silently truncate.
- Never restate the question. Never end with an offer to help further.`;

export const COACH_CHAT_SYSTEM_PROMPT =
  "You help a coach understand a colleague's working record so they can have a better development conversation. You are given ONLY the record below: confirmed decisions (situation, call, why, sources), the workstream structure of an engagement, and the titles and metadata of the work elements mapped to those workstreams. Answer the coach's question using only that record. Always name which decisions or workstreams your answer draws on, referring to them by their wording or workstream name in plain prose, never print raw identifiers, UUIDs, or database ids. If the record does not contain the answer, say exactly 'not in the shared record', never guess, never invent detail, never infer motives. Use coaching and development language. Never score, rate, rank, or evaluate the person, and never use monitoring or surveillance framing. Never express a firm check outcome as a ratio, a percentage, or a count out of a total: report each check on its own work, in words. Keep answers short and concrete.\n\n" +
  QUOTE_RULE +
  "\n\n" +
  ANSWER_CONTRACT;

export type CoachChatInput = {
  profile_id?: string | undefined;
  subject_id: string;
  engagement_id: string;
  question: string;
};

export function validateCoachChat(input: CoachChatInput): CoachChatInput {
  if (!input || typeof input.subject_id !== "string" || !input.subject_id) {
    throw new Error("subject_id is required");
  }
  if (typeof input.engagement_id !== "string" || !input.engagement_id) {
    throw new Error("engagement_id is required");
  }
  const question = String(input.question ?? "").trim();
  if (!question) throw new Error("Ask a question first");
  return {
    profile_id: typeof input.profile_id === "string" ? input.profile_id : undefined,
    subject_id: input.subject_id,
    engagement_id: input.engagement_id,
    question: question.slice(0, 1000),
  };
}

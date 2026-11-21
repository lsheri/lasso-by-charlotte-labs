/**
 * 21 Nov 2026, chat pill Phase 5 (D-97): the approval loop. The Lead sends the final version for approval; an Admin
 * approves it or asks for changes with one short note. Approving marks the proposal as gone to the client: "Waiting on
 * the client" is worked out here from rows (approved, sent, still open), never a new status. The pure rules and words.
 *
 * Rules (Liam, Phase 5): only admins approve, by any button or direct call. An admin who leads the proposal cannot
 * approve their own request; a second admin must, and with only one admin the app says so plainly. One open request
 * per proposal. A request for a version the Lead has since replaced is refused. A lost or won proposal cannot be
 * approved. Until texts are approved by the carrier, the approval shows in the app only. Nobody sees how long anyone
 * took, and no person is scored.
 */

export type ApprovalDecision = "approved" | "changes_asked" | "withdrawn";
export type ApprovalState = "waiting" | ApprovalDecision;

/** The latest request on a proposal, as people who may see it read it. */
export type ApprovalView = {
  id: string;
  state: ApprovalState;
  requestedBy: string;
  requestedAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  /** The note to the Lead, with changes asked. */
  note: string | null;
  /** The final version the request was for. */
  finalItemId: string;
  finalTitle: string;
  /** The Lead has chosen a newer final since this request. */
  stale: boolean;
};

/** Where a proposal stands in the loop. */
export type ProposalStage = "final_needed" | "ready_to_send" | "awaiting_approval" | "changes_asked" | "client_review" | "decided";

export function proposalStage(input: { status: string; sentAt: string | null; hasFinal: boolean; approval: Pick<ApprovalView, "state" | "stale"> | null }): ProposalStage {
  if (input.status !== "open") return "decided";
  const approval = input.approval;
  if (approval?.state === "approved" && input.sentAt) return "client_review";
  if (approval?.state === "waiting") return "awaiting_approval";
  if (approval?.state === "changes_asked") return "changes_asked";
  return input.hasFinal ? "ready_to_send" : "final_needed";
}

/** Who may decide a request: an admin who is not this proposal's lead. */
export function mayDecide(role: string | null | undefined, leadsIt: boolean): boolean {
  return role === "admin" && !leadsIt;
}

export const APPROVAL_NOTE_MAX = 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id = (value: unknown): string | null => (typeof value === "string" && UUID.test(value.trim()) ? value.trim().toLowerCase() : null);
type Loose = Record<string, unknown> | null | undefined;

export type ApprovalAskInput = { profile_id: string | null; proposal_id: string; withdraw: boolean };
export function approvalAskInput(raw: unknown): ApprovalAskInput {
  const value = raw as Loose;
  const proposal = id(value?.["proposal_id"]);
  if (!proposal) throw new Error(APPROVAL_COPY.failed);
  return { profile_id: id(value?.["profile_id"]), proposal_id: proposal, withdraw: value?.["withdraw"] === true };
}

export type ApprovalDecideInput = { profile_id: string | null; proposal_id: string; approval_id: string; decision: "approved" | "changes_asked"; note: string | null };
export function approvalDecideInput(raw: unknown): ApprovalDecideInput {
  const value = raw as Loose;
  const proposal = id(value?.["proposal_id"]);
  const approval = id(value?.["approval_id"]);
  const decision = value?.["decision"];
  if (!proposal || !approval || (decision !== "approved" && decision !== "changes_asked")) throw new Error(APPROVAL_COPY.failed);
  const note = typeof value?.["note"] === "string" ? (value["note"] as string).replace(/\s+/g, " ").trim().slice(0, APPROVAL_NOTE_MAX) : "";
  return { profile_id: id(value?.["profile_id"]), proposal_id: proposal, approval_id: approval, decision, note: note || null };
}

export type ApprovalResult = { ok: true } | { ok: false; problem: string };
export type ApprovalFinalInput = { profile_id: string | null; proposal_id: string };
export function approvalFinalInput(raw: unknown): ApprovalFinalInput {
  const value = raw as Loose;
  const proposal = id(value?.["proposal_id"]);
  if (!proposal) throw new Error(APPROVAL_COPY.failed);
  return { profile_id: id(value?.["profile_id"]), proposal_id: proposal };
}

export const APPROVAL_COPY = {
  send: "Send for approval",
  sending: "Sending",
  withdraw: "Take it back",
  waitingLead: "Sent for approval. An admin approves it or asks for changes.",
  changesAsked: (by: string, note: string | null) => `${by || "An admin"} asked for changes${note ? `: "${note}"` : "."}`,
  approvedLead: "Approved. It is now waiting on the client.",
  needsFinal: "Choose the final proposal first, then send it for approval.",
  // Admin side.
  request: (lead: string, title: string) => `${lead || "The lead"} sent the final for approval: ${title || "the final version"}`,
  openFinal: "Open the final",
  approve: "Approve",
  askChanges: "Ask for changes",
  note: "A short note to the lead (optional)",
  sendNote: "Send the note",
  cancel: "Cancel",
  approved: (by: string) => `Approved by ${by || "an admin"}. Waiting on the client.`,
  /** Until the carrier approves texts, nothing is texted (Liam, Phase 6). */
  textLater: (lead: string) => `${lead || "The lead"} will get a text once texts are approved. For now they see it in the app.`,
  stale: (lead: string) => `${lead || "The lead"} has chosen a newer final since sending this. Ask them to send it again.`,
  ownRequest: "You lead this proposal, so a second admin approves it.",
  onlyAdmin: "You lead this proposal and are the only admin, so nobody can approve it here yet. Add a second admin, or pick another lead.",
  adminsOnly: "Only an admin can approve a proposal.",
  notLead: "Only the proposal's lead or the person who started it can send it for approval.",
  already: "It is already waiting for approval.",
  gone: "That request is no longer waiting. Reload to see where it stands.",
  closed: "This proposal is already decided.",
  notReady: "Approvals work once the latest database update is in.",
  failed: "That could not be saved. Nothing changed. Try again in a moment.",
  /** The stage line on the Lead's row and in the pill. */
  stage: {
    final_needed: "Next: choose the final proposal",
    ready_to_send: "Next: send it for approval",
    awaiting_approval: "Waiting for approval",
    changes_asked: "Changes asked",
    client_review: "Waiting on the client",
    decided: "Decided",
  } satisfies Record<ProposalStage, string>,
} as const;

/** An approval row as stored. */
export type ApprovalRow = {
  id: string;
  proposal_id: string;
  final_version_id: string;
  requested_by: string | null;
  requested_at: string;
  decision: string | null;
  decided_by: string | null;
  decided_at: string | null;
  note: string | null;
};

/**
 * The latest request per proposal as people read it. `finals` holds each proposal's final versions, newest first;
 * a request is stale when its version is no longer the newest. Names and titles come from maps the server read.
 */
export function approvalViews(
  rows: readonly ApprovalRow[],
  finals: ReadonlyMap<string, readonly { id: string; work_item_id: string }[]>,
  titles: ReadonlyMap<string, string>,
  names: ReadonlyMap<string, string>,
): Map<string, ApprovalView> {
  const views = new Map<string, ApprovalView>();
  const sorted = [...rows].sort((a, b) => b.requested_at.localeCompare(a.requested_at));
  for (const row of sorted) {
    if (views.has(row.proposal_id)) continue;
    const versions = finals.get(row.proposal_id) ?? [];
    const version = versions.find((entry) => entry.id === row.final_version_id);
    const state: ApprovalState =
      row.decision === "approved" || row.decision === "changes_asked" || row.decision === "withdrawn" ? row.decision : "waiting";
    views.set(row.proposal_id, {
      id: row.id,
      state,
      requestedBy: (row.requested_by && names.get(row.requested_by)) || "",
      requestedAt: row.requested_at,
      decidedBy: row.decided_by ? (names.get(row.decided_by) ?? "") : null,
      decidedAt: row.decided_at,
      note: row.note,
      finalItemId: version?.work_item_id ?? "",
      finalTitle: version ? (titles.get(version.work_item_id) ?? "") : "",
      stale: versions.length > 0 && versions[0]!.id !== row.final_version_id,
    });
  }
  return views;
}

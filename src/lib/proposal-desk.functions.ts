import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  boardInput,
  closeInput,
  deskListInput,
  deskProfileInput,
  goalInput,
  type BoardWin,
  type CloseResult,
  type GoalResult,
  leadInput,
  newProposalInput,
  sentInput,
  winInput,
  type DeskClient,
  type DeskList,
  type LeadResult,
  type NewProposalResult,
  type SentResult,
  type WinResult,
} from "@/lib/proposal-desk-shared";

/**
 * 20 Nov 2026, the Proposal Desk's server functions. Each is requireSupabaseAuth, then its handler in
 * proposal-desk.server.ts, which starts with requireFirmMember (an active member of a company workspace, never a
 * coach or a guest). No flag sits in front of the page. The handlers live in the server file so they can be tested.
 */

/** The dashboard: the proposals this person may see, and the workspace's turnaround goal. */
export const listProposalsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { profile_id?: string | null; day_start?: string }) => deskListInput(input))
  .handler(async ({ data, context }): Promise<DeskList> => (await import("./proposal-desk.server")).deskHandlers.list(context, data));

/** The clients a new proposal can be for. */
export const listProposalClientsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(deskProfileInput)
  .handler(async ({ data, context }): Promise<DeskClient[]> => (await import("./proposal-desk.server")).deskHandlers.clients(context, data));

/** Starts a proposal: a row, its client and its context documents. No board is made. */
export const createProposalFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(newProposalInput)
  .handler(async ({ data, context }): Promise<NewProposalResult> => (await import("./proposal-desk.server")).deskHandlers.create(context, data));

/** Marks an open proposal as gone out to the client, or takes that back. The owner, an admin or a lead. */
export const setProposalSentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(sentInput)
  .handler(async ({ data, context }): Promise<SentResult> => (await import("./proposal-desk.server")).deskHandlers.sent(context, data));

/** Picks or clears a proposal's lead from the roster. An admin or a lead. Sends nothing. */
export const setProposalLeadFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(leadInput)
  .handler(async ({ data, context }): Promise<LeadResult> => (await import("./proposal-desk.server")).deskHandlers.lead(context, data));

/** Records the win: makes the team board with the context documents first. Only the person who started the proposal. */
export const winProposalFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(winInput)
  .handler(async ({ data, context }): Promise<WinResult> => (await import("./proposal-desk.server")).deskHandlers.win(context, data));

/** Closes an open proposal as lost, or archives one made by mistake. Makes no board and deletes nothing. */
export const closeProposalFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(closeInput)
  .handler(async ({ data, context }): Promise<CloseResult> => (await import("./proposal-desk.server")).deskHandlers.close(context, data));

/** Saves the workspace's turnaround goal. An admin; touches that one setting and no other. */
export const setProposalGoalFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(goalInput)
  .handler(async ({ data, context }): Promise<GoalResult> => (await import("./proposal-desk.server")).deskHandlers.goal(context, data));

/** What the strip at the top of a board made by a win says: won, when, the lead's name and their answer. */
export const boardWinFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(boardInput)
  .handler(async ({ data, context }): Promise<BoardWin> => (await import("./proposal-desk.server")).deskHandlers.boardWin(context, data));

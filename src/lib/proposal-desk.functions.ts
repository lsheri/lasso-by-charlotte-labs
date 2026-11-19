import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  deskProfileInput,
  newProposalInput,
  type DeskClient,
  type DeskList,
  type NewProposalResult,
} from "@/lib/proposal-desk-shared";

/**
 * 20 Nov 2026, the Proposal Desk's server functions. Each is requireSupabaseAuth, then its handler in
 * proposal-desk.server.ts, which starts with requireFirmMember (an active member of a company workspace, never a
 * coach or a guest). No flag sits in front of the page. The handlers live in the server file so they can be tested.
 */

/** The dashboard: the proposals this person may see, and the workspace's turnaround goal. */
export const listProposalsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(deskProfileInput)
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

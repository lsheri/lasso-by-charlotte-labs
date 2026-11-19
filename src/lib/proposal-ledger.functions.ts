import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ledgerBoardInput,
  ledgerProfileInput,
  ledgerShownInput,
  ledgerStepInput,
  ledgerValueInput,
  type BoardValueSoFar,
  type FirmValueSoFar,
  type StepResult,
  type ValueResult,
} from "@/lib/proposal-ledger-shared";

/**
 * 19 Nov, Firm Brain Build Spec step 9: the proposal ledger's server functions. Each one is requireSupabaseAuth, then
 * its handler in proposal-ledger.server.ts, which starts with requireFirmMember (an active member of a company
 * workspace, never a coach or a guest) and then its own checks. No flag sits in front of the screens. The
 * handlers live in the server file so they can be tested: the build rewrites the functions in this file into stubs.
 */

/** This proposal's "Value so far". Read with the caller's own client, so the database decides the rows. */
export const boardValueSoFar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(ledgerBoardInput)
  .handler(async ({ data, context }): Promise<BoardValueSoFar> => (await import("./proposal-ledger.server")).ledgerHandlers.boardValueSoFar(context, data));

/** The firm's "Proposals: value so far", for admins and leads, across boards shared with the firm. */
export const firmValueSoFar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(ledgerProfileInput)
  .handler(async ({ data, context }): Promise<FirmValueSoFar> => (await import("./proposal-ledger.server")).ledgerHandlers.firmValueSoFar(context, data));

/** Records or corrects one dated step (brief, questions sent, answers back, sent to client, won, lost). */
export const recordProposalStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(ledgerStepInput)
  .handler(async ({ data, context }): Promise<StepResult> => (await import("./proposal-ledger.server")).ledgerHandlers.recordProposalStep(context, data));

/** Takes back a step a person recorded. */
export const removeProposalStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(ledgerStepInput)
  .handler(async ({ data, context }): Promise<{ ok: true } | { ok: false; problem: string }> => (await import("./proposal-ledger.server")).ledgerHandlers.removeProposalStep(context, data));

/** Sets or removes the proposal's value. Admins and leads only; the amount is parsed by code. */
export const setProposalValue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(ledgerValueInput)
  .handler(async ({ data, context }): Promise<ValueResult> => (await import("./proposal-ledger.server")).ledgerHandlers.setProposalValue(context, data));

/** After a proposal deliverable is marked Shown to client: copies that stored date into the ledger, once. */
export const noteProposalShown = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(ledgerShownInput)
  .handler(async ({ data, context }): Promise<{ recorded: boolean }> => (await import("./proposal-ledger.server")).ledgerHandlers.noteProposalShown(context, data));

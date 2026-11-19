import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  validateBoardInput,
  validateExemplarInput,
  validatePinInput,
  validateProfileInput,
  type CommonQuestion,
  type ExemplarWrite,
  type ReadingList,
  type ReadingWrite,
} from "@/lib/manager-tools-shared";

/**
 * 19 Nov, Firm Brain Build Spec step 8: manager tools. Each function is signed in (the middleware), validated, and
 * then handed to its call in manager-tools.server.ts, which runs the firm member gate (an active member of a company
 * workspace, never a coach or a guest) and the role rule before anything is read or written. The company-brain flag
 * only hides the screens.
 */

/** A board's reading list, cut to engagements this reader may see. Never says who pinned. */
export const readingListFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateBoardInput)
  .handler(async ({ data, context }): Promise<ReadingList> => (await import("./manager-tools.server")).readingListCall(context, data));

/** Pins a shared engagement to a board: admins, leads, and the board's owner on their own board. */
export const pinReadingThreadFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validatePinInput)
  .handler(async ({ data, context }): Promise<ReadingWrite> => (await import("./manager-tools.server")).pinReadingThreadCall(context, data));

export const unpinReadingThreadFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validatePinInput)
  .handler(async ({ data, context }): Promise<ReadingWrite> => (await import("./manager-tools.server")).unpinReadingThreadCall(context, data));

/** Marks work on a shared board as an exemplar: admins and leads only. */
export const markExemplarFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateExemplarInput)
  .handler(async ({ data, context }): Promise<ExemplarWrite> => (await import("./manager-tools.server")).markExemplarCall(context, data));

export const unmarkExemplarFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateExemplarInput)
  .handler(async ({ data, context }): Promise<ExemplarWrite> => (await import("./manager-tools.server")).unmarkExemplarCall(context, data));

/** What people ask the firm, as fixed labels and bands, for admins and leads. */
export const commonQuestionKindsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateProfileInput)
  .handler(async ({ data, context }): Promise<CommonQuestion[]> => (await import("./manager-tools.server")).commonQuestionKindsCall(context, data));

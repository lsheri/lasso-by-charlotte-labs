import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  blurbInput,
  experienceReadInput,
  fileInput,
  uploadFinishInput,
  uploadStartInput,
  type ExperienceResult,
  type ExperienceSummary,
  type OpenResult,
  type UploadTicket,
} from "@/lib/roster-experience-shared";
import { rosterListInput } from "@/lib/roster-shared";

/**
 * 20 Nov 2026 (Liam, D-86): experience on a person from People we work with. Each function is requireSupabaseAuth,
 * then its handler in roster-experience.server.ts, which starts with requireFirmMember (an active member of a company
 * workspace, never a coach or a guest) and then asks for an admin or a lead. Nothing here records an event.
 */

export const readExperienceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(experienceReadInput)
  .handler(async ({ data, context }): Promise<ExperienceResult> => (await import("./roster-experience.server")).experienceHandlers.read(context as never, data));

export const saveExperienceBlurbFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(blurbInput)
  .handler(async ({ data, context }): Promise<ExperienceResult> => (await import("./roster-experience.server")).experienceHandlers.saveBlurb(context as never, data));

/** Step one of adding a document: a one-time upload address for a path the server chose. */
export const startExperienceUploadFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(uploadStartInput)
  .handler(async ({ data, context }): Promise<UploadTicket> => (await import("./roster-experience.server")).experienceHandlers.startUpload(context as never, data));

/** Step two: the file arrived, so it is listed on the person. */
export const finishExperienceUploadFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(uploadFinishInput)
  .handler(async ({ data, context }): Promise<ExperienceResult> => (await import("./roster-experience.server")).experienceHandlers.finishUpload(context as never, data));

export const removeExperienceFileFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(fileInput)
  .handler(async ({ data, context }): Promise<ExperienceResult> => (await import("./roster-experience.server")).experienceHandlers.removeFile(context as never, data));

/** A one-minute link to read one document. */
export const openExperienceFileFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(fileInput)
  .handler(async ({ data, context }): Promise<OpenResult> => (await import("./roster-experience.server")).experienceHandlers.openFile(context as never, data));

/** Every person's blurb and document count, for the People list and the lead picker. Empty for anyone else. */
export const listExperienceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(rosterListInput)
  .handler(async ({ data, context }): Promise<Record<string, ExperienceSummary>> => (await import("./roster-experience.server")).experienceHandlers.summaries(context as never, data));

/**
 * A Postgres update that no policy allows returns zero rows and no error. That
 * reads as success everywhere unless the caller asks for the rows back and
 * treats an empty result as the refusal it is. Every user facing rename runs
 * through here, so a save that changed nothing can never be reported as saved.
 */

export type UpdateResult = { data: unknown[] | null; error: { message: string } | null };

export type SaveOutcome = { ok: true } | { ok: false; message: string };

export const ENGAGEMENT_RENAME_REFUSAL =
  "That did not save. Only someone on this engagement can rename it.";

export const WORKSTREAM_RENAME_REFUSAL =
  "That did not save. Only the owner of this workstream can rename it.";

export const CLIENT_RENAME_REFUSAL =
  "That did not save. Only someone in this workspace can rename a client.";

/** Zero rows back is a refusal, never a success, and never a telemetry event. */
export function saveOutcome(result: UpdateResult, refusal: string): SaveOutcome {
  if (result.error) return { ok: false, message: result.error.message };
  if ((result.data ?? []).length === 0) return { ok: false, message: refusal };
  return { ok: true };
}

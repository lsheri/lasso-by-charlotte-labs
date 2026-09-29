/**
 * A Postgres update that no policy allows returns zero rows and no error. That
 * reads as success everywhere unless the caller asks for the rows back and
 * treats an empty result as the refusal it is. Every user facing rename runs
 * through here, so a save that changed nothing can never be reported as saved.
 */

export type UpdateResult = { data: unknown[] | null; error: { message: string } | null };

export type SaveOutcome = { ok: true } | { ok: false; message: string };

export const ENGAGEMENT_RENAME_REFUSAL =
  "That did not save. Only someone on this workboard can rename it.";

export const WORKSTREAM_RENAME_REFUSAL =
  "That did not save. Only the owner of this workstream can rename it.";

export const CLIENT_RENAME_REFUSAL =
  "That did not save. Only someone in this workspace can rename a client.";

export const CLIENT_MOVE_REFUSAL =
  "That did not move. Only someone in this workspace can move a folder.";

/** What delete_container and move_workboard return: a status, never a throw. */
export type RpcStatus = { status?: string; reason?: string } & Record<string, unknown>;

/**
 * The RPC twin of saveOutcome. Only the named success status is a save; any
 * other status is a refusal and its reason is shown exactly as written.
 */
export function rpcOutcome(
  result: { data: unknown; error: { message: string } | null },
  success: string,
  fallback: string,
): { ok: true; value: RpcStatus } | { ok: false; message: string } {
  if (result.error) return { ok: false, message: result.error.message };
  const value = (result.data ?? {}) as RpcStatus;
  if (value.status === success) return { ok: true, value };
  return { ok: false, message: typeof value.reason === "string" && value.reason ? value.reason : fallback };
}

/** Zero rows back is a refusal, never a success, and never a telemetry event. */
export function saveOutcome(result: UpdateResult, refusal: string): SaveOutcome {
  if (result.error) return { ok: false, message: result.error.message };
  if ((result.data ?? []).length === 0) return { ok: false, message: refusal };
  return { ok: true };
}

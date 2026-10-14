/**
 * BR-2: the pure rules behind the connector's branch fetch. No network.
 */

/** One answer for a missing branch, someone else's branch, or a source the caller cannot read. */
export const BRANCH_REFUSAL = "No branch with that id is available to this connection.";

/** Branch fetches read as the signed-in person, so a key-only connection cannot use them. */
export const BRANCH_NEEDS_SIGNIN = "Branches open through the signed-in Lasso connector. Connect Lasso by signing in, then try again.";

export type BranchRow = { id: string; owner_id: string | null; parent_work_item_id: string | null; source_vendor: string | null; meta: unknown };

export type BranchDecision = { ok: true; sourceId: string } | { ok: false; message: string };

export function decideBranchFetch(input: { branch: BranchRow | null; callerProfileId: string; sourceReadable: boolean }): BranchDecision {
  const { branch } = input;
  if (!branch || !branch.parent_work_item_id || branch.owner_id !== input.callerProfileId || !input.sourceReadable) {
    return { ok: false, message: BRANCH_REFUSAL };
  }
  return { ok: true, sourceId: branch.parent_work_item_id };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Merge a fetch into the branch meta, keeping every other key. */
export function mergeBranchFetchMeta(meta: unknown, now: string): { meta: Record<string, unknown>; first: boolean; count: number } {
  const base = isObject(meta) ? meta : {};
  const branch = isObject(base["branch"]) ? base["branch"] : {};
  const prior = typeof branch["fetch_count"] === "number" && Number.isFinite(branch["fetch_count"]) ? (branch["fetch_count"] as number) : 0;
  const count = prior + 1;
  return { meta: { ...base, branch: { ...branch, fetched_at: now, fetch_count: count } }, first: prior === 0, count };
}

/** The tool dim, from the branch's stored vendor. */
export function branchToolDim(vendor: string | null): "claude" | "openai" | "gemini" | "other" {
  return vendor === "claude" || vendor === "openai" || vendor === "gemini" ? vendor : "other";
}

/**
 * S1: the expiring board link, the member side.
 *
 * Everything here runs on the caller-scoped client, so row level security
 * decides who may make or expire a link. The raw token is generated here,
 * returned once to the caller, and never written: only its sha256 hash
 * reaches board_share_links, which has no token column by design.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { ResolvedProfile } from "@/lib/profile-resolve";

import { findBoardFor, isEngagementEditor } from "./canvas-lab.server";
import { SHARE_WINDOW_MS, type BoardShareLinkDto } from "./board-share-shared";
import { sha256Hex } from "./telemetry.server";

type Db = SupabaseClient<Database>;

/** 32 random bytes, base64url, no padding. */
export function generateShareToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

/** The only thing that is ever stored. One way. */
export function hashShareToken(token: string): Promise<string> {
  return sha256Hex(token);
}

export type CreateShareLinkResult =
  | { status: "created"; token: string; expiresAt: string; orgId: string }
  | { status: "forbidden" }
  | { status: "no_board" }
  | { status: "error" };

export async function createShareLink(
  db: Db,
  engagementId: string,
  profile: ResolvedProfile,
): Promise<CreateShareLinkResult> {
  if (!(await isEngagementEditor(db, engagementId, profile.id))) return { status: "forbidden" };
  const board = await findBoardFor(db, engagementId);
  if (!board) return { status: "no_board" };

  const token = generateShareToken();
  const expiresAt = new Date(Date.now() + SHARE_WINDOW_MS).toISOString();
  const { error } = await db.from("board_share_links").insert({
    workboard_id: board.id,
    org_id: board.org_id,
    token_hash: await hashShareToken(token),
    created_by: profile.id,
    expires_at: expiresAt,
  });
  if (error) return { status: "error" };
  return { status: "created", token, expiresAt, orgId: board.org_id };
}

/** Never selects token_hash: nothing a reader gets back can open a board. */
export async function listShareLinks(db: Db, engagementId: string): Promise<BoardShareLinkDto[]> {
  const board = await findBoardFor(db, engagementId);
  if (!board) return [];
  const { data } = await db
    .from("board_share_links")
    .select("id, created_at, expires_at, revoked_at, opened_count, last_opened_at")
    .eq("workboard_id", board.id)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    openedCount: row.opened_count,
    lastOpenedAt: row.last_opened_at,
  }));
}

/** Ends a live link now. The next request sees it closed. */
export async function expireShareLink(
  db: Db,
  linkId: string,
): Promise<{ status: "expired"; orgId: string } | { status: "not_found" }> {
  const { data, error } = await db
    .from("board_share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", linkId)
    .is("revoked_at", null)
    .select("id, org_id")
    .maybeSingle();
  if (error || !data) return { status: "not_found" };
  return { status: "expired", orgId: data.org_id };
}

/**
 * Whether the board holds work owned by anyone other than the person about to
 * share it. Every board today has a single owner, so this reads false until
 * a second person pushes into a shared engagement.
 */
export async function boardHoldsOthersWork(
  db: Db,
  engagementId: string,
  profile: ResolvedProfile,
): Promise<boolean> {
  const board = await findBoardFor(db, engagementId);
  if (!board) return false;
  const { data: nodes } = await db
    .from("workboard_nodes")
    .select("work_item_id, author_profile_id")
    .eq("workboard_id", board.id)
    .is("deleted_at", null);
  const rows = nodes ?? [];
  if (rows.some((row) => row.author_profile_id && row.author_profile_id !== profile.id)) return true;
  const workIds = [...new Set(rows.map((row) => row.work_item_id).filter((id): id is string => !!id))];
  if (workIds.length === 0) return false;
  const { data: items } = await db.from("work_items").select("owner_id").in("id", workIds);
  return (items ?? []).some((item) => item.owner_id && item.owner_id !== profile.id);
}

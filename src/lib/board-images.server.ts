/**
 * KEY-3: the pictures on a board that a question may need. Reads image nodes
 * the person picked, pulls the bytes from the private work-files bucket with
 * the server role, and hands back parts the model seam understands.
 *
 * Caps are deliberate: six images per turn and 5 MB each. Anything past the
 * cap is reported in `skipped` so the manifest can say so.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ChatImagePart } from "./ai.server";
import { parseWorkboardImageBody } from "./canvas-lab-shared";

export const BOARD_IMAGE_MAX_PER_TURN = 6;
export const BOARD_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const WORK_FILES_BUCKET = "work-files";

const MEDIA: Record<string, ChatImagePart["mediaType"]> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

export function mediaTypeForPath(path: string): ChatImagePart["mediaType"] | null {
  const ext = path.toLowerCase().split(".").pop() ?? "";
  return MEDIA[ext] ?? null;
}

export type BoardImageLoad = {
  parts: ChatImagePart[];
  /** Node ids left out and why: not an image on this board, too large, unreadable type, over the per-turn cap, or the file failed to load. */
  skipped: { nodeId: string; reason: "not_found" | "too_large" | "unsupported" | "over_cap" | "unreadable" }[];
};

type NodeLike = { id: string; kind: string; body: string | null; workboard_id: string };

/** Minimal shape of the client this needs, so tests can hand in a fake. */
export type BoardImageDb = {
  from: (table: "workboard_nodes") => {
    select: (columns: string) => {
      in: (column: "id", ids: string[]) => { is: (column: "deleted_at", value: null) => Promise<{ data: NodeLike[] | null; error: unknown }> };
    };
  };
  storage: { from: (bucket: string) => { download: (path: string) => Promise<{ data: Blob | null; error: unknown }> } };
};

export async function loadBoardImageParts(
  db: BoardImageDb | SupabaseClient,
  nodeIds: string[],
  workboardId: string,
): Promise<BoardImageLoad> {
  const skipped: BoardImageLoad["skipped"] = [];
  const parts: ChatImagePart[] = [];
  const ids = [...new Set(nodeIds)].filter((id) => id.length > 0);
  if (ids.length === 0) return { parts, skipped };

  const { data } = await (db as BoardImageDb).from("workboard_nodes").select("id, kind, body, workboard_id").in("id", ids).is("deleted_at", null);
  const rows = new Map((data ?? []).map((row) => [row.id, row]));

  for (const id of ids) {
    const row = rows.get(id);
    const body = row && row.kind === "image" && row.workboard_id === workboardId ? parseWorkboardImageBody(row.body) : null;
    if (!row || !body) { skipped.push({ nodeId: id, reason: "not_found" }); continue; }
    if (parts.length >= BOARD_IMAGE_MAX_PER_TURN) { skipped.push({ nodeId: id, reason: "over_cap" }); continue; }
    const mediaType = mediaTypeForPath(body.path);
    if (!mediaType) { skipped.push({ nodeId: id, reason: "unsupported" }); continue; }
    const { data: blob, error } = await (db as BoardImageDb).storage.from(WORK_FILES_BUCKET).download(body.path);
    if (error || !blob) { skipped.push({ nodeId: id, reason: "unreadable" }); continue; }
    if (blob.size > BOARD_IMAGE_MAX_BYTES) { skipped.push({ nodeId: id, reason: "too_large" }); continue; }
    const bytes = Buffer.from(await blob.arrayBuffer());
    parts.push({ type: "image", mediaType, data: bytes.toString("base64"), nodeId: id });
  }
  return { parts, skipped };
}

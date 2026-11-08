/**
 * IMG-2 (8 Nov 2026): describe a board image once, so Ask can read it.
 *
 * A board image (dropped or pasted) is not captured as work, and until now no
 * model call carried an image, so Ask could not see slides, flow charts or
 * screenshots at all. This reads the image once, transcribes its visible text
 * and describes its charts and flows, and stores the result on the card
 * (workboard_nodes.image_text). Ask reads it later, labelled as an AI
 * description and never as the image itself.
 *
 * Runs on the server with the service role: the IMG-1 guard refuses these
 * columns to signed-in roles. One fast-tier call per image, recorded in
 * ai_usage as surface image_describe. Never throws.
 */

import { chatComplete, type ChatImageMediaType } from "./ai.server";
import { parseWorkboardImageBody } from "./canvas-lab-shared";

/** The Messages API reads these; anything else (avif, svg) is skipped. */
const READABLE: Record<string, ChatImageMediaType> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

/** The provider's per-image limit is 5 MB. */
export const IMAGE_DESCRIBE_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_TEXT_MAX_CHARS = 12_000;
const DESCRIBE_MAX_TOKENS = 2_000;

export const IMAGE_DESCRIBE_SYSTEM = [
  "You read one image from a consultant's workboard so that it can be searched and quoted later.",
  "It is usually a presentation slide, a flow chart, a diagram, a chart or a screenshot.",
  "Write plain text in this order:",
  "1. One line saying what the image is (for example: a slide titled X, a flow chart of Y).",
  "2. Every piece of visible text, transcribed exactly, top to bottom, left to right. Keep names, numbers, labels and headings exactly as written. Mark anything you cannot read as [unreadable].",
  "3. For a chart: the axes, the series and the values you can read. For a flow chart or diagram: each step or box and what connects to what, with the arrow direction.",
  "Describe only what is visible. Do not guess intent, do not summarise beyond what is shown, do not add advice. No markdown tables. No em dashes.",
].join("\n");

export function mediaTypeForPath(path: string): ChatImageMediaType | null {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return READABLE[ext] ?? null;
}

export type DescribeOutcome = "ok" | "failed" | "skipped" | "not_found" | "already";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

function toBase64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < view.length; index += chunk) {
    binary += String.fromCharCode(...view.subarray(index, index + chunk));
  }
  return btoa(binary);
}

async function store(db: Admin, nodeId: string, status: "ok" | "failed" | "skipped", text: string | null): Promise<void> {
  const { error } = await db
    .from("workboard_nodes")
    .update({ image_text: text, image_text_status: status, image_text_at: new Date().toISOString() })
    .eq("id", nodeId)
    .eq("kind", "image");
  if (error) console.error("[image-describe] store failed:", error.message);
}

/**
 * Describe one image card. `force` re-describes a card that already has a
 * result; otherwise a card with any status is left alone.
 */
export async function describeBoardImage(nodeId: string, options: { force?: boolean; db?: Admin } = {}): Promise<DescribeOutcome> {
  let db: Admin;
  try {
    db = options.db ?? (await import("@/integrations/supabase/client.server")).supabaseAdmin;
  } catch (error) {
    console.error("[image-describe] no admin client:", (error as Error).message);
    return "failed";
  }
  let reached = false;
  try {
    const { data: node } = await db
      .from("workboard_nodes")
      .select("id, kind, body, workboard_id, author_profile_id, image_text_status, deleted_at")
      .eq("id", nodeId)
      .maybeSingle();
    if (!node || node.kind !== "image" || node.deleted_at) return "not_found";
    if (node.image_text_status && !options.force) return "already";

    const body = parseWorkboardImageBody(node.body);
    const mediaType = body ? mediaTypeForPath(body.path) : null;
    if (!body || !mediaType) {
      await store(db, nodeId, "skipped", null);
      return "skipped";
    }

    const { data: file, error: downloadError } = await db.storage.from("work-files").download(body.path);
    if (downloadError || !file) {
      console.error("[image-describe] download failed:", downloadError?.message ?? "no file");
      await store(db, nodeId, "failed", null);
      return "failed";
    }
    if (file.size > IMAGE_DESCRIBE_MAX_BYTES) {
      await store(db, nodeId, "skipped", null);
      return "skipped";
    }

    reached = true;
    const { data: board } = await db.from("workboards").select("org_id").eq("id", node.workboard_id).maybeSingle();
    const result = await chatComplete(
      [
        { role: "system", content: IMAGE_DESCRIBE_SYSTEM },
        { role: "user", content: "Read this image.", images: [{ mediaType, data: toBase64(await file.arrayBuffer()) }] },
      ],
      {
        tier: "fast",
        maxTokens: DESCRIBE_MAX_TOKENS,
        meta: { surface: "image_describe", orgId: board?.org_id ?? null, profileId: node.author_profile_id },
        awaitAccounting: true,
      },
    );
    const text = result.text.trim().slice(0, IMAGE_TEXT_MAX_CHARS);
    if (!text) {
      await store(db, nodeId, "failed", null);
      return "failed";
    }
    await store(db, nodeId, "ok", text);
    return "ok";
  } catch (error) {
    // A model error (AiError) lands here; record it so the card is not retried forever.
    console.error("[image-describe] failed:", (error as Error).message);
    if (reached) await store(db, nodeId, "failed", null);
    return "failed";
  }
}

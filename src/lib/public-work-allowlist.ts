/**
 * What a work item may carry to anyone without a session: share links, demo
 * boards, demo Home thumbnails, demo presets and demo conversations all pass
 * through publicSafeWork. The output is an allowlist of top-level fields a
 * visible feature reads; everything else (owner, org, client, task and import
 * ids, content_ref, content_hash, urls, links, notes) never travels.
 *
 * Kept, because a visible feature reads them and they carry no identifier:
 *   id (node and turn references), title, type, source, visibility, dates,
 *   content_fidelity, source_vendor, ungrouped_at
 *   source_meta: vendor, role, produced_at_turn, kind, filename, match, mime, mime_type
 *   meta: source_mime / mime_type (document mark)
 *   orig_conversation_id: an opaque per-response group-N key
 *   placedIn: which board frames the card sits in (replaces task ids by name)
 */

import type { SharedSeedWork } from "./board-share-shared";

const TOP_KEYS = [
  "id",
  "title",
  "type",
  "source",
  "visibility",
  "captured_at",
  "created_at_source",
  "work_date",
  "content_fidelity",
  "source_vendor",
  "ungrouped_at",
] as const;
const SOURCE_META_KEYS = ["vendor", "role", "produced_at_turn", "kind", "filename", "match", "mime", "mime_type"] as const;
const META_KEYS = ["source_mime", "mime_type"] as const;

function isLinkString(v: unknown): boolean {
  return typeof v === "string" && /^(https?:|\/\/)/i.test(v.trim());
}

function pick(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const v = source[key];
    if (v === undefined || v === null) continue;
    if (isLinkString(v)) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[key] = v;
  }
  return Object.keys(out).length ? out : null;
}

export function publicSafeWork(items: readonly SharedSeedWork[]): SharedSeedWork[] {
  const groups = new Map<string, string>();
  return items.map((item) => {
    const src = item as unknown as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of TOP_KEYS) {
      const v = src[key];
      if (v === undefined || isLinkString(v)) continue;
      out[key] = v;
    }
    const origId = item.orig_conversation_id;
    if (origId) {
      const group = groups.get(origId) ?? `group-${groups.size + 1}`;
      groups.set(origId, group);
      out["orig_conversation_id"] = group;
    } else {
      out["orig_conversation_id"] = null;
    }
    const placed = item.placedIn ?? item.taskIds ?? [];
    out["placedIn"] = [...placed];
    const sm = pick(item.source_meta, SOURCE_META_KEYS);
    const m = pick(item.meta, META_KEYS);
    if (sm) out["source_meta"] = sm;
    if (m) out["meta"] = m;
    return out as SharedSeedWork;
  });
}

/** The frames a seed card is placed in, from either the private or public shape. */
export function seedPlacement(item: Pick<SharedSeedWork, "taskIds" | "placedIn">): string[] {
  return item.placedIn ?? item.taskIds ?? [];
}

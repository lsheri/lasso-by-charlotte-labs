/**
 * What a work item may carry to anyone without a session (share link and
 * public demo). Urls, notes, storage keys, Drive and Gmail ids, content_ref
 * and the real conversation id never travel.
 *
 * Kept, because a visible feature reads them and they carry no identifier:
 *   source_meta: vendor (tool name), role + produced_at_turn (docking a file
 *     under its chat), kind (artifact preview), filename + match (reference
 *     file card), mime / mime_type (document mark)
 *   meta: source_mime / mime_type (document mark)
 * Chats pushed together keep bundling through an opaque per-response key.
 */

import type { SharedSeedWork } from "./board-share-shared";

const SOURCE_META_KEYS = ["vendor", "role", "produced_at_turn", "kind", "filename", "match", "mime", "mime_type"] as const;
const META_KEYS = ["source_mime", "mime_type"] as const;

function pick(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const v = source[key];
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && /^(https?:|\/\/)/i.test(v)) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[key] = v;
  }
  return Object.keys(out).length ? out : null;
}

export function publicSafeWork(items: readonly SharedSeedWork[]): SharedSeedWork[] {
  const groups = new Map<string, string>();
  return items.map((item) => {
    const { source_meta: sourceMeta, meta, content_ref: _ref, orig_conversation_id: origId, ...rest } = item;
    let group: string | null = null;
    if (origId) {
      group = groups.get(origId) ?? `group-${groups.size + 1}`;
      groups.set(origId, group);
    }
    const out: Record<string, unknown> = { ...rest, content_ref: null, orig_conversation_id: group };
    const sm = pick(sourceMeta, SOURCE_META_KEYS);
    const m = pick(meta, META_KEYS);
    if (sm) out["source_meta"] = sm;
    if (m) out["meta"] = m;
    return out as SharedSeedWork;
  });
}

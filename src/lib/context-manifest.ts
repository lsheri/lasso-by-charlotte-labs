/**
 * The context manifest: exactly what Lasso read to produce one answer.
 * Built on the server from the context that was actually assembled, persisted
 * beside the answer, and shown to the person underneath it. Every line in here
 * is proof grade. Nothing decorative is ever added.
 */

import { SCOPE_SOURCES, type ScopeSource } from "./reflect-shared";

export type ManifestKind =
  | "conversation"
  | "document"
  | "deck"
  | "sheet"
  | "email"
  | "note"
  | "transcript"
  | "brief"
  | "item"
  /** V2-2: display only. The server tags images "item" with an "image:" id; videos are never context. */
  | "image"
  | "video";

export type ManifestItem = {
  id: string;
  title: string;
  kind: ManifestKind;
  /** The proof: "turns 1-12", "1,842 words", "42 min". Empty when unknown. */
  detail: string;
  /** TOTAL-1: characters of this item's stored text that reached the model. */
  chars_in?: number;
  /** TOTAL-1: characters of stored text this item has. 0 when nothing is stored. */
  chars_total?: number;
};

export type ManifestExcluded = { title: string; reason: string };

/**
 * TOTAL-1: the read set, which is the proof that need 1 is met. `share` is
 * chars_in over chars_total across every item in the read set with stored
 * text; 1 means every word the person selected was in the model's context.
 */
export type ManifestReadSet = {
  ids: string[];
  items_with_text: number;
  chars_total: number;
  chars_in: number;
  share: number;
};

export type ContextManifest = {
  engagement: { id: string; name: string } | null;
  brief_included: boolean;
  firm_checks_applied: number;
  items: ManifestItem[];
  excluded: ManifestExcluded[];
  assembled_at: string;
  scope?: { source: ScopeSource; picked: number | null };
  read_set?: ManifestReadSet;
};

/** Content-free bucket for the read-set share, the only form it leaves as a dim. */
export function shareBucket(share: number | null | undefined): "100" | "90-99" | "under-90" | "none" {
  if (share === null || share === undefined || Number.isNaN(share)) return "none";
  if (share >= 0.999) return "100";
  if (share >= 0.9) return "90-99";
  return "under-90";
}

/** Work item types as plain words, never internal enum names. */
export function manifestKind(type: string): ManifestKind {
  if (type === "ai_thread") return "conversation";
  if (
    type === "document" ||
    type === "deck" ||
    type === "sheet" ||
    type === "email" ||
    type === "note" ||
    type === "transcript"
  ) {
    return type;
  }
  return "item";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Reads a persisted manifest defensively: an old or odd row yields null. */
export function parseManifest(value: unknown): ContextManifest | null {
  if (!isRecord(value)) return null;
  const str = (source: Record<string, unknown>, key: string): string | null => {
    const found = source[key];
    return typeof found === "string" ? found : null;
  };
  const rawItems = Array.isArray(value["items"]) ? (value["items"] as unknown[]) : [];
  const items: ManifestItem[] = [];
  for (const entry of rawItems) {
    if (!isRecord(entry)) continue;
    const title = str(entry, "title");
    if (!title) continue;
    const charsIn = entry["chars_in"];
    const charsTotal = entry["chars_total"];
    items.push({
      id: str(entry, "id") ?? "",
      title,
      kind: (str(entry, "kind") ?? "item") as ManifestKind,
      detail: str(entry, "detail") ?? "",
      ...(typeof charsIn === "number" ? { chars_in: charsIn } : {}),
      ...(typeof charsTotal === "number" ? { chars_total: charsTotal } : {}),
    });
  }
  const rawExcluded = Array.isArray(value["excluded"]) ? (value["excluded"] as unknown[]) : [];
  const excluded: ManifestExcluded[] = [];
  for (const entry of rawExcluded) {
    if (!isRecord(entry)) continue;
    const title = str(entry, "title");
    if (!title) continue;
    excluded.push({ title, reason: str(entry, "reason") ?? "" });
  }
  const rawEngagement = value["engagement"];
  const engagementName = isRecord(rawEngagement) ? str(rawEngagement, "name") : null;
  const engagement =
    isRecord(rawEngagement) && engagementName
      ? { id: str(rawEngagement, "id") ?? "", name: engagementName }
      : null;
  const checks = value["firm_checks_applied"];
  const rawScope = value["scope"];
  const scopeSource = isRecord(rawScope) ? str(rawScope, "source") : null;
  const picked = isRecord(rawScope) ? rawScope["picked"] : null;
  const rawReadSet = value["read_set"];
  const num = (source: Record<string, unknown>, key: string): number | null => {
    const found = source[key];
    return typeof found === "number" && Number.isFinite(found) ? found : null;
  };
  const readSet: ManifestReadSet | null =
    isRecord(rawReadSet) && num(rawReadSet, "chars_total") !== null && num(rawReadSet, "chars_in") !== null
      ? {
          ids: Array.isArray(rawReadSet["ids"]) ? (rawReadSet["ids"] as unknown[]).filter((id): id is string => typeof id === "string") : [],
          items_with_text: num(rawReadSet, "items_with_text") ?? 0,
          chars_total: num(rawReadSet, "chars_total") ?? 0,
          chars_in: num(rawReadSet, "chars_in") ?? 0,
          share: num(rawReadSet, "share") ?? 0,
        }
      : null;
  const manifest: ContextManifest = {
    engagement,
    brief_included: value["brief_included"] === true,
    firm_checks_applied: typeof checks === "number" ? checks : 0,
    items,
    excluded,
    assembled_at: str(value, "assembled_at") ?? "",
    ...(scopeSource && (SCOPE_SOURCES as readonly string[]).includes(scopeSource)
      ? { scope: { source: scopeSource as ScopeSource, picked: typeof picked === "number" && Number.isInteger(picked) && picked >= 0 ? picked : null } }
      : {}),
    ...(readSet ? { read_set: readSet } : {}),
  };
  if (
    !manifest.scope &&
    manifest.items.length === 0 &&
    manifest.excluded.length === 0 &&
    !manifest.brief_included &&
    manifest.firm_checks_applied === 0
  ) {
    return null;
  }
  return manifest;
}

/** The compact one line summary: what was read, in order. */
export function manifestChips(manifest: ContextManifest): string[] {
  const chips = manifest.items.map((item) =>
    item.detail ? `${item.title} (${item.detail})` : item.title,
  );
  if (manifest.brief_included) {
    chips.push(manifest.engagement ? `${manifest.engagement.name} brief` : "the brief");
  }
  if (manifest.firm_checks_applied > 0) {
    chips.push(
      manifest.firm_checks_applied === 1
        ? "1 firm check"
        : `${manifest.firm_checks_applied} firm checks`,
    );
  }
  return chips;
}

export function wordCountLabel(text: string): string {
  const words = text.split(/\s+/).filter(Boolean).length;
  return `${words.toLocaleString("en-GB")} word${words === 1 ? "" : "s"}`;
}

/**
 * The manifest for the catalogue path, where the model chooses what to open.
 * What it opened is in items; what stayed listed but unopened is excluded.
 */
export function manifestFromSources(
  sources: { id: string; title: string; type: string; depth: string }[],
  options: {
    engagement?: { id: string; name: string } | null;
    briefIncluded: boolean;
    firmChecks?: number;
  },
): ContextManifest {
  const items: ManifestItem[] = [];
  const excluded: ManifestExcluded[] = [];
  let unopened = 0;
  for (const source of sources) {
    if (source.depth === "full") {
      items.push({
        id: source.id,
        title: source.title,
        kind: manifestKind(source.type),
        detail: "read in full",
      });
    } else if (source.depth === "extract") {
      items.push({
        id: source.id,
        title: source.title,
        kind: manifestKind(source.type),
        detail: "summary only, full text not opened",
      });
    } else if (source.depth === "unreadable") {
      excluded.push({ title: source.title, reason: "the stored file could not be read" });
    } else {
      unopened += 1;
      if (unopened <= 10) {
        excluded.push({
          title: source.title,
          reason: "listed in the record, not opened for this question",
        });
      }
    }
  }
  if (unopened > 10) {
    excluded.push({
      title: `${unopened - 10} more pieces of work`,
      reason: "listed in the record, not opened for this question",
    });
  }
  return {
    engagement: options.engagement ?? null,
    brief_included: options.briefIncluded,
    firm_checks_applied: options.firmChecks ?? 0,
    items,
    excluded,
    assembled_at: new Date().toISOString(),
  };
}

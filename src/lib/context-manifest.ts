/**
 * The context manifest: exactly what Lasso read to produce one answer.
 * Built on the server from the context that was actually assembled, persisted
 * beside the answer, and shown to the person underneath it. Every line in here
 * is proof grade. Nothing decorative is ever added.
 */

export type ManifestKind =
  | "conversation"
  | "document"
  | "deck"
  | "sheet"
  | "email"
  | "note"
  | "transcript"
  | "brief"
  | "item";

export type ManifestItem = {
  id: string;
  title: string;
  kind: ManifestKind;
  /** The proof: "turns 1-12", "1,842 words", "42 min". Empty when unknown. */
  detail: string;
};

export type ManifestExcluded = { title: string; reason: string };

export type ContextManifest = {
  engagement: { id: string; name: string } | null;
  brief_included: boolean;
  firm_checks_applied: number;
  items: ManifestItem[];
  excluded: ManifestExcluded[];
  assembled_at: string;
};

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
    items.push({
      id: str(entry, "id") ?? "",
      title,
      kind: (str(entry, "kind") ?? "item") as ManifestKind,
      detail: str(entry, "detail") ?? "",
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
  const manifest: ContextManifest = {
    engagement,
    brief_included: value["brief_included"] === true,
    firm_checks_applied: typeof checks === "number" ? checks : 0,
    items,
    excluded,
    assembled_at: str(value, "assembled_at") ?? "",
  };
  if (
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

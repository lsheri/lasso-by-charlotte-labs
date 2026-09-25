import { parseManifest } from "./context-manifest";

export type EarlierRow = { role: string; content: string; context_manifest?: unknown };

export const EARLIER_READS_HEADING =
  "WHAT LASSO READ FOR EARLIER ANSWERS IN THIS CHAT (this record is authoritative):";

export const EARLIER_READS_RULES =
  "Read and used are different. An item can be read in full and not quoted. When asked what was or was not read for an earlier answer, answer only from this record. Never say an item was not read if this record lists it as read. When you say what you read for the current answer, name every item you read, not only the ones you quote.";

function questionLabel(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 80 ? `${flat.slice(0, 80)}...` : flat;
}

/**
 * One system note stating what earlier answers in this chat actually read,
 * from their persisted manifests. Null when no earlier answer has one.
 */
export function earlierReadsNote(rows: EarlierRow[]): string | null {
  const blocks: string[] = [];
  let lastQuestion = "";
  let answerNo = 0;
  for (const row of rows) {
    if (row.role !== "assistant") {
      lastQuestion = row.content ?? "";
      continue;
    }
    answerNo += 1;
    let manifest = null;
    try {
      manifest = parseManifest(row.context_manifest);
    } catch {
      manifest = null;
    }
    if (!manifest) continue;
    const lines = [`Answer ${answerNo}, to "${questionLabel(lastQuestion)}":`];
    if (manifest.items.length > 0) {
      lines.push(
        `Read: ${manifest.items
          .map((i) => (i.detail ? `${i.title} (${i.detail})` : i.title))
          .join("; ")}`,
      );
    }
    if (manifest.brief_included) lines.push("Brief: read");
    if (manifest.excluded.length > 0) {
      lines.push(
        `Not read: ${manifest.excluded
          .map((e) => (e.reason ? `${e.title} (${e.reason})` : e.title))
          .join("; ")}`,
      );
    }
    blocks.push(lines.join("\n"));
  }
  if (blocks.length === 0) return null;
  return [EARLIER_READS_HEADING, ...blocks, EARLIER_READS_RULES].join("\n\n");
}

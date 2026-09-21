/**
 * A board document is the note a workstream carries: written and edited by
 * people, read by people, and never a source. It is not a work item, so
 * lineage, context assembly and search have no way to reach it.
 *
 * Content is stored as JSON so a later editor can use a block model without a
 * schema change. This unit reads one plain text field and nothing else.
 */

export type BoardDocumentContent = { text: string };

export function emptyDocumentContent(): BoardDocumentContent {
  return { text: "" };
}

/** The readable text of a stored document, forgiving of any older shape. */
export function documentPlainText(content: unknown): string {
  if (typeof content === "string") return content;
  if (content && typeof content === "object") {
    const text = (content as { text?: unknown }).text;
    if (typeof text === "string") return text;
  }
  return "";
}

export const NEW_DOCUMENT_TITLE = "Workstream note";

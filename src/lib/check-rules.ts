/**
 * Pass 90: reading a small rules document into draft checks. The file is read
 * in the browser and never stored anywhere; this module only turns its text
 * into drafts a person then reviews and saves one by one.
 */

export type CheckDraft = { title: string; body: string };

export type ParsedCheckRules = {
  drafts: CheckDraft[];
  /** True when the document held more than the cap and the tail was dropped. */
  truncated: boolean;
};

/** Nobody reviews fifty drafts honestly, so an upload stops at twenty. */
export const MAX_CHECK_DRAFTS = 20;

export const UPLOAD_HONESTY_LINE =
  "Read in this browser; nothing is saved until you save each check.";

export function truncationLine(total: number): string {
  return `That file held ${total} sections. The first ${MAX_CHECK_DRAFTS} are shown; the rest were left out.`;
}

/** "firm-rules.md" becomes "firm-rules". */
export function titleFromFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  return base.replace(/\.(txt|md|markdown|text)$/i, "").trim() || "Uploaded rules";
}

const HEADING = /^\s{0,3}(#{1,3})\s+(.+?)\s*#*\s*$/;

/**
 * Markdown H1, H2 or H3 each start a new draft: the heading is the title and
 * everything until the next heading is the body. A file with no headings, be
 * it bullets or plain prose, becomes one draft named after the file.
 */
export function parseCheckRules(fileName: string, text: string): ParsedCheckRules {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const sections: CheckDraft[] = [];
  let current: { title: string; body: string[] } | null = null;

  for (const line of lines) {
    const match = HEADING.exec(line);
    if (match) {
      if (current) sections.push({ title: current.title, body: current.body.join("\n").trim() });
      current = { title: (match[2] ?? "").trim(), body: [] };
    } else if (current) {
      current.body.push(line);
    }
  }
  if (current) sections.push({ title: current.title, body: current.body.join("\n").trim() });

  const withHeadings = sections.filter((section) => section.title.length > 0);

  if (withHeadings.length === 0) {
    const body = text.trim();
    if (!body) return { drafts: [], truncated: false };
    return { drafts: [{ title: titleFromFileName(fileName), body }], truncated: false };
  }

  return {
    drafts: withHeadings.slice(0, MAX_CHECK_DRAFTS),
    truncated: withHeadings.length > MAX_CHECK_DRAFTS,
  };
}

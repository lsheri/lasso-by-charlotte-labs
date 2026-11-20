/**
 * 20 Nov 2026 (Liam, D-86: "admins will be able to write blurbs about their experience and maybe upload a resume or
 * documents about their experience as context. if wanted"). Experience on a person from People we work with: a short
 * blurb in plain words and, if wanted, a few documents (a resume, a case list). It is context for choosing a lead,
 * shown beside their name. It never scores, ranks or orders anyone.
 *
 * Private to the admins and leads of that workspace, like the rest of the list. Never sent to analytics, never
 * written to a log, never on an event. The files sit in a private bucket that only the server can reach.
 */

export const EXPERIENCE_MAX_CHARS = 1500;
export const EXPERIENCE_MAX_FILES = 5;
export const EXPERIENCE_MAX_BYTES = 10 * 1024 * 1024;
export const EXPERIENCE_BUCKET = "roster-experience";
/** The kinds of document that hold a resume or a case list. Anything else is refused before upload. */
export const EXPERIENCE_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
  "text/plain": "txt",
  "text/markdown": "md",
};
const EXTENSIONS = new Set(Object.values(EXPERIENCE_TYPES));

export const EXPERIENCE_COPY = {
  button: "Experience",
  buttonLabel: (name: string) => `Experience for ${name}`,
  title: (name: string) => `${name}: experience`,
  intro: "A few lines on the work they have done, and a resume or documents if you have them. It shows beside their name when you pick a lead. Only admins and leads see it.",
  blurb: "In their words or yours",
  blurbHint: "For example: twelve years in senior living operations; led staffing reviews for three regional chains.",
  count: (used: number) => `${used} of ${EXPERIENCE_MAX_CHARS}`,
  save: "Save",
  saving: "Saving",
  saved: "Saved",
  files: "Documents",
  filesHint: `A resume or a case list. PDF, Word or text, up to 10 MB each, ${EXPERIENCE_MAX_FILES} at most.`,
  add: "Add a document",
  adding: "Adding",
  open: "Open",
  openLabel: (file: string) => `Open ${file}`,
  remove: "Remove",
  removeLabel: (file: string) => `Remove ${file}`,
  noFiles: "No documents yet.",
  loading: "Loading their experience",
  close: "Close",
  /** On the People list, under the person. */
  line: (blurb: string) => `Experience: ${blurb}`,
  documents: (count: number) => (count === 1 ? "1 document" : `${count} documents`),
  /** Beside a name when picking a lead, when nothing has been written (Liam, D-86, item 3). */
  none: "No past work with us yet",
  problems: {
    notAllowed: "Only an admin or a lead can change someone's experience.",
    missing: "That person is not on this workspace's list any more. Reload the page.",
    tooLong: `Keep it under ${EXPERIENCE_MAX_CHARS} characters.`,
    tooBig: "That file is over 10 MB. Add a smaller one.",
    wrongType: "Add a PDF, a Word document or a text file.",
    tooMany: `A person can have ${EXPERIENCE_MAX_FILES} documents. Remove one first.`,
    emptyFile: "That file is empty.",
    notThere: "The file did not arrive. Nothing was added. Try again.",
    gone: "That document is no longer there. Reload the page.",
    notReady: "Experience is not switched on for this workspace yet.",
    failed: "That did not go through. Nothing changed. Try again in a moment.",
    loadFailed: "Their experience could not be loaded. Close this and try again.",
  },
} as const;

export type ExperienceProblem = keyof typeof EXPERIENCE_COPY.problems;
export type ExperienceFile = { id: string; name: string; size: number; addedOn: string };
export type ExperienceView = { blurb: string; files: ExperienceFile[] };
/** What the People list and the lead picker carry: the blurb and how many documents, never the files themselves. */
export type ExperienceSummary = { blurb: string | null; documents: number };

export type ExperienceResult = { ok: true; experience: ExperienceView } | { ok: false; problem: string };
export type UploadTicket = { ok: true; path: string; token: string } | { ok: false; problem: string };
export type OpenResult = { ok: true; url: string } | { ok: false; problem: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value);

/** A blurb as saved: tidied, control characters out, line breaks kept. Empty means none. Undefined means too long. */
export function cleanBlurb(value: unknown): string | null | undefined {
  if (typeof value !== "string") return null;
  const tidy = value
    .replace(/\r\n?/g, "\n")
    // Control characters other than a line break or a tab are never meant.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!tidy) return null;
  if (Array.from(tidy).length > EXPERIENCE_MAX_CHARS) return undefined;
  return tidy;
}

/** A file's name as shown and stored: no folders, no control characters, at most 120 characters, its extension kept. */
export function cleanFileName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const base = value.split(/[\\/]/).pop() ?? "";
  const tidy = base.replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim();
  if (!tidy || tidy === "." || tidy === "..") return null;
  const chars = Array.from(tidy);
  if (chars.length <= 120) return tidy;
  const dot = tidy.lastIndexOf(".");
  const ext = dot > 0 ? tidy.slice(dot) : "";
  return Array.from(tidy.slice(0, tidy.length - ext.length)).slice(0, 120 - ext.length).join("") + ext;
}

/** The kind of a file, from its type and, when the browser does not say, its name. Null when it is not allowed. */
export function fileKind(type: unknown, name: string): string | null {
  const byType = typeof type === "string" ? EXPERIENCE_TYPES[type] : undefined;
  if (byType) return byType;
  if (typeof type === "string" && type !== "" && type !== "application/octet-stream") return null;
  const ext = name.toLowerCase().split(".").pop() ?? "";
  return EXTENSIONS.has(ext) ? ext : null;
}

/** Checks a file before any upload starts. Null when it may go up. */
export function checkFile(file: { name: unknown; size: unknown; type: unknown }, held: number): ExperienceProblem | null {
  const name = cleanFileName(file.name);
  if (!name || fileKind(file.type, name) === null) return "wrongType";
  if (typeof file.size !== "number" || !Number.isFinite(file.size) || file.size <= 0) return "emptyFile";
  if (file.size > EXPERIENCE_MAX_BYTES) return "tooBig";
  if (held >= EXPERIENCE_MAX_FILES) return "tooMany";
  return null;
}

/** Where a file lives in the bucket: the workspace, then the person, then a fresh id and the kind. Never the name. */
export function storagePath(orgId: string, contactId: string, fileId: string, kind: string): string {
  return `${orgId}/${contactId}/${fileId}.${kind}`;
}

/** True only for a path this workspace's server made for this person. Anything else is refused. */
export function pathBelongs(path: unknown, orgId: string, contactId: string): path is string {
  if (typeof path !== "string") return false;
  const match = /^([0-9a-f-]{36})\/([0-9a-f-]{36})\/([0-9a-f-]{36})\.([a-z]{2,4})$/i.exec(path);
  return Boolean(match && match[1] === orgId && match[2] === contactId && isUuid(match[3]) && EXTENSIONS.has((match[4] ?? "").toLowerCase()));
}

/** The line beside a name when picking a lead: the blurb, shortened on a word, or "No past work with us yet". */
export function experienceLine(summary: ExperienceSummary | null | undefined, max = 140): string {
  const blurb = summary?.blurb?.replace(/\s+/g, " ").trim();
  if (!blurb) return EXPERIENCE_COPY.none;
  const chars = Array.from(blurb);
  if (chars.length <= max) return blurb;
  const cut = chars.slice(0, max).join("");
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.]+$/, "")}…`;
}

export const sizeLabel = (bytes: number): string =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/* ---------- inputs the server functions accept ---------- */

type Loose = Record<string, unknown> | null | undefined;
const profile = (raw: Loose) => (isUuid(raw?.["profile_id"]) ? (raw?.["profile_id"] as string) : null);
const contact = (raw: Loose) => {
  const id = raw?.["contact_id"];
  if (!isUuid(id)) throw new Error(EXPERIENCE_COPY.problems.missing);
  return id;
};

export type ExperienceReadInput = { profile_id: string | null; contact_id: string };
export const experienceReadInput = (raw: unknown): ExperienceReadInput => ({ profile_id: profile(raw as Loose), contact_id: contact(raw as Loose) });

export type BlurbInput = ExperienceReadInput & { blurb: string };
export const blurbInput = (raw: unknown): BlurbInput => {
  const loose = raw as Loose;
  const blurb = loose?.["blurb"];
  return { profile_id: profile(loose), contact_id: contact(loose), blurb: typeof blurb === "string" ? blurb.slice(0, EXPERIENCE_MAX_CHARS * 4) : "" };
};

export type UploadStartInput = ExperienceReadInput & { name: string; size: number; type: string };
export const uploadStartInput = (raw: unknown): UploadStartInput => {
  const loose = raw as Loose;
  return {
    profile_id: profile(loose),
    contact_id: contact(loose),
    name: typeof loose?.["name"] === "string" ? (loose["name"] as string).slice(0, 400) : "",
    size: typeof loose?.["size"] === "number" ? (loose["size"] as number) : -1,
    type: typeof loose?.["type"] === "string" ? (loose["type"] as string).slice(0, 120) : "",
  };
};

export type UploadFinishInput = UploadStartInput & { path: string };
export const uploadFinishInput = (raw: unknown): UploadFinishInput => {
  const loose = raw as Loose;
  return { ...uploadStartInput(raw), path: typeof loose?.["path"] === "string" ? (loose["path"] as string).slice(0, 200) : "" };
};

export type FileInput = ExperienceReadInput & { file_id: string };
export const fileInput = (raw: unknown): FileInput => {
  const loose = raw as Loose;
  const id = loose?.["file_id"];
  if (!isUuid(id)) throw new Error(EXPERIENCE_COPY.problems.gone);
  return { profile_id: profile(loose), contact_id: contact(loose), file_id: id };
};

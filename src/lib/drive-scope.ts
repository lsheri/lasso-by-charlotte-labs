/**
 * Pass 165: one place that decides what a Google Drive listing asks for.
 *
 * A real drive is bigger and messier than "My Drive, first fifty files", so
 * the picker now says which part of Drive it is looking at, what kind of file
 * it wants, and how recent it has to be. Every one of those choices turns into
 * Drive query clauses here, so the UI and the server can never disagree.
 *
 * GOOGLEDRIVE_LIST_FILES accepts q, fields, spaces, corpora, driveId, orderBy,
 * folderId, pageSize, pageToken, includeLabels, supportsAllDrives,
 * includeItemsFromAllDrives and includePermissionsForView, so shared drives
 * and "Shared with me" are genuinely reachable.
 */

export const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder";

export const DRIVE_SCOPES = ["my_drive", "shared_with_me", "shared_drive"] as const;
export type DriveScope = (typeof DRIVE_SCOPES)[number];

export const DRIVE_TYPE_FILTERS = [
  "everything",
  "documents",
  "spreadsheets",
  "presentations",
  "pdfs",
  "transcripts",
] as const;
export type DriveTypeFilter = (typeof DRIVE_TYPE_FILTERS)[number];

export const DRIVE_AGE_FILTERS = ["30d", "90d", "365d", "any"] as const;
export type DriveAgeFilter = (typeof DRIVE_AGE_FILTERS)[number];

export const SCOPE_LABEL: Record<DriveScope, string> = {
  my_drive: "My Drive",
  shared_with_me: "Shared with me",
  shared_drive: "Shared drives",
};

export const TYPE_LABEL: Record<DriveTypeFilter, string> = {
  everything: "Everything",
  documents: "Documents",
  spreadsheets: "Spreadsheets",
  presentations: "Presentations",
  pdfs: "PDFs",
  transcripts: "Transcripts",
};

export const AGE_LABEL: Record<DriveAgeFilter, string> = {
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "365d": "Last year",
  any: "Any time",
};

export function isDriveScope(value: unknown): value is DriveScope {
  return typeof value === "string" && (DRIVE_SCOPES as readonly string[]).includes(value);
}

export function isDriveTypeFilter(value: unknown): value is DriveTypeFilter {
  return typeof value === "string" && (DRIVE_TYPE_FILTERS as readonly string[]).includes(value);
}

export function isDriveAgeFilter(value: unknown): value is DriveAgeFilter {
  return typeof value === "string" && (DRIVE_AGE_FILTERS as readonly string[]).includes(value);
}

const TYPE_MIMES: Record<Exclude<DriveTypeFilter, "everything">, string[]> = {
  documents: [
    "application/vnd.google-apps.document",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
  ],
  spreadsheets: [
    "application/vnd.google-apps.spreadsheet",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
  ],
  presentations: [
    "application/vnd.google-apps.presentation",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-powerpoint",
  ],
  pdfs: ["application/pdf"],
  transcripts: ["application/vnd.google-apps.document", "text/plain"],
};

const AGE_DAYS: Record<Exclude<DriveAgeFilter, "any">, number> = {
  "30d": 30,
  "90d": 90,
  "365d": 365,
};

function escape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export type DriveQueryInput = {
  scope?: DriveScope;
  /** The shared drive being browsed, when the scope is shared_drive. */
  driveId?: string | null;
  folderId?: string | null;
  search?: string | null;
  typeFilter?: DriveTypeFilter;
  ageFilter?: DriveAgeFilter;
  /** Injected in tests so the age clause is deterministic. */
  now?: Date;
};

export type DriveQuery = {
  q: string;
  corpora: string;
  driveId?: string;
  supportsAllDrives: true;
  includeItemsFromAllDrives: true;
};

/** The one query builder. Scope decides the corpus, filters narrow the list. */
export function buildDriveQuery(input: DriveQueryInput): DriveQuery {
  const scope: DriveScope = input.scope ?? "my_drive";
  const typeFilter: DriveTypeFilter = input.typeFilter ?? "everything";
  const ageFilter: DriveAgeFilter = input.ageFilter ?? "any";
  const term = input.search?.trim() || null;
  const clauses: string[] = ["trashed = false"];

  if (term) {
    clauses.push(`name contains '${escape(term)}'`);
    if (scope === "shared_with_me") clauses.push("sharedWithMe = true");
  } else if (scope === "shared_with_me" && !input.folderId) {
    clauses.push("sharedWithMe = true");
  } else {
    const parent =
      input.folderId || (scope === "shared_drive" ? (input.driveId ?? "root") : "root");
    clauses.push(`'${escape(parent)}' in parents`);
  }

  if (typeFilter !== "everything") {
    const mimes = [...TYPE_MIMES[typeFilter], DRIVE_FOLDER_MIME];
    clauses.push(`(${mimes.map((mime) => `mimeType = '${mime}'`).join(" or ")})`);
  }

  if (ageFilter !== "any") {
    const now = input.now ?? new Date();
    const since = new Date(now.getTime() - AGE_DAYS[ageFilter] * 24 * 60 * 60 * 1000);
    clauses.push(`modifiedTime > '${since.toISOString()}'`);
  }

  const useDriveCorpus = scope === "shared_drive" && Boolean(input.driveId);
  return {
    q: clauses.join(" and "),
    corpora: useDriveCorpus ? "drive" : "user",
    ...(useDriveCorpus ? { driveId: input.driveId as string } : {}),
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  };
}

/** Plain sentence under a truncated list. Second person, no jargon. */
export function truncationLine(shown: number, hasMore: boolean): string {
  if (!hasMore) return `${shown} shown.`;
  return `${shown} shown, more available.`;
}

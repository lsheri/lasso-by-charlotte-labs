import type { SupabaseClient } from "@supabase/supabase-js";

import {
  checkFile,
  cleanBlurb,
  cleanFileName,
  EXPERIENCE_BUCKET,
  EXPERIENCE_COPY,
  EXPERIENCE_MAX_FILES,
  fileKind,
  pathBelongs,
  storagePath,
  type BlurbInput,
  type ExperienceFile,
  type ExperienceReadInput,
  type ExperienceResult,
  type ExperienceSummary,
  type FileInput,
  type OpenResult,
  type UploadFinishInput,
  type UploadStartInput,
  type UploadTicket,
} from "./roster-experience-shared";
import { canManageRoster } from "./roster-shared";

/**
 * 20 Nov 2026 (Liam, D-86): experience on a person from People we work with. Every rule is here; the outside world
 * is the thin `ExperienceDeps` below. Only an admin or a lead of the person's own workspace reads or changes it, and
 * every read and write names that workspace. Nothing here records an event or logs a blurb, a file name or a person.
 */

export type ExperienceCaller = { profileId: string; orgId: string; role: string };
export type FileRow = { id: string; roster_contact_id: string; org_id: string; storage_path: string; file_name: string; size_bytes: number; added_at: string };

export type ExperienceDeps = {
  /** An active, non-guest member of a company workspace, or a thrown 403. */
  caller: () => Promise<ExperienceCaller>;
  /** True when the person is on this workspace's list. Null when the read failed. */
  personIn: (orgId: string, contactId: string) => Promise<boolean | null>;
  /** The blurb, "none", "absent" before the tables exist, or null when the read failed. */
  blurb: (orgId: string, contactId: string) => Promise<string | "none" | "absent" | null>;
  /** Saves or, for null, removes the blurb. False when the write failed. */
  writeBlurb: (orgId: string, contactId: string, blurb: string | null, by: string) => Promise<boolean | "absent">;
  files: (orgId: string, contactId: string) => Promise<FileRow[] | "absent" | null>;
  /** A one-time upload address for exactly this path. Null when it could not be made. */
  uploadTicket: (path: string) => Promise<{ token: string } | null>;
  /** The size of the object at the path, or null when there is none. */
  objectSize: (path: string) => Promise<number | null>;
  addFile: (row: Omit<FileRow, "added_at">) => Promise<boolean>;
  removeObject: (path: string) => Promise<boolean>;
  removeFile: (orgId: string, fileId: string) => Promise<boolean>;
  /** A short-lived address to read one object. */
  readUrl: (path: string) => Promise<string | null>;
  newId: () => string;
  /** All blurbs and document counts for this workspace's people, for the People list and the lead picker. */
  summaries: (orgId: string) => Promise<Record<string, ExperienceSummary> | "absent" | null>;
};

const fail = (problem: keyof typeof EXPERIENCE_COPY.problems) => ({ ok: false as const, problem: EXPERIENCE_COPY.problems[problem] });

async function gate(deps: ExperienceDeps, contactId: string): Promise<{ caller: ExperienceCaller } | { ok: false; problem: string }> {
  const caller = await deps.caller();
  if (!canManageRoster(caller.role)) return fail("notAllowed");
  const here = await deps.personIn(caller.orgId, contactId);
  if (here === null) return fail("failed");
  if (!here) return fail("missing");
  return { caller };
}

function view(rows: FileRow[]): ExperienceFile[] {
  return rows
    .slice()
    .sort((a, b) => a.added_at.localeCompare(b.added_at) || a.id.localeCompare(b.id))
    .map((row) => ({ id: row.id, name: row.file_name, size: row.size_bytes, addedOn: row.added_at }));
}

async function current(deps: ExperienceDeps, caller: ExperienceCaller, contactId: string): Promise<ExperienceResult> {
  const [blurb, files] = await Promise.all([deps.blurb(caller.orgId, contactId), deps.files(caller.orgId, contactId)]);
  if (blurb === "absent" || files === "absent") return fail("notReady");
  if (blurb === null || files === null) return fail("loadFailed");
  // A row from another workspace or another person is never shown, whatever the read returned.
  const mine = files.filter((row) => row.org_id === caller.orgId && row.roster_contact_id === contactId);
  return { ok: true, experience: { blurb: blurb === "none" ? "" : blurb, files: view(mine) } };
}

export async function readExperience(deps: ExperienceDeps, input: ExperienceReadInput): Promise<ExperienceResult> {
  const checked = await gate(deps, input.contact_id);
  if ("ok" in checked) return checked;
  return current(deps, checked.caller, input.contact_id);
}

export async function saveBlurb(deps: ExperienceDeps, input: BlurbInput): Promise<ExperienceResult> {
  const blurb = cleanBlurb(input.blurb);
  if (blurb === undefined) return fail("tooLong");
  const checked = await gate(deps, input.contact_id);
  if ("ok" in checked) return checked;
  const written = await deps.writeBlurb(checked.caller.orgId, input.contact_id, blurb, checked.caller.profileId);
  if (written === "absent") return fail("notReady");
  if (!written) return fail("failed");
  return current(deps, checked.caller, input.contact_id);
}

/** Step one of adding a document: checks it, then hands back a one-time address for a path the server chose. */
export async function startUpload(deps: ExperienceDeps, input: UploadStartInput): Promise<UploadTicket> {
  const checked = await gate(deps, input.contact_id);
  if ("ok" in checked) return checked;
  const files = await deps.files(checked.caller.orgId, input.contact_id);
  if (files === "absent") return fail("notReady");
  if (files === null) return fail("failed");
  const problem = checkFile(input, files.length);
  if (problem) return fail(problem);
  const name = cleanFileName(input.name) as string;
  const kind = fileKind(input.type, name) as string;
  const path = storagePath(checked.caller.orgId, input.contact_id, deps.newId(), kind);
  const ticket = await deps.uploadTicket(path);
  if (!ticket) return fail("failed");
  return { ok: true, path, token: ticket.token };
}

/**
 * Step two: the file is in the bucket, so it is listed on the person. The path must be one this server would make for
 * this person, the object must be there and no larger than allowed, and the list must still have room. Anything that
 * stops it removes the object, so nothing is left in the bucket that no list points to.
 */
export async function finishUpload(deps: ExperienceDeps, input: UploadFinishInput): Promise<ExperienceResult> {
  const checked = await gate(deps, input.contact_id);
  if ("ok" in checked) return checked;
  const { caller } = checked;
  if (!pathBelongs(input.path, caller.orgId, input.contact_id)) return fail("notThere");
  const drop = async (problem: keyof typeof EXPERIENCE_COPY.problems) => {
    await deps.removeObject(input.path).catch(() => false);
    return fail(problem);
  };
  const size = await deps.objectSize(input.path);
  if (size === null) return fail("notThere");
  const files = await deps.files(caller.orgId, input.contact_id);
  if (files === "absent") return drop("notReady");
  if (files === null) return drop("failed");
  if (files.some((row) => row.storage_path === input.path)) return current(deps, caller, input.contact_id);
  const problem = checkFile({ name: input.name, size, type: input.type }, files.length);
  if (problem) return drop(problem);
  const id = (input.path.split("/").pop() ?? "").split(".")[0] ?? "";
  const added = await deps.addFile({ id, roster_contact_id: input.contact_id, org_id: caller.orgId, storage_path: input.path, file_name: cleanFileName(input.name) as string, size_bytes: size });
  if (!added) return drop("failed");
  return current(deps, caller, input.contact_id);
}

export async function removeFile(deps: ExperienceDeps, input: FileInput): Promise<ExperienceResult> {
  const checked = await gate(deps, input.contact_id);
  if ("ok" in checked) return checked;
  const { caller } = checked;
  const files = await deps.files(caller.orgId, input.contact_id);
  if (files === "absent") return fail("notReady");
  if (files === null) return fail("failed");
  const row = files.find((f) => f.id === input.file_id && f.org_id === caller.orgId && f.roster_contact_id === input.contact_id);
  if (!row) return fail("gone");
  // The list row goes first: a file nobody can see is better than a listed file that cannot be opened.
  if (!(await deps.removeFile(caller.orgId, row.id))) return fail("failed");
  await deps.removeObject(row.storage_path).catch(() => false);
  return current(deps, caller, input.contact_id);
}

export async function openFile(deps: ExperienceDeps, input: FileInput): Promise<OpenResult> {
  const checked = await gate(deps, input.contact_id);
  if ("ok" in checked) return checked;
  const { caller } = checked;
  const files = await deps.files(caller.orgId, input.contact_id);
  if (files === "absent") return fail("notReady");
  if (files === null) return fail("failed");
  const row = files.find((f) => f.id === input.file_id && f.org_id === caller.orgId && f.roster_contact_id === input.contact_id);
  if (!row) return fail("gone");
  const url = await deps.readUrl(row.storage_path);
  return url ? { ok: true, url } : fail("failed");
}

/** Blurbs and document counts for the whole list. Empty for anyone who is not an admin or a lead, or on a failed read. */
export async function experienceSummaries(deps: ExperienceDeps): Promise<Record<string, ExperienceSummary>> {
  const caller = await deps.caller();
  if (!canManageRoster(caller.role)) return {};
  const found = await deps.summaries(caller.orgId).catch(() => null);
  return found && found !== "absent" ? found : {};
}

/* ---------------------------------------------------------------------------
 * The real outside world. Kept thin: every rule is above.
 * ------------------------------------------------------------------------- */

export type ExperienceContext = { supabase: SupabaseClient; userId: string };
const ABSENT = new Set(["42P01", "PGRST205", "42703"]);
/** Signed reads last a minute: long enough to open, too short to pass around. */
const READ_SECONDS = 60;

function logFailure(what: string, error: { code?: unknown } | null): void {
  // Never a blurb, a file name, a path or a person: only what failed and the database's code.
  console.error(`[roster-experience] ${what} failed, code ${typeof error?.code === "string" ? error.code : "unknown"}`);
}

export async function realExperienceDeps(context: ExperienceContext, profileId: string | null): Promise<ExperienceDeps> {
  const { requireFirmMember } = await import("./firm-corpus.server");
  const { profile, supabaseAdmin } = await requireFirmMember(context.supabase as never, context.userId, profileId);
  // The experience tables are newer than the generated types.
  const admin = supabaseAdmin as unknown as SupabaseClient;
  const bucket = () => admin.storage.from(EXPERIENCE_BUCKET);
  return {
    caller: async () => ({ profileId: profile.id, orgId: profile.org_id, role: profile.role }),
    async personIn(orgId, contactId) {
      const { data, error } = await admin.from("roster_contacts").select("id").eq("org_id", orgId).eq("id", contactId).maybeSingle();
      if (error) {
        logFailure("person read", error);
        return null;
      }
      return Boolean(data);
    },
    async blurb(orgId, contactId) {
      const { data, error } = await admin.from("roster_contact_experience").select("blurb").eq("org_id", orgId).eq("roster_contact_id", contactId).maybeSingle();
      if (error) {
        if (ABSENT.has(String(error.code))) return "absent";
        logFailure("blurb read", error);
        return null;
      }
      return (data as { blurb?: string } | null)?.blurb ?? "none";
    },
    async writeBlurb(orgId, contactId, blurb, by) {
      const { error } =
        blurb === null
          ? await admin.from("roster_contact_experience").delete().eq("org_id", orgId).eq("roster_contact_id", contactId)
          : await admin.from("roster_contact_experience").upsert({ roster_contact_id: contactId, org_id: orgId, blurb, updated_by: by, updated_at: new Date().toISOString() } as never, { onConflict: "roster_contact_id" });
      if (error) {
        if (ABSENT.has(String(error.code))) return "absent";
        logFailure("blurb write", error);
        return false;
      }
      return true;
    },
    async files(orgId, contactId) {
      const { data, error } = await admin
        .from("roster_contact_experience_files")
        .select("id, roster_contact_id, org_id, storage_path, file_name, size_bytes, added_at")
        .eq("org_id", orgId)
        .eq("roster_contact_id", contactId)
        .order("added_at", { ascending: true })
        .limit(EXPERIENCE_MAX_FILES * 2);
      if (error) {
        if (ABSENT.has(String(error.code))) return "absent";
        logFailure("files read", error);
        return null;
      }
      return (data ?? []) as FileRow[];
    },
    async uploadTicket(path) {
      const { data, error } = await bucket().createSignedUploadUrl(path);
      if (error || !data) {
        logFailure("upload ticket", error as never);
        return null;
      }
      return { token: data.token };
    },
    async objectSize(path) {
      const slash = path.lastIndexOf("/");
      const { data, error } = await bucket().list(path.slice(0, slash), { search: path.slice(slash + 1), limit: 2 });
      if (error) {
        logFailure("object check", error as never);
        return null;
      }
      const found = (data ?? []).find((object) => object.name === path.slice(slash + 1));
      const size = (found?.metadata as { size?: unknown } | undefined)?.size;
      return typeof size === "number" ? size : null;
    },
    async addFile(row) {
      const { error } = await admin.from("roster_contact_experience_files").insert({ ...row, added_by: profile.id } as never);
      if (error) logFailure("file add", error);
      return !error;
    },
    async removeObject(path) {
      const { error } = await bucket().remove([path]);
      if (error) logFailure("object remove", error as never);
      return !error;
    },
    async removeFile(orgId, fileId) {
      const { error } = await admin.from("roster_contact_experience_files").delete().eq("org_id", orgId).eq("id", fileId);
      if (error) logFailure("file remove", error);
      return !error;
    },
    async readUrl(path) {
      const { data, error } = await bucket().createSignedUrl(path, READ_SECONDS);
      if (error || !data) {
        logFailure("read address", error as never);
        return null;
      }
      return data.signedUrl;
    },
    newId: () => crypto.randomUUID(),
    async summaries(orgId) {
      const [blurbs, files] = await Promise.all([
        admin.from("roster_contact_experience").select("roster_contact_id, blurb").eq("org_id", orgId).limit(1000),
        admin.from("roster_contact_experience_files").select("roster_contact_id").eq("org_id", orgId).limit(5000),
      ]);
      if (blurbs.error || files.error) {
        const error = blurbs.error ?? files.error;
        if (ABSENT.has(String(error?.code))) return "absent";
        logFailure("summaries read", error);
        return null;
      }
      const out: Record<string, ExperienceSummary> = {};
      for (const row of (blurbs.data ?? []) as { roster_contact_id: string; blurb: string }[]) out[row.roster_contact_id] = { blurb: row.blurb, documents: 0 };
      for (const row of (files.data ?? []) as { roster_contact_id: string }[]) {
        const entry = out[row.roster_contact_id] ?? { blurb: null, documents: 0 };
        entry.documents += 1;
        out[row.roster_contact_id] = entry;
      }
      return out;
    },
  };
}

export const experienceHandlers = {
  read: async (context: ExperienceContext, data: ExperienceReadInput) => readExperience(await realExperienceDeps(context, data.profile_id), data),
  saveBlurb: async (context: ExperienceContext, data: BlurbInput) => saveBlurb(await realExperienceDeps(context, data.profile_id), data),
  startUpload: async (context: ExperienceContext, data: UploadStartInput) => startUpload(await realExperienceDeps(context, data.profile_id), data),
  finishUpload: async (context: ExperienceContext, data: UploadFinishInput) => finishUpload(await realExperienceDeps(context, data.profile_id), data),
  removeFile: async (context: ExperienceContext, data: FileInput) => removeFile(await realExperienceDeps(context, data.profile_id), data),
  openFile: async (context: ExperienceContext, data: FileInput) => openFile(await realExperienceDeps(context, data.profile_id), data),
  summaries: async (context: ExperienceContext, data: { profile_id: string | null }) => experienceSummaries(await realExperienceDeps(context, data.profile_id)),
};

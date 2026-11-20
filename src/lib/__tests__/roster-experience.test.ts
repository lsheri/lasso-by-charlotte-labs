// 20 Nov 2026 (Liam, D-86): experience on a person from People we work with. The rules, and the server's handling
// against a fake outside world: who may read or change it, what may be uploaded, and that nothing is left behind.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import {
  blurbInput,
  checkFile,
  cleanBlurb,
  cleanFileName,
  EXPERIENCE_COPY,
  EXPERIENCE_MAX_BYTES,
  EXPERIENCE_MAX_CHARS,
  experienceLine,
  fileInput,
  fileKind,
  pathBelongs,
  storagePath,
  uploadFinishInput,
} from "@/lib/roster-experience-shared";
import {
  experienceSummaries,
  finishUpload,
  openFile,
  readExperience,
  removeFile,
  saveBlurb,
  startUpload,
  type ExperienceDeps,
  type FileRow,
} from "@/lib/roster-experience.server";

const ORG = "11111111-1111-4111-8111-111111111111";
const OTHER = "99999999-9999-4999-8999-999999999999";
const ME = "22222222-2222-4222-8222-222222222222";
const PERSON = "33333333-3333-4333-8333-333333333333";
const FILE = "44444444-4444-4444-8444-444444444444";
const P = (role = "admin") => ({ profile_id: ME, contact_id: PERSON, role });

function world(over: Partial<ExperienceDeps> & { role?: string; rows?: FileRow[]; blurbText?: string | "none" } = {}) {
  const rows: FileRow[] = over.rows ?? [];
  const removed: string[] = [];
  const deps: ExperienceDeps = {
    caller: async () => ({ profileId: ME, orgId: ORG, role: over.role ?? "admin" }),
    personIn: async (org, id) => org === ORG && id === PERSON,
    blurb: async () => over.blurbText ?? "none",
    writeBlurb: vi.fn(async () => true),
    files: async () => rows,
    uploadTicket: vi.fn(async () => ({ token: "t" })),
    objectSize: async () => 2048,
    addFile: vi.fn(async (row) => {
      rows.push({ ...row, added_at: "2026-11-20T12:00:00Z" });
      return true;
    }),
    removeObject: vi.fn(async (path) => {
      removed.push(path);
      return true;
    }),
    removeFile: vi.fn(async (_org, id) => {
      const at = rows.findIndex((r) => r.id === id);
      if (at >= 0) rows.splice(at, 1);
      return true;
    }),
    readUrl: async () => "https://signed.example/once",
    newId: () => FILE,
    summaries: async () => ({ [PERSON]: { blurb: "Senior living operations", documents: 1 } }),
    ...over,
  };
  return { deps, rows, removed };
}
const row = (over: Partial<FileRow> = {}): FileRow => ({ id: FILE, roster_contact_id: PERSON, org_id: ORG, storage_path: storagePath(ORG, PERSON, FILE, "pdf"), file_name: "Resume.pdf", size_bytes: 2048, added_at: "2026-11-20T12:00:00Z", ...over });

describe("the rules", () => {
  it("tidies a blurb, keeps its line breaks, empties to none and refuses one too long", () => {
    expect(cleanBlurb("  Twelve years in senior living.\r\n\r\n\r\nLed three staffing reviews.  ")).toBe("Twelve years in senior living.\n\nLed three staffing reviews.");
    expect(cleanBlurb("   ")).toBeNull();
    expect(cleanBlurb(42)).toBeNull();
    expect(cleanBlurb("a\u0000b\u0007c")).toBe("abc");
    expect(cleanBlurb("é".repeat(EXPERIENCE_MAX_CHARS))).toBe("é".repeat(EXPERIENCE_MAX_CHARS));
    expect(cleanBlurb("x".repeat(EXPERIENCE_MAX_CHARS + 1))).toBeUndefined();
    // Accented, hyphenated, apostrophes: kept as written.
    expect(cleanBlurb("Zoë D'Arcy-Núñez led Pellham's outreach plan")).toBe("Zoë D'Arcy-Núñez led Pellham's outreach plan");
  });

  it("a file name loses its folders and control characters, and a long one keeps its extension", () => {
    expect(cleanFileName("../../etc/passwd")).toBe("passwd");
    expect(cleanFileName("C:\\Users\\me\\Resume 2026.pdf")).toBe("Resume 2026.pdf");
    expect(cleanFileName("..")).toBeNull();
    expect(cleanFileName("")).toBeNull();
    const long = cleanFileName(`${"a".repeat(300)}.docx`) as string;
    expect(Array.from(long)).toHaveLength(120);
    expect(long.endsWith(".docx")).toBe(true);
  });

  it("allows a PDF, Word or text file by type, or by name when the browser does not say, and nothing else", () => {
    expect(fileKind("application/pdf", "x")).toBe("pdf");
    expect(fileKind("", "Resume.DOCX")).toBe("docx");
    expect(fileKind("application/octet-stream", "notes.md")).toBe("md");
    expect(fileKind("image/png", "photo.pdf")).toBeNull();
    expect(fileKind("", "tool.exe")).toBeNull();
    expect(fileKind("text/html", "page.html")).toBeNull();
  });

  it("checks a file before any upload", () => {
    expect(checkFile({ name: "Resume.pdf", size: 1000, type: "application/pdf" }, 0)).toBeNull();
    expect(checkFile({ name: "Resume.pdf", size: 0, type: "application/pdf" }, 0)).toBe("emptyFile");
    expect(checkFile({ name: "Resume.pdf", size: EXPERIENCE_MAX_BYTES + 1, type: "application/pdf" }, 0)).toBe("tooBig");
    expect(checkFile({ name: "Resume.pdf", size: 1000, type: "application/pdf" }, 5)).toBe("tooMany");
    expect(checkFile({ name: "virus.exe", size: 1000, type: "application/x-msdownload" }, 0)).toBe("wrongType");
    expect(checkFile({ name: 3, size: 1000, type: "application/pdf" }, 0)).toBe("wrongType");
  });

  it("only a path this server makes for this person in this workspace is accepted", () => {
    const good = storagePath(ORG, PERSON, FILE, "pdf");
    expect(pathBelongs(good, ORG, PERSON)).toBe(true);
    expect(pathBelongs(storagePath(OTHER, PERSON, FILE, "pdf"), ORG, PERSON)).toBe(false);
    expect(pathBelongs(storagePath(ORG, OTHER, FILE, "pdf"), ORG, PERSON)).toBe(false);
    expect(pathBelongs(`${ORG}/${PERSON}/../${FILE}.pdf`, ORG, PERSON)).toBe(false);
    expect(pathBelongs(`${ORG}/${PERSON}/${FILE}.exe`, ORG, PERSON)).toBe(false);
    expect(pathBelongs(null, ORG, PERSON)).toBe(false);
  });

  it("the line beside a name is the blurb, shortened on a word, or No past work with us yet", () => {
    expect(experienceLine(null)).toBe("No past work with us yet");
    expect(experienceLine({ blurb: "  ", documents: 2 })).toBe("No past work with us yet");
    expect(experienceLine({ blurb: "Senior living operations", documents: 0 })).toBe("Senior living operations");
    const long = experienceLine({ blurb: "Led staffing reviews for three regional senior living chains, ".repeat(5), documents: 0 }, 60);
    expect(long.endsWith("…")).toBe(true);
    expect(Array.from(long).length).toBeLessThanOrEqual(61);
    expect(long).not.toMatch(/\s…$/);
  });

  it("refuses ids that are not ids before any server work", () => {
    expect(() => blurbInput({ contact_id: "nope" })).toThrow(EXPERIENCE_COPY.problems.missing);
    expect(() => fileInput({ contact_id: PERSON, file_id: "x" })).toThrow(EXPERIENCE_COPY.problems.gone);
    expect(blurbInput({ contact_id: PERSON, blurb: 5 }).blurb).toBe("");
    expect(uploadFinishInput({ contact_id: PERSON, path: 9 }).path).toBe("");
  });
});

describe("who may read and change it", () => {
  it("admins and leads only; a manager, an analyst or an em is refused before anything is read", async () => {
    for (const role of ["manager", "analyst", "em", "coach", "guest", ""]) {
      const { deps } = world({ role, personIn: vi.fn(async () => true) });
      expect(await readExperience(deps, P())).toEqual({ ok: false, problem: EXPERIENCE_COPY.problems.notAllowed });
      expect(deps.personIn).not.toHaveBeenCalled();
      expect(await experienceSummaries(deps)).toEqual({});
    }
    for (const role of ["admin", "lead"]) {
      const { deps } = world({ role, blurbText: "Senior living operations" });
      expect(await readExperience(deps, P())).toEqual({ ok: true, experience: { blurb: "Senior living operations", files: [] } });
    }
  });

  it("a person on another workspace's list is not there", async () => {
    const { deps } = world();
    expect(await readExperience(deps, { profile_id: ME, contact_id: OTHER })).toEqual({ ok: false, problem: EXPERIENCE_COPY.problems.missing });
  });

  it("a file row from another workspace or person is never shown", async () => {
    const { deps } = world({ rows: [row(), row({ id: OTHER, org_id: OTHER }), row({ id: "55555555-5555-4555-8555-555555555555", roster_contact_id: OTHER })] });
    const result = await readExperience(deps, P());
    expect(result.ok && result.experience.files.map((f) => f.id)).toEqual([FILE]);
  });

  it("says plainly when the tables are not there yet, and when a read fails", async () => {
    expect(await readExperience(world({ blurb: async () => "absent" }).deps, P())).toEqual({ ok: false, problem: EXPERIENCE_COPY.problems.notReady });
    expect(await readExperience(world({ files: async () => null }).deps, P())).toEqual({ ok: false, problem: EXPERIENCE_COPY.problems.loadFailed });
    expect(await readExperience(world({ personIn: async () => null }).deps, P())).toEqual({ ok: false, problem: EXPERIENCE_COPY.problems.failed });
  });
});

describe("the blurb", () => {
  it("saves it tidied, removes it when emptied, and refuses one too long without writing", async () => {
    const { deps } = world();
    await saveBlurb(deps, { ...P(), blurb: "  Senior living operations  " });
    expect(deps.writeBlurb).toHaveBeenLastCalledWith(ORG, PERSON, "Senior living operations", ME);
    await saveBlurb(deps, { ...P(), blurb: "   " });
    expect(deps.writeBlurb).toHaveBeenLastCalledWith(ORG, PERSON, null, ME);
    const before = (deps.writeBlurb as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(await saveBlurb(deps, { ...P(), blurb: "x".repeat(EXPERIENCE_MAX_CHARS + 1) })).toEqual({ ok: false, problem: EXPERIENCE_COPY.problems.tooLong });
    expect((deps.writeBlurb as ReturnType<typeof vi.fn>).mock.calls.length).toBe(before);
  });

  it("a failed write says so; a manager cannot write at all", async () => {
    expect(await saveBlurb(world({ writeBlurb: async () => false }).deps, { ...P(), blurb: "x" })).toEqual({ ok: false, problem: EXPERIENCE_COPY.problems.failed });
    const manager = world({ role: "manager" });
    expect(await saveBlurb(manager.deps, { ...P(), blurb: "x" })).toEqual({ ok: false, problem: EXPERIENCE_COPY.problems.notAllowed });
    expect(manager.deps.writeBlurb).not.toHaveBeenCalled();
  });
});

describe("documents", () => {
  it("an upload gets a path the server chose, never the file's own name", async () => {
    const { deps } = world();
    const ticket = await startUpload(deps, { ...P(), name: "../../secret/Resume.pdf", size: 2048, type: "application/pdf" });
    expect(ticket).toEqual({ ok: true, path: `${ORG}/${PERSON}/${FILE}.pdf`, token: "t" });
  });

  it("refuses a wrong type, a big file, an empty one and a sixth, before any upload address is made", async () => {
    for (const [file, problem] of [
      [{ name: "a.exe", size: 10, type: "application/x-msdownload" }, "wrongType"],
      [{ name: "a.pdf", size: EXPERIENCE_MAX_BYTES + 1, type: "application/pdf" }, "tooBig"],
      [{ name: "a.pdf", size: 0, type: "application/pdf" }, "emptyFile"],
    ] as const) {
      const { deps } = world();
      expect(await startUpload(deps, { ...P(), ...file })).toEqual({ ok: false, problem: EXPERIENCE_COPY.problems[problem] });
      expect(deps.uploadTicket).not.toHaveBeenCalled();
    }
    const full = world({ rows: Array.from({ length: 5 }, (_, i) => row({ id: `4444444${i}-4444-4444-8444-444444444444` })) });
    expect(await startUpload(full.deps, { ...P(), name: "a.pdf", size: 10, type: "application/pdf" })).toEqual({ ok: false, problem: EXPERIENCE_COPY.problems.tooMany });
  });

  it("finishing lists the file with the size the bucket reports, once, even when pressed twice", async () => {
    const { deps, rows } = world({ objectSize: async () => 4096 });
    const path = storagePath(ORG, PERSON, FILE, "pdf");
    const first = await finishUpload(deps, { ...P(), name: "Resume.pdf", size: 1, type: "application/pdf", path });
    expect(first.ok && first.experience.files).toEqual([{ id: FILE, name: "Resume.pdf", size: 4096, addedOn: "2026-11-20T12:00:00Z" }]);
    await finishUpload(deps, { ...P(), name: "Resume.pdf", size: 1, type: "application/pdf", path });
    expect(rows).toHaveLength(1);
    expect(deps.addFile).toHaveBeenCalledTimes(1);
  });

  it("refuses a path from elsewhere without touching it, and removes an object it will not list", async () => {
    const stranger = world();
    expect(await finishUpload(stranger.deps, { ...P(), name: "a.pdf", size: 1, type: "application/pdf", path: storagePath(OTHER, PERSON, FILE, "pdf") })).toEqual({ ok: false, problem: EXPERIENCE_COPY.problems.notThere });
    expect(stranger.removed).toEqual([]);
    const tooBig = world({ objectSize: async () => EXPERIENCE_MAX_BYTES + 1 });
    const path = storagePath(ORG, PERSON, FILE, "pdf");
    expect(await finishUpload(tooBig.deps, { ...P(), name: "a.pdf", size: 1, type: "application/pdf", path })).toEqual({ ok: false, problem: EXPERIENCE_COPY.problems.tooBig });
    expect(tooBig.removed).toEqual([path]);
    const failed = world({ addFile: async () => false });
    expect(await finishUpload(failed.deps, { ...P(), name: "a.pdf", size: 1, type: "application/pdf", path })).toEqual({ ok: false, problem: EXPERIENCE_COPY.problems.failed });
    expect(failed.removed).toEqual([path]);
    const missing = world({ objectSize: async () => null });
    expect(await finishUpload(missing.deps, { ...P(), name: "a.pdf", size: 1, type: "application/pdf", path })).toEqual({ ok: false, problem: EXPERIENCE_COPY.problems.notThere });
  });

  it("removing takes the list row first, then the file; a file not on this person's list is gone", async () => {
    const { deps, rows, removed } = world({ rows: [row()] });
    const result = await removeFile(deps, { ...P(), file_id: FILE });
    expect(result.ok && result.experience.files).toEqual([]);
    expect(rows).toEqual([]);
    expect(removed).toEqual([storagePath(ORG, PERSON, FILE, "pdf")]);
    expect(await removeFile(world().deps, { ...P(), file_id: FILE })).toEqual({ ok: false, problem: EXPERIENCE_COPY.problems.gone });
    const stuck = world({ rows: [row()], removeFile: async () => false });
    expect(await removeFile(stuck.deps, { ...P(), file_id: FILE })).toEqual({ ok: false, problem: EXPERIENCE_COPY.problems.failed });
    expect(stuck.removed).toEqual([]);
  });

  it("opening gives a short-lived link only for a file on this person's list", async () => {
    expect(await openFile(world({ rows: [row()] }).deps, { ...P(), file_id: FILE })).toEqual({ ok: true, url: "https://signed.example/once" });
    expect(await openFile(world({ rows: [row({ org_id: OTHER })] }).deps, { ...P(), file_id: FILE })).toEqual({ ok: false, problem: EXPERIENCE_COPY.problems.gone });
    expect(await openFile(world({ role: "analyst", rows: [row()] }).deps, { ...P(), file_id: FILE })).toEqual({ ok: false, problem: EXPERIENCE_COPY.problems.notAllowed });
  });
});

describe("what never leaves", () => {
  const server = readFileSync("src/lib/roster-experience.server.ts", "utf8");
  const shared = readFileSync("src/lib/roster-experience-shared.ts", "utf8");
  const functions = readFileSync("src/lib/roster-experience.functions.ts", "utf8");

  it("records no event and sends nothing to analytics", () => {
    for (const text of [server, shared, functions]) {
      expect(text).not.toMatch(/recordEvent|posthog|capture\(|track\(/i);
      expect(text).not.toMatch(/store\.record|\.record\(/);
    }
  });

  it("logs only what failed and the database's code, never a blurb, a name or a path", () => {
    const logs = server.match(/console\.(log|error|warn|info)\([^;]*\);/g) ?? [];
    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain("${what} failed, code");
    for (const call of server.match(/logFailure\("[^"]+"/g) ?? []) expect(call).not.toMatch(/blurb\b.*\$|name|path\b.*\$/);
  });

  it("the migration adds only, keeps both tables and the bucket away from every browser, and the undo says what it deletes", () => {
    const sql = readFileSync("supabase/migrations/20261121010000_roster_experience.sql", "utf8");
    const undo = readFileSync("supabase/undo/20261121010000_roster_experience_undo.sql", "utf8");
    // The only drop is "drop trigger if exists" on the new tables' own guards, so a second run remakes them.
    expect(sql).not.toMatch(/^\s*(drop (table|function|policy|index|schema|view)|alter table [^\n]* drop|delete|truncate|update)\b/im);
    for (const line of sql.match(/^\s*drop [^\n]*/gim) ?? []) expect(line.trim()).toMatch(/^drop trigger if exists roster_contact_experience(_files)?_t_guard on public\.roster_contact_experience(_files)?;$/);
    expect(sql).toMatch(/revoke all on table public\.roster_contact_experience from public, anon, authenticated/);
    expect(sql).toMatch(/revoke all on table public\.roster_contact_experience_files from public, anon, authenticated/);
    expect(sql).not.toMatch(/create policy/i);
    expect(sql).toMatch(/'roster-experience',\s*'roster-experience',\s*false/);
    expect(sql).toMatch(/on conflict \(id\) do nothing/);
    expect(sql).not.toMatch(/photo_path|roster-photos/);
    expect(undo).toMatch(/THIS DELETES DATA/);
    expect(undo).toMatch(/drop table if exists public\.roster_contact_experience_files/);
  });
});

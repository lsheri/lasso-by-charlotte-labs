import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  checkFile,
  EXPERIENCE_COPY,
  EXPERIENCE_MAX_CHARS,
  EXPERIENCE_TYPES,
  sizeLabel,
  type ExperienceResult,
  type ExperienceView,
  type OpenResult,
  type UploadTicket,
} from "@/lib/roster-experience-shared";

export type ExperienceActions = {
  load: (contactId: string) => Promise<ExperienceResult>;
  saveBlurb: (contactId: string, blurb: string) => Promise<ExperienceResult>;
  start: (contactId: string, file: { name: string; size: number; type: string }) => Promise<UploadTicket>;
  /** Puts the file at the one-time address. False when it did not arrive. */
  upload: (path: string, token: string, file: File) => Promise<boolean>;
  finish: (contactId: string, file: { name: string; size: number; type: string; path: string }) => Promise<ExperienceResult>;
  remove: (contactId: string, fileId: string) => Promise<ExperienceResult>;
  open: (contactId: string, fileId: string) => Promise<OpenResult>;
};

/**
 * 20 Nov 2026 (Liam, D-86): a person's experience, on the People tab. A few lines in plain words, and a resume or
 * documents if wanted. Locked until what is saved has loaded, so a late load never overwrites what was typed. A
 * refused or failed change keeps the dialog open with one plain line. Admins and leads only: the panel that opens it
 * is theirs, and every server function checks again.
 */
export function ExperienceDialog({
  person,
  actions,
  onClose,
  onChanged,
}: {
  person: { id: string; name: string } | null;
  actions: ExperienceActions;
  onClose: () => void;
  /** Tells the list a blurb or a document count changed. */
  onChanged?: (() => void) | undefined;
}) {
  const [saved, setSaved] = useState<ExperienceView | null>(null);
  const [blurb, setBlurb] = useState("");
  const [loadFailed, setLoadFailed] = useState<string | null>(null);
  const [working, setWorking] = useState<"blurb" | "file" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const personId = person?.id ?? null;

  useEffect(() => {
    setSaved(null);
    setBlurb("");
    setLoadFailed(null);
    setProblem(null);
    setNote(null);
    if (!personId) return;
    let current = true;
    actions
      .load(personId)
      .then((result) => {
        if (!current) return;
        if (result.ok) {
          setSaved(result.experience);
          setBlurb(result.experience.blurb);
        } else setLoadFailed(result.problem);
      })
      .catch(() => current && setLoadFailed(EXPERIENCE_COPY.problems.loadFailed));
    return () => {
      current = false;
    };
  }, [personId, actions]);

  const ready = saved !== null;
  const used = Array.from(blurb).length;
  const over = used > EXPERIENCE_MAX_CHARS;
  const changed = ready && blurb.trim() !== saved.blurb.trim();

  async function run(kind: "blurb" | "file", work: () => Promise<ExperienceResult>, done?: string) {
    if (working) return;
    setWorking(kind);
    setProblem(null);
    setNote(null);
    try {
      const result = await work();
      if (result.ok) {
        setSaved(result.experience);
        if (kind === "blurb") setBlurb(result.experience.blurb);
        if (done) setNote(done);
        onChanged?.();
      } else setProblem(result.problem);
    } catch {
      setProblem(EXPERIENCE_COPY.problems.failed);
    } finally {
      setWorking(null);
    }
  }

  async function add(file: File) {
    if (!personId || !saved) return;
    const meta = { name: file.name, size: file.size, type: file.type };
    const early = checkFile(meta, saved.files.length);
    if (early) {
      setProblem(EXPERIENCE_COPY.problems[early]);
      return;
    }
    await run("file", async () => {
      const ticket = await actions.start(personId, meta);
      if (!ticket.ok) return ticket;
      if (!(await actions.upload(ticket.path, ticket.token, file))) return { ok: false, problem: EXPERIENCE_COPY.problems.notThere };
      return actions.finish(personId, { ...meta, path: ticket.path });
    });
  }

  async function open(fileId: string) {
    if (!personId) return;
    setProblem(null);
    try {
      const result = await actions.open(personId, fileId);
      if (result.ok) window.open(result.url, "_blank", "noopener,noreferrer");
      else setProblem(result.problem);
    } catch {
      setProblem(EXPERIENCE_COPY.problems.failed);
    }
  }

  return (
    <Dialog
      open={person !== null}
      onOpenChange={(next) => {
        if (next || working) return;
        onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg" data-testid="roster-experience">
        <DialogHeader>
          <DialogTitle className="page-title break-words [overflow-wrap:anywhere]">{person ? EXPERIENCE_COPY.title(person.name) : ""}</DialogTitle>
          <DialogDescription>{EXPERIENCE_COPY.intro}</DialogDescription>
        </DialogHeader>

        {loadFailed ? (
          <p role="alert" className="text-sm text-destructive">
            {loadFailed}
          </p>
        ) : !ready ? (
          <p role="status" className="text-sm text-muted-foreground">
            {EXPERIENCE_COPY.loading}
          </p>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="experience-blurb">{EXPERIENCE_COPY.blurb}</Label>
          <Textarea
            id="experience-blurb"
            className="ph-no-capture min-h-28"
            value={blurb}
            disabled={!ready || working !== null}
            placeholder={EXPERIENCE_COPY.blurbHint}
            aria-invalid={over || undefined}
            aria-describedby="experience-count"
            onChange={(event) => setBlurb(event.target.value)}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span id="experience-count" className={over ? "text-(length:--type-small) text-destructive" : "text-(length:--type-small) text-muted-foreground"}>
              {over ? EXPERIENCE_COPY.problems.tooLong : EXPERIENCE_COPY.count(used)}
            </span>
            <Button type="button" size="sm" disabled={!ready || !changed || over || working !== null} onClick={() => personId && void run("blurb", () => actions.saveBlurb(personId, blurb), EXPERIENCE_COPY.saved)}>
              {working === "blurb" ? EXPERIENCE_COPY.saving : EXPERIENCE_COPY.save}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">{EXPERIENCE_COPY.files}</p>
          <p className="text-(length:--type-small) text-muted-foreground">{EXPERIENCE_COPY.filesHint}</p>
          {ready ? (
            saved.files.length === 0 ? (
              <p className="text-sm text-muted-foreground">{EXPERIENCE_COPY.noFiles}</p>
            ) : (
              <ul className="ph-no-capture flex flex-col divide-y divide-border rounded-[var(--radius-control)] border border-border" data-experience-files>
                {saved.files.map((file) => (
                  <li key={file.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <span className="min-w-0 flex-1 break-words text-sm [overflow-wrap:anywhere]">
                      {file.name} <span className="text-muted-foreground">· {sizeLabel(file.size)}</span>
                    </span>
                    <span className="flex gap-1">
                      <Button type="button" size="sm" variant="ghost" aria-label={EXPERIENCE_COPY.openLabel(file.name)} disabled={working !== null} onClick={() => void open(file.id)}>
                        {EXPERIENCE_COPY.open}
                      </Button>
                      <Button type="button" size="sm" variant="ghost" aria-label={EXPERIENCE_COPY.removeLabel(file.name)} disabled={working !== null} onClick={() => personId && void run("file", () => actions.remove(personId, file.id))}>
                        {EXPERIENCE_COPY.remove}
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            )
          ) : null}
          <input
            ref={fileRef}
            type="file"
            className="sr-only"
            id="experience-file"
            accept={[...Object.keys(EXPERIENCE_TYPES), ".pdf", ".docx", ".doc", ".txt", ".md"].join(",")}
            disabled={!ready || working !== null}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void add(file);
            }}
          />
          <div>
            <Button type="button" variant="outline" size="sm" disabled={!ready || working !== null} onClick={() => fileRef.current?.click()}>
              {working === "file" ? EXPERIENCE_COPY.adding : EXPERIENCE_COPY.add}
            </Button>
          </div>
        </div>

        {problem ? (
          <p role="alert" className="text-sm text-destructive">
            {problem}
          </p>
        ) : null}
        {note ? (
          <p role="status" className="text-sm text-muted-foreground">
            {note}
          </p>
        ) : null}
        <div className="flex justify-end">
          <Button type="button" variant="ghost" disabled={working !== null} onClick={onClose}>
            {EXPERIENCE_COPY.close}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

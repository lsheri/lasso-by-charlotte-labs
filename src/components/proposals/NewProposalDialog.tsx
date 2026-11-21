import { useId, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { Button } from "@/components/ui/button";
import { chipVariants } from "@/components/ui/chip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useBackCloses } from "@/hooks/use-back-closes";
import {
  checkNewProposal,
  INTAKE_COPY,
  MAX_CONTEXT_ITEMS,
  type DeskClient,
  type NewProposalRaw,
  type NewProposalResult,
} from "@/lib/proposal-desk-shared";
import { PROPOSAL_MORPH } from "@/lib/view-morph";

import "./proposal-morph.css";

export type CaptureFiles = (files: File[]) => Promise<{ ids: string[]; failures: { name: string; reason: string }[] }>;

type Added = { id: string; name: string };

/**
 * 20 Nov 2026, the Proposal Desk: "New proposal". Who it is for (a client we have, or a new one), what they asked
 * for, the salesperson's context documents and notes. It makes a proposal row and nothing else: no board exists
 * until the proposal is won.
 *
 * Plain values in, effects out: the page hands over the client list, the upload and the create call. Documents are
 * added as they are chosen, so the list a person sees is exactly what the proposal will carry.
 */
export function NewProposalDialog({
  open,
  onOpenChange,
  clients,
  clientsLoading,
  canAddClient = true,
  clientsOff = false,
  profileId,
  capture,
  discard,
  create,
  onCreated,
  recent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Undefined while the list is loading. */
  clients: DeskClient[] | undefined;
  clientsLoading: boolean;
  /** False for someone who may not add a client: they choose an existing one, and are told so before anything is uploaded. */
  canAddClient?: boolean | undefined;
  /** An admin whose workspace has clients switched off: the note says where to switch them on. */
  clientsOff?: boolean | undefined;
  profileId: string | undefined;
  capture: CaptureFiles;
  /** Removes documents uploaded here when the start is given up, so a proposal that was never made leaves nothing in the person's work. */
  discard?: ((workItemIds: string[]) => Promise<void>) | undefined;
  create: (input: NewProposalRaw) => Promise<NewProposalResult>;
  /** Told the new proposal's id. It may return a promise; the form waits for it, so a hand-over to the lead sheet is seamless. */
  onCreated: (id: string) => void | Promise<void>;
  /** The title of a proposal just started that the list does not show yet. Said on the form, so a second press is never a silent duplicate. */
  recent?: string | undefined;
}) {
  const copy = INTAKE_COPY;
  const ids = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  // 20 Nov 2026, PR 3b (the Click path): the client's due date, the same field the chat's card fills from a brief.
  const [dueOn, setDueOn] = useState("");
  const [added, setAdded] = useState<Added[]>([]);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  /** Saved, and handing over to the lead sheet: the box carries the morph name and leaves without its own animation. */
  const [handing, setHanding] = useState(false);

  const noClients = clients !== undefined && clients.length === 0;
  const effectiveMode = !canAddClient ? "existing" : noClients ? "new" : mode;
  /** Nobody to choose and no way to add one: the form is not offered, so nothing is uploaded for a start that cannot happen. */
  const stuck = !canAddClient && noClients;
  const busy = pending || uploading !== null;

  function reset() {
    setMode("existing");
    setClientId("");
    setClientName("");
    setTitle("");
    setNotes("");
    setDueOn("");
    setAdded([]);
    setUploading(null);
    setPending(false);
    setProblem(null);
    setHanding(false);
  }

  /** Giving up: what was uploaded here for this proposal is removed again, then the form is cleared. */
  function abandon() {
    const ids = added.map((item) => item.id);
    if (ids.length > 0 && discard) void discard(ids).catch(() => undefined);
    reset();
  }

  async function addFiles(list: FileList | null) {
    const files = list ? Array.from(list) : [];
    if (files.length === 0) return;
    if (added.length + files.length > MAX_CONTEXT_ITEMS) {
      setProblem(copy.problems.tooMany);
      return;
    }
    setProblem(null);
    const failed: string[] = [];
    // One at a time, so each file's own result is known and the count on screen is true.
    for (const [index, file] of files.entries()) {
      setUploading({ done: index, total: files.length });
      try {
        const result = await capture([file]);
        const id = result.ids[0];
        if (id) setAdded((current) => [...current, { id, name: file.name }]);
        else failed.push(copy.problems.upload(file.name, result.failures[0]?.reason ?? "try again"));
      } catch (error) {
        failed.push(copy.problems.upload(file.name, (error as Error)?.message || "try again"));
      }
    }
    setUploading(null);
    if (failed.length > 0) setProblem(failed.join(" "));
    if (fileInput.current) fileInput.current.value = "";
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const raw: NewProposalRaw = {
      profile_id: profileId ?? null,
      title,
      ...(effectiveMode === "existing" ? { client_id: clientId || null } : { new_client_name: clientName }),
      notes,
      work_item_ids: added.map((item) => item.id),
      ...(dueOn ? { client_due_on: dueOn } : {}),
    };
    const checked = checkNewProposal(raw);
    if (!checked.ok) {
      setProblem(copy.problems[checked.problem]);
      return;
    }
    setPending(true);
    setProblem(null);
    try {
      const result = await create(raw);
      if (!result.ok) {
        setProblem(result.problem);
        return;
      }
      // The proposal is made. From here nothing may say it failed: a hand-over that goes wrong just closes the form.
      // Committed at once, so the box already carries the morph name when the browser takes its "before" picture.
      flushSync(() => setHanding(true));
      try {
        await onCreated(result.id);
      } catch {
        // The proposal exists; the page shows it on its next read.
      }
      reset();
      onOpenChange(false);
    } catch {
      setProblem(copy.problems.failed);
    } finally {
      setPending(false);
    }
  }

  // On a phone, Back closes the dialog and stays on the page. What was typed is kept for the next time it opens.
  useBackCloses(open, () => onOpenChange(false));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy && !next) return;
        if (!next) abandon();
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="sm:max-w-lg"
        data-testid="new-proposal"
        style={handing ? { viewTransitionName: PROPOSAL_MORPH, animation: "none" } : undefined}
        data-proposal-handing={handing ? "" : undefined}
      >
        <DialogHeader>
          <DialogTitle className="page-title">{copy.title}</DialogTitle>
          <DialogDescription>{copy.intro}</DialogDescription>
        </DialogHeader>
        {recent !== undefined ? (
          <p role="status" data-new-proposal-recent className="text-sm text-foreground [overflow-wrap:anywhere]">
            {copy.justStarted(recent)}
          </p>
        ) : null}

        <form onSubmit={submit} className="space-y-4" noValidate>
          <fieldset className="space-y-2" disabled={busy}>
            <legend className="micro-label">{copy.clientLegend}</legend>
            {!canAddClient ? (
              <p data-new-proposal-clients-note className="text-sm text-muted-foreground">{clientsOff ? copy.clientsOffForAdmin : stuck ? copy.noClientsForMember : copy.adminAddsClients}</p>
            ) : noClients ? (
              <p className="text-sm text-muted-foreground">{copy.noClients}</p>
            ) : (
              <div role="group" aria-label={copy.clientLegend} className="flex flex-wrap gap-2">
                {(["existing", "new"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={effectiveMode === option}
                    className={chipVariants({ tone: effectiveMode === option ? "accent" : "quiet" })}
                    onClick={() => {
                      setMode(option);
                      setProblem(null);
                    }}
                  >
                    {option === "existing" ? copy.existingClient : copy.newClient}
                  </button>
                ))}
              </div>
            )}
            {effectiveMode === "existing" ? (
              <NativeSelect
                aria-label={copy.pickClient}
                value={clientId}
                disabled={clientsLoading || clients === undefined}
                onChange={(event) => setClientId(event.target.value)}
              >
                <option value="">{copy.pickClient}</option>
                {(clients ?? []).map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </NativeSelect>
            ) : (
              <Input aria-label={copy.clientName} placeholder={copy.clientName} value={clientName} onChange={(event) => setClientName(event.target.value)} />
            )}
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor={`${ids}-title`} className="micro-label">
              {copy.titleLabel}
            </Label>
            <Input id={`${ids}-title`} value={title} disabled={busy} placeholder={copy.titleHint} onChange={(event) => setTitle(event.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${ids}-due`} className="micro-label">
              {copy.dueLabel}
            </Label>
            <Input id={`${ids}-due`} type="date" value={dueOn} disabled={busy} onChange={(event) => setDueOn(event.target.value)} className="w-auto" />
            <p className="text-sm text-muted-foreground">{copy.dueHint}</p>
          </div>

          <div className="space-y-1.5">
            <p className="micro-label">{copy.documents}</p>
            <p className="text-sm text-muted-foreground">{copy.documentsHint}</p>
            {added.length > 0 ? (
              <ul className="space-y-1" data-testid="new-proposal-documents">
                {added.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">{item.name}</span>
                    <button
                      type="button"
                      className="shrink-0 text-muted-foreground underline hover:text-foreground"
                      disabled={busy}
                      aria-label={copy.remove(item.name)}
                      onClick={() => {
                        // It was uploaded here for this proposal, so taking it off the list removes the upload too.
                        if (discard) void discard([item.id]).catch(() => undefined);
                        setAdded((current) => current.filter((entry) => entry.id !== item.id));
                      }}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <input ref={fileInput} type="file" multiple className="sr-only" aria-label={copy.addFiles} disabled={busy} onChange={(event) => void addFiles(event.target.files)} />
            <Button type="button" variant="outline" size="sm" disabled={busy || stuck} onClick={() => fileInput.current?.click()}>
              {uploading ? copy.uploading(uploading.done + 1, uploading.total) : copy.addFiles}
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${ids}-notes`} className="micro-label">
              {copy.notes}
            </Label>
            <Textarea id={`${ids}-notes`} rows={3} value={notes} disabled={busy} placeholder={copy.notesHint} onChange={(event) => setNotes(event.target.value)} />
          </div>

          {problem ? (
            <p role="alert" className="text-sm text-destructive">
              {problem}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" disabled={busy} onClick={() => { abandon(); onOpenChange(false); }}>
              {copy.cancel}
            </Button>
            <Button type="submit" disabled={busy || stuck}>
              {pending ? copy.creating : copy.create}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

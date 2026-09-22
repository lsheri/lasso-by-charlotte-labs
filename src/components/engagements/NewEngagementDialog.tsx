import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState, type ReactNode } from "react";

import { ClientPicker } from "@/components/engagements/ClientPicker";
import { noteWorkboardWorkAdded } from "@/components/canvas-lab/canvas-lab-telemetry";
import { useCaptureFiles } from "@/components/work/use-capture-files";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createQuickFolder, useInvalidateClients } from "@/hooks/use-clients";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { briefConfirmShape } from "@/lib/brief-files";
import { vocabFor } from "@/lib/edu-vocab";
import { logEvent } from "@/lib/telemetry";
import { bucket } from "@/lib/telemetry-shared";
import { placeWorkOnBoardFn } from "@/lib/workboard-add-work.functions";

type Mode = "choose" | "engagement" | "folder";

/** Where the person started from. One additive dim on engagement.updated. */
export type NewEngagementFrom = "sidebar" | "sidebar_client" | "client_page" | "home";

export function NewEngagementDialog({
  trigger,
  onDone,
  initialClientId,
  from = "sidebar",
}: {
  trigger: ReactNode;
  onDone?: (() => void) | undefined;
  /** A client chosen for the person before the dialog opens. Still changeable. */
  initialClientId?: string | null | undefined;
  from?: NewEngagementFrom;
}) {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const invalidateClients = useInvalidateClients();
  const navigate = useNavigate();
  const vocab = vocabFor(profile);
  const { captureWithResult } = useCaptureFiles();
  const placeWork = useServerFn(placeWorkOnBoardFn);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("choose");
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState<string | null>(initialClientId ?? null);
  const [brief, setBrief] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [folderName, setFolderName] = useState("");
  const [confirmNoBrief, setConfirmNoBrief] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Set when the engagement exists but some of its files did not come in. */
  const [createdId, setCreatedId] = useState<string | null>(null);

  const confirmShape = briefConfirmShape({
    hasBriefText: Boolean(brief.trim()),
    fileCount: files.length,
  });

  function reset() {
    setMode("choose");
    setCode("");
    setTitle("");
    setClientId(initialClientId ?? null);
    setBrief("");
    setFiles([]);
    setFolderName("");
    setConfirmNoBrief(false);
    setError(null);
    setCreatedId(null);
  }

  function finish(engagementId: string) {
    setOpen(false);
    reset();
    onDone?.();
    navigate({ to: "/engagements/$id", params: { id: engagementId } });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!profile) return;

    // The engagement already exists: the only thing left to do is go to it.
    if (createdId) {
      finish(createdId);
      return;
    }

    // Ask twice, never block. The first submit with an empty brief surfaces one
    // honest sentence about what stays unanswerable without it.
    if (!brief.trim() && !confirmNoBrief) {
      setConfirmNoBrief(true);
      return;
    }

    setPending(true);
    setError(null);

    // The id is minted here on purpose. Reading the row back at insert time
    // needs a membership row that does not exist yet, so asking for it would
    // fail for anyone who is not a lead or an admin.
    const engagementId = crypto.randomUUID();

    const { error: insertError } = await supabase.from("engagements").insert({
      id: engagementId,
      org_id: profile.org_id,
      code: code.trim(),
      title: title.trim(),
      client_id: clientId,
      brief: brief.trim() || null,
    });

    if (insertError) {
      setError(insertError.message || "Could not create the engagement.");
      setPending(false);
      return;
    }

    const insertMembership = () =>
      supabase.from("engagement_members").insert({
        engagement_id: engagementId,
        profile_id: profile.id,
        member_role: "em",
      });

    let { error: memberError } = await insertMembership();
    if (memberError) {
      // One retry. A transient refusal should not cost the person their work.
      ({ error: memberError } = await insertMembership());
    }
    if (memberError) {
      // The engagement exists and cannot be removed from here, so the honest
      // course is to say what happened rather than to imply a clean failure.
      await queryClient.invalidateQueries({ queryKey: ["engagements"] });
      setError("Created, but you were not attached. Ask an admin to add you.");
      setPending(false);
      return;
    }

    logEvent("engagement.updated", profile.org_id, {
      created: "true",
      brief_skipped: brief.trim() ? "false" : "true",
      has_client: clientId ? "true" : "false",
      brief_files: bucket(files.length),
      from,
    });

    // The engagement exists now, so nothing below is allowed to roll anything
    // back. Whatever does not come in is named, and the person is sent on.
    const missing: string[] = [];
    const captured: { file: File; id: string }[] = [];
    for (const file of files) {
      let ids: string[] = [];
      let reason = "";
      try {
        const outcome = await captureWithResult([file]);
        ids = outcome.ids;
        reason = outcome.failures[0]?.reason ?? "";
      } catch (e) {
        ids = [];
        reason = (e as Error)?.message ?? "";
      }
      const id = ids[0];
      if (id) captured.push({ file, id });
      else missing.push(reason ? `${file.name} (${reason})` : file.name);
    }

    if (captured.length > 0) {
      const { error: rowError } = await supabase.from("engagement_brief_files").insert(
        captured.map((entry) => ({
          engagement_id: engagementId,
          work_item_id: entry.id,
          created_by: profile.id,
        })),
      );
      if (rowError) {
        missing.push(...captured.map((entry) => entry.file.name));
      } else {
        try {
          await placeWork({
            data: {
              engagement_id: engagementId,
              work_item_ids: captured.map((entry) => entry.id),
              profile_id: profile.id,
            },
          });
          noteWorkboardWorkAdded(profile.org_id, "brief", "new_engagement", captured.length);
        } catch {
          missing.push(...captured.map((entry) => entry.file.name));
        }
      }
    }

    await queryClient.invalidateQueries({ queryKey: ["engagements"] });
    await queryClient.invalidateQueries({ queryKey: ["engagement-brief-files"] });
    setPending(false);

    if (missing.length > 0) {
      setCreatedId(engagementId);
      setError(
        `Created. These files did not come in: ${missing.join(", ")}. You can add them from the board.`,
      );
      return;
    }

    finish(engagementId);
  }

  async function handleFolder(event: React.FormEvent) {
    event.preventDefault();
    if (!profile || !folderName.trim()) return;
    setPending(true);
    setError(null);
    try {
      const { engagementId } = await createQuickFolder({
        orgId: profile.org_id,
        profileId: profile.id,
        name: folderName.trim(),
      });
      logEvent("engagement.updated", profile.org_id, {
        created: "true",
        quick_folder: "true",
        brief_skipped: "true",
        brief_files: bucket(0),
        from,
      });
      invalidateClients();
      await queryClient.invalidateQueries({ queryKey: ["engagements"] });
      setOpen(false);
      reset();
      onDone?.();
      navigate({ to: "/engagements/$id", params: { id: engagementId } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="page-title">
            {mode === "folder" ? "New quick folder" : vocab.newEngagement}
          </DialogTitle>
        </DialogHeader>

        {mode === "choose" ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setMode("engagement")}
              className="w-full rounded-[var(--radius)] border border-border bg-card px-4 py-3 text-left shadow-card transition-colors hover:border-accent-deep"
            >
              <p className="text-sm font-medium text-foreground">{vocab.fullEngagement}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                A code, a client, a brief, and workstreams underneath it.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setMode("folder")}
              className="w-full rounded-[var(--radius)] border border-border bg-card px-4 py-3 text-left shadow-card transition-colors hover:border-accent-deep"
            >
              <p className="text-sm font-medium text-foreground">Quick folder</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                A simple place to keep and analyze work for one client. You can turn it into a
                full {vocab.engagement.toLowerCase()} later.
              </p>
            </button>
          </div>
        ) : null}

        {mode === "folder" ? (
          <form onSubmit={handleFolder} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="folder-name" className="micro-label">
                Client or folder name
              </Label>
              <Input
                id="folder-name"
                required
                autoFocus
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="Northwind"
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Creating…" : "Create folder"}
            </Button>
          </form>
        ) : null}

        {mode === "engagement" ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="eng-code" className="micro-label">
                  Code
                </Label>
                <Input
                  id="eng-code"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="font-mono"
                  placeholder="ACME-1"
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="eng-title" className="micro-label">
                  Title
                </Label>
                <Input
                  id="eng-title"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Growth strategy refresh"
                />
              </div>
            </div>

            <ClientPicker
              orgId={profile?.org_id}
              value={clientId}
              onChange={setClientId}
              id="eng-client"
            />

            <div className="space-y-1.5">
              <Label htmlFor="eng-brief" className="micro-label">
                Brief (optional)
              </Label>
              <Textarea
                id="eng-brief"
                rows={3}
                value={brief}
                onChange={(e) => {
                  setBrief(e.target.value);
                  setConfirmNoBrief(false);
                }}
              />
              {!brief.trim() ? (
                <p className="text-xs text-muted-foreground">
                  A brief is what the work is measured against. A sentence is enough.
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <input
                ref={fileInput}
                type="file"
                multiple
                className="sr-only"
                onChange={(event) => {
                  const chosen = Array.from(event.target.files ?? []);
                  event.target.value = "";
                  if (chosen.length > 0) setFiles((current) => [...current, ...chosen]);
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInput.current?.click()}
                disabled={pending}
              >
                Attach files
              </Button>
              <p className="text-xs text-muted-foreground">
                Files you attach here are shared with the people on this engagement.
              </p>
              {files.length > 0 ? (
                <ul className="space-y-1">
                  {files.map((file, index) => (
                    <li
                      key={`${file.name}:${index}`}
                      className="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-border bg-card px-3 py-1.5 text-sm text-foreground"
                    >
                      <span className="min-w-0 flex-1 truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => setFiles((current) => current.filter((_, at) => at !== index))}
                        className="shrink-0 text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            {confirmNoBrief && confirmShape ? (
              <p className="rounded-[var(--radius)] border border-border bg-secondary/40 px-3 py-2 text-sm text-foreground">
                {confirmShape.message}
              </p>
            ) : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={pending}>
              {createdId
                ? "Go to the engagement"
                : pending
                  ? "Creating…"
                  : confirmNoBrief && confirmShape
                    ? confirmShape.submitLabel
                    : vocab.createEngagement}
            </Button>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

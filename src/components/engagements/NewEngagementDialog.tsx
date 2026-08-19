import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

import { ClientPicker } from "@/components/engagements/ClientPicker";
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
import { logEvent } from "@/lib/telemetry";

type Mode = "choose" | "engagement" | "folder";

export function NewEngagementDialog({
  trigger,
  onDone,
}: {
  trigger: ReactNode;
  onDone?: (() => void) | undefined;
}) {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const invalidateClients = useInvalidateClients();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("choose");
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [brief, setBrief] = useState("");
  const [folderName, setFolderName] = useState("");
  const [confirmNoBrief, setConfirmNoBrief] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setMode("choose");
    setCode("");
    setTitle("");
    setClientId(null);
    setBrief("");
    setFolderName("");
    setConfirmNoBrief(false);
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!profile) return;

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
    });

    await queryClient.invalidateQueries({ queryKey: ["engagements"] });
    setPending(false);
    setOpen(false);
    reset();
    onDone?.();
    navigate({ to: "/engagements/$id", params: { id: engagementId } });
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
            {mode === "folder" ? "New quick folder" : "New engagement"}
          </DialogTitle>
        </DialogHeader>

        {mode === "choose" ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setMode("engagement")}
              className="w-full rounded-[var(--radius)] border border-border bg-card px-4 py-3 text-left shadow-card transition-colors hover:border-accent-deep"
            >
              <p className="text-sm font-medium text-foreground">Full engagement</p>
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
                A simple place to keep and analyze work for one client. You can turn it into a full
                engagement later.
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

            {confirmNoBrief && !brief.trim() ? (
              <p className="rounded-[var(--radius)] border border-border bg-secondary/40 px-3 py-2 text-sm text-foreground">
                Create without a brief? Drift analysis and Firm checks will say no brief is in the
                record until one exists.
              </p>
            ) : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending
                ? "Creating…"
                : confirmNoBrief && !brief.trim()
                  ? "Create without a brief"
                  : "Create engagement"}
            </Button>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

import { useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";

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
import { ClientPicker } from "@/components/engagements/ClientPicker";
import { createClient, useInvalidateClients } from "@/hooks/use-clients";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { logEvent } from "@/lib/telemetry";

export type EditableEngagement = {
  id: string;
  title: string;
  client_id?: string | null;
  client_label: string | null;
  brief: string | null;
  term_label: string | null;
};

export function EditEngagementDialog({ engagement }: { engagement: EditableEngagement }) {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const invalidateClients = useInvalidateClients();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(engagement.title);
  const [clientId, setClientId] = useState<string | null>(engagement.client_id ?? null);
  const [brief, setBrief] = useState(engagement.brief ?? "");
  const [term, setTerm] = useState(engagement.term_label ?? "");
  const [converting, setConverting] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(engagement.title);
    setClientId(engagement.client_id ?? null);
    setBrief(engagement.brief ?? "");
    setTerm(engagement.term_label ?? "");
    setError(null);
  }, [open, engagement]);

  async function convertLabel() {
    if (!profile || !engagement.client_label) return;
    setConverting(true);
    try {
      const id = await createClient({
        orgId: profile.org_id,
        name: engagement.client_label,
        quickFolder: false,
      });
      invalidateClients();
      setClientId(id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setConverting(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const { error: e } = await supabase
      .from("engagements")
      .update({
        title: title.trim(),
        client_id: clientId,
        brief: brief.trim() || null,
        term_label: term.trim() || null,
      })
      .eq("id", engagement.id);
    if (e) {
      setError(e.message);
      setPending(false);
      return;
    }
    if (profile) logEvent("engagement.updated", profile.org_id, {});
    await queryClient.invalidateQueries({ queryKey: ["engagement", engagement.id] });
    await queryClient.invalidateQueries({ queryKey: ["engagements"] });
    setPending(false);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Edit engagement"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
        >
          <Pencil className="h-3 w-3" aria-hidden /> Edit
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="page-title">Edit engagement</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-eng-title" className="micro-label">
              Name
            </Label>
            <Input
              id="edit-eng-title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <ClientPicker
            orgId={profile?.org_id}
            value={clientId}
            onChange={setClientId}
            id="edit-eng-client"
          />
          {!clientId && engagement.client_label ? (
            <p className="text-xs text-muted-foreground">
              Old label: {engagement.client_label}{" "}
              <button
                type="button"
                disabled={converting}
                onClick={() => void convertLabel()}
                className="text-accent-deep underline underline-offset-2"
              >
                Convert to client
              </button>
            </p>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="edit-eng-brief" className="micro-label">
              Description
            </Label>
            <Textarea
              id="edit-eng-brief"
              rows={4}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-eng-term" className="micro-label">
              Status
            </Label>
            <Input
              id="edit-eng-term"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Active, On hold, Wrapped…"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

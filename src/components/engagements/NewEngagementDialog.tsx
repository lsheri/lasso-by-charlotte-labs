import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

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
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";

export function NewEngagementDialog({
  trigger,
  onDone,
}: {
  trigger: ReactNode;
  onDone?: (() => void) | undefined;
}) {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [clientLabel, setClientLabel] = useState("");
  const [brief, setBrief] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!profile) return;
    setPending(true);
    setError(null);

    const { data, error: insertError } = await supabase
      .from("engagements")
      .insert({
        org_id: profile.org_id,
        code: code.trim(),
        title: title.trim(),
        client_label: clientLabel.trim() || null,
        brief: brief.trim() || null,
      })
      .select("id")
      .maybeSingle();

    if (insertError || !data) {
      setError(insertError?.message ?? "Could not create the engagement.");
      setPending(false);
      return;
    }

    const { error: memberError } = await supabase.from("engagement_members").insert({
      engagement_id: data.id,
      profile_id: profile.id,
      member_role: "em",
    });
    if (memberError) {
      setError(memberError.message);
      setPending(false);
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ["engagements"] });
    setPending(false);
    setOpen(false);
    setCode("");
    setTitle("");
    setClientLabel("");
    setBrief("");
    onDone?.();
    navigate({ to: "/engagements/$id", params: { id: data.id } });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="page-title">New engagement</DialogTitle>
        </DialogHeader>
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
          <div className="space-y-1.5">
            <Label htmlFor="eng-client" className="micro-label">
              Client label (optional)
            </Label>
            <Input
              id="eng-client"
              value={clientLabel}
              onChange={(e) => setClientLabel(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eng-brief" className="micro-label">
              Brief (optional)
            </Label>
            <Textarea
              id="eng-brief"
              rows={3}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creating…" : "Create engagement"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useState, type ReactNode } from "react";
import { toast } from "sonner";

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
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { logEvent } from "@/lib/telemetry";

type InviteRole = "coach" | "em" | "lead" | "admin";

const ROLE_OPTIONS: { value: InviteRole; label: string; hint: string }[] = [
  { value: "coach", label: "Coach", hint: "Reviews the work someone shares, writes coaching notes." },
  { value: "em", label: "Engagement manager", hint: "Brings their own work into Lasso." },
  { value: "lead", label: "Lead", hint: "Can invite others and see engagements across the team." },
  { value: "admin", label: "Admin", hint: "Full workspace settings." },
];

export function InviteDialog({
  trigger,
  engagementId,
  defaultRole = "coach",
}: {
  trigger: ReactNode;
  engagementId?: string | undefined;
  defaultRole?: InviteRole;
}) {
  const { data: profile } = useProfile();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<InviteRole>(defaultRole);
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canInvite = profile?.role === "admin" || profile?.role === "lead";
  if (!canInvite) return null;

  async function createInvite(event: React.FormEvent) {
    event.preventDefault();
    if (!profile) return;
    setPending(true);
    setError(null);
    setLink(null);

    const { data, error: rpcError } = await supabase.rpc("make_invite", {
      p_role: role,
      p_email: email.trim() ? email.trim() : undefined,
      p_org_id: profile.org_id,
    });

    setPending(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    const params = new URLSearchParams({ code: String(data) });
    if (engagementId) params.set("eng", engagementId);
    setLink(`${window.location.origin}/join?${params.toString()}`);
    logEvent("coach.invited", profile.org_id, { role });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setLink(null);
          setError(null);
          setEmail("");
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="page-title">Invite someone</DialogTitle>
        </DialogHeader>

        <form onSubmit={createInvite} className="space-y-4">
          <div className="space-y-2">
            <p className="micro-label">Their role</p>
            <div className="space-y-1.5">
              {ROLE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRole(option.value)}
                  className={
                    role === option.value
                      ? "w-full rounded-[var(--radius)] border border-accent bg-accent-soft px-4 py-2.5 text-left"
                      : "w-full rounded-[var(--radius)] border border-border bg-card px-4 py-2.5 text-left transition-colors hover:bg-accent-soft"
                  }
                >
                  <span className="text-sm font-medium text-foreground">{option.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{option.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-email" className="micro-label">
              Restrict to one email (optional)
            </Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="them@firm.com"
            />
          </div>

          {engagementId ? (
            <p className="text-xs text-muted-foreground">
              They&apos;ll land straight in this engagement when they accept.
            </p>
          ) : null}

          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create invite link"}
          </Button>
        </form>

        {link ? (
          <div className="space-y-2 rounded-[var(--radius)] border border-border bg-secondary px-4 py-3">
            <p className="micro-label">Share this link</p>
            <p className="break-all font-mono text-xs text-foreground">{link}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(link);
                toast.success("Invite link copied");
              }}
            >
              Copy link
            </Button>
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </DialogContent>
    </Dialog>
  );
}

import { WorkingLabel } from "@/components/common/Working";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
import { useProfile } from "@/hooks/use-profile";
import { useMembers } from "@/hooks/use-members";
import { supabase } from "@/integrations/supabase/client";
import { sendInviteEmail } from "@/lib/invites.functions";
import { coachToShareWithInstead, findMemberByEmail, type MemberRow } from "@/lib/members-shared";
import { logEvent } from "@/lib/telemetry";

type InviteRole = "coach" | "em";

const ROLE_OPTIONS: { value: InviteRole; label: string; hint: string }[] = [
  {
    value: "coach",
    label: "Coach or manager",
    hint: "Reviews the work you choose to share with them. Cannot see anything you have not shared.",
  },
  {
    value: "em",
    label: "Teammate",
    hint: "Builds their own record in this workspace. Sees only their own work.",
  },
];

function IssuedInvites({ orgId, refreshKey }: { orgId: string; refreshKey: string }) {
  const { data } = useQuery({
    queryKey: ["invites", orgId, refreshKey],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("invites")
        .select("code, invited_role, email, used_at, expires_at")
        .eq("org_id", orgId)
        .order("expires_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return rows ?? [];
    },
  });

  if (!data || data.length === 0) return null;

  return (
    <div className="border-t border-border pt-4">
      <p className="micro-label">Invites you&apos;ve issued</p>
      <ul className="mt-2 space-y-1.5">
        {data.map((invite) => (
          <li
            key={invite.code}
            className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius)] border border-border bg-card px-3 py-2"
          >
            <span className="font-mono text-xs text-foreground">{invite.code}</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              {invite.invited_role}
              {invite.email ? ` · ${invite.email}` : " · open link"}
            </span>
            <span
              className={
                invite.used_at
                  ? "rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-accent-deep"
                  : "rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground"
              }
            >
              {invite.used_at ? "Accepted" : "Unused"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function InviteDialog({
  trigger,
  engagementId,
  defaultRole = "coach",
  showHistory = true,
  onShareInstead,
}: {
  trigger: ReactNode;
  engagementId?: string | undefined;
  defaultRole?: InviteRole;
  /** The members console lists invites itself, so it turns this off. */
  showHistory?: boolean;
  /**
   * Offered when the typed address already belongs to a coach here. Without
   * it the dialog still blocks the duplicate, it just cannot hand over.
   */
  onShareInstead?: (member: MemberRow) => void;
}) {
  const { data: profile } = useProfile();
  const emailInvite = useServerFn(sendInviteEmail);
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<InviteRole>(defaultRole);
  const [email, setEmail] = useState("");
  const [lockEmail, setLockEmail] = useState(true);
  const [link, setLink] = useState<string | null>(null);
  const [emailState, setEmailState] = useState<"sent" | "not_configured" | "failed" | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canInvite = profile?.role === "admin" || profile?.role === "lead";
  // Only ever the list this viewer may already read. It never answers whether
  // an address exists anywhere else.
  const { data: members } = useMembers(canInvite ? profile?.id : undefined);
  if (!canInvite) return null;

  // An invite is for someone new. A coach invite is always bound to an
  // address, so a link cannot be passed on to someone else.
  const emailRequired = role === "coach" || lockEmail;
  const existing = findMemberByEmail(members?.members ?? [], email);
  const shareInstead = coachToShareWithInstead(members?.members ?? [], email);

  async function createInvite(event: React.FormEvent) {
    event.preventDefault();
    if (!profile) return;
    if (existing) {
      setError(`${existing.display_name} is already in this workspace.`);
      return;
    }
    if (emailRequired && !email.trim()) {
      setError("Add their email address. Coach invites are always locked to one person.");
      return;
    }
    setPending(true);
    setError(null);
    setLink(null);
    setEmailState(null);

    const args: { p_role: InviteRole; p_org_id: string; p_email?: string } = {
      p_role: role,
      p_org_id: profile.org_id,
    };
    if (email.trim()) args.p_email = email.trim();
    const { data, error: rpcError } = await supabase.rpc("make_invite", args);

    setPending(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    const params = new URLSearchParams({ code: String(data) });
    if (engagementId) params.set("eng", engagementId);
    const url = `${window.location.origin}/join?${params.toString()}`;
    setLink(url);
    logEvent("coach.invite_created", profile.org_id, { role });

    const recipient = email.trim();
    if (recipient) {
      try {
        const result = await emailInvite({
          data: {
            profile_id: profile.id,
            code: String(data),
            email: recipient,
            accept_url: url,
          },
        });
        setEmailState(result.reason);
        if (result.sent) toast.success("Invitation emailed");
      } catch {
        setEmailState("failed");
      }
    }
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
          setEmailState(null);
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
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={lockEmail}
                onChange={(e) => {
                  setLockEmail(e.target.checked);
                  if (!e.target.checked) setEmail("");
                }}
                className="h-4 w-4 accent-[var(--accent-deep)]"
              />
              Lock this invite to their email
              <span className="text-muted-foreground">(recommended)</span>
            </label>
            {lockEmail ? (
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="them@firm.com"
              />
            ) : null}
          </div>

          <p className="rounded-[var(--radius)] border border-border bg-secondary px-4 py-3 text-xs text-muted-foreground">
            Coaches see only the work you&apos;ve mapped to this engagement. Private and unmapped
            work is never visible.
            {engagementId ? " They'll land straight in this engagement when they accept." : ""}
          </p>

          <Button type="submit" disabled={pending}>
            {pending ? <WorkingLabel>Creating</WorkingLabel> : "Create invite link"}
          </Button>
        </form>

        {link ? (
          <div className="space-y-2 rounded-[var(--radius)] border border-border bg-secondary px-4 py-3">
            <p className="micro-label">
              {emailState === "sent" ? "Invitation sent" : "Share this link"}
            </p>
            {emailState === "sent" ? (
              <p className="text-xs text-muted-foreground">
                We emailed the invitation. You can also share the link below.
              </p>
            ) : emailState === "not_configured" || emailState === "failed" ? (
              <p className="text-xs text-muted-foreground">
                Email sending is not configured yet, so copy this link and send it yourself.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Send this to them. It expires; it can only be used once.
              </p>
            )}
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

        {showHistory ? <IssuedInvites orgId={profile.org_id} refreshKey={link ?? ""} /> : null}
      </DialogContent>
    </Dialog>
  );
}

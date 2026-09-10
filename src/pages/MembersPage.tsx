import { useState } from "react";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { InviteDialog } from "@/components/invites/InviteDialog";
import { OrgDataCard } from "@/components/settings/YourDataCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionHeader } from "@/components/notebook/SectionHeader";
import { ToneCard } from "@/components/notebook/ToneCard";
import {
  INVITE_ADMIN_ONLY_LINE,
  INVITE_RESEND_ADMIN_ONLY_LINE,
} from "@/lib/invites-shared";
import { ShareWorkDialog } from "@/components/coaching/ShareWorkDialog";
import { useMemberAction, useMembers } from "@/hooks/use-members";
import { isBusinessOrg, ROLE_LABELS, useProfile } from "@/hooks/use-profile";
import {
  maskCode,
  planLine,
  seatsLine,
  type EntitlementSummary,
  type InviteRow,
  type MemberRow,
} from "@/lib/members-shared";

function dateLabel(iso: string | null): string {
  if (!iso) return "Not set";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function initials(displayName: string): string {
  return displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function whatTheyCanSee(role: string, isYou: boolean) {
  if (isYou) return "Your own work, all of it";
  if (role === "coach") return "Work you shared, on their engagements";
  if (role === "admin") return "Firm counts only, never a person's work";
  return "Their own work";
}

function Badge({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "accent";
}) {
  return (
    <span
      className={
        tone === "accent"
          ? "rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-foreground"
          : "rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground"
      }
    >
      {children}
    </span>
  );
}

export function MembersPage() {
  return <MembersConsole />;
}

/**
 * Display only. The plan is stated honestly, including when it is comped, and
 * nothing here blocks anyone or offers an upgrade.
 */
function PlanSection({
  entitlement,
  business,
}: {
  entitlement: EntitlementSummary | null;
  business: boolean;
}) {
  if (!entitlement) {
    return (
      <section>
        <SectionHeader title="Plan" />
        <p className="text-sm text-muted-foreground">No plan on file.</p>
      </section>
    );
  }

  const renewal = entitlement.ends_at ? dateLabel(entitlement.ends_at) : "No end date";

  if (!business) {
    return (
      <section>
        <SectionHeader title="Plan" />
        <p className="text-sm text-muted-foreground">
          {planLine(entitlement)}.{" "}
          {renewal === "No end date" ? "No end date." : `Runs to ${renewal}.`}
        </p>
      </section>
    );
  }

  return (
    <section>
      <SectionHeader
        title="Plan"
        action={entitlement.status === "active" ? null : <Badge>{entitlement.status}</Badge>}
      />
      <div className="border-l border-border pl-4">
        {entitlement.status === "active" ? null : <Badge>{entitlement.status}</Badge>}
        <p className="text-sm font-medium text-foreground">{planLine(entitlement)}</p>
        <p className="mt-1 text-sm text-muted-foreground">{seatsLine(entitlement)}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {renewal === "No end date" ? "No end date." : `Runs to ${renewal}.`}
        </p>
      </div>
    </section>
  );
}

function MembersConsole() {
  const { data: profile } = useProfile();
  const { data, isLoading, error } = useMembers(profile?.id);
  const action = useMemberAction(profile?.id);
  const [confirm, setConfirm] = useState<MemberRow | null>(null);
  const [roleTarget, setRoleTarget] = useState<MemberRow | null>(null);
  const [nextRole, setNextRole] = useState<"em" | "lead">("em");
  const [showHistory, setShowHistory] = useState(false);
  const [shareTarget, setShareTarget] = useState<MemberRow | null>(null);

  const isAdmin = data?.viewer_role === "admin";
  // Leads read the console and can withdraw a link. Only admins issue one.
  const canManageInvites = isAdmin || data?.viewer_role === "lead";
  // A solo workspace has no roster: the only other people in it are coaches.
  const business = isBusinessOrg(profile);
  const copy = business
    ? {
        title: "Members",
        blurb: "Who belongs to this workspace, and the invites still outstanding.",
        people: "People",
        invite: "Invite someone",
        empty: "Nothing outstanding.",
      }
    : {
        title: "Your coaches",
        blurb: "Who you have invited to look at your work, and the invites still outstanding.",
        people: "People with access",
        invite: "Invite a coach",
        empty: "No invites outstanding.",
      };

  /** The resend result decides the wording, so a failed send never reads as sent. */
  function resendMessage(result: unknown): string {
    const r = (result ?? {}) as { delivered?: boolean; reason?: string; old_revoked?: boolean };
    if (r.old_revoked === false)
      return "New link created, the old one is still active. Withdraw it from the list.";
    if (r.delivered) return "New invite sent, the old link no longer works";
    if (r.reason === "no_email") return "New link created, the old one no longer works";
    if (r.reason === "not_configured")
      return "New link created. Email is not set up, so copy the link and send it yourself.";
    return "New link created, but the email did not send. Copy the link and send it yourself.";
  }

  function run(
    input: Parameters<typeof action.mutate>[0],
    success: string | ((result: unknown) => string),
  ) {
    action.mutate(input, {
      onSuccess: (result) =>
        toast.success(typeof success === "function" ? success(result) : success),
      onError: (e) => toast.error((e as Error).message),
    });
  }

  const invites = data?.invites ?? [];
  const pending = invites.filter(
    (i) => !i.used_at && !i.revoked_at && new Date(i.expires_at) > new Date(),
  );
  const history = invites.filter((i) => !pending.includes(i));
  const metaLine = data
    ? `${data.members.length} people · ${data.entitlement?.coaches ?? 0} coaches · a role decides what someone can see, never what they can be told`
    : copy.blurb;

  return (
    <div>
      <PageHeader
        title={copy.title}
        subtitle={metaLine}
        italicWord={business ? "of the firm" : undefined}
      />

      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {error ? (
        <p className="text-sm text-muted-foreground">
          You don&apos;t have access to the member console.
        </p>
      ) : null}

      {data ? (
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10">
          <div className="space-y-10">
            <section>
              <SectionHeader
                title="People"
                action={isAdmin ? (
                <InviteDialog
                  showHistory={false}
                  {...(business ? {} : { defaultRole: "coach" as const })}
                  onShareInstead={(member) => setShareTarget(member)}
                  trigger={
                    <Button type="button" size="sm" variant="outline">
                      {copy.invite}
                    </Button>
                  }
                />
                ) : null}
              />
              <div className="overflow-x-auto">
                <div className="min-w-[700px]">
                  <div className="grid grid-cols-[minmax(220px,1.15fr)_140px_minmax(230px,1fr)_auto] gap-4 border-b border-border px-2 pb-2 font-mono text-[10px] uppercase tracking-[0.08em] text-soft">
                    <span>Name</span>
                    <span>Role</span>
                    <span>What they can see</span>
                    <span className="sr-only">Actions</span>
                  </div>
                  {data.members.map((member) => (
                    <div
                      key={member.id}
                      className="grid min-h-16 grid-cols-[minmax(220px,1.15fr)_140px_minmax(230px,1fr)_auto] items-center gap-4 border-b border-border px-2 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-card font-mono text-[10px] text-foreground">
                          {initials(member.display_name)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {member.display_name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {member.email ?? "No login email"} · joined {dateLabel(member.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge>{ROLE_LABELS[member.role] ?? member.role}</Badge>
                        {member.deactivated_at ? (
                          <Badge>Deactivated {dateLabel(member.deactivated_at)}</Badge>
                        ) : (
                          <Badge tone="accent">Active</Badge>
                        )}
                      </div>
                      <p className="text-xs leading-5 text-muted-foreground">
                        {whatTheyCanSee(member.role, member.id === profile?.id)}
                      </p>
                      <div className="flex items-center justify-end gap-2">
                        {member.role === "coach" && !member.deactivated_at && profile ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setShareTarget(member)}
                          >
                            Share work with {member.display_name.split(" ")[0]}
                          </Button>
                        ) : null}
                        {isAdmin ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              aria-label={`Actions for ${member.display_name}`}
                              className="rounded-md p-1.5 text-foreground/60 transition-colors hover:bg-secondary"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {isAdmin && member.deactivated_at ? (
                                <DropdownMenuItem
                                  onSelect={() =>
                                    run(
                                      { kind: "reactivate", member_id: member.id },
                                      `${member.display_name} can access this workspace again`,
                                    )
                                  }
                                >
                                  Reactivate
                                </DropdownMenuItem>
                              ) : null}
                              {isAdmin && !member.deactivated_at ? (
                                <DropdownMenuItem onSelect={() => setConfirm(member)}>
                                  Deactivate
                                </DropdownMenuItem>
                              ) : null}
                              {isAdmin && business && member.role !== "coach" ? (
                                <DropdownMenuItem
                                  onSelect={() => {
                                    setRoleTarget(member);
                                    setNextRole(member.role === "lead" ? "lead" : "em");
                                  }}
                                >
                                  Change role
                                </DropdownMenuItem>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {!isAdmin ? (
                <>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Leads can see the list. Only an admin can change it.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{INVITE_ADMIN_ONLY_LINE}</p>
                </>
              ) : null}
            </section>

            <section>
              <SectionHeader title="Pending invites" />
              {!isAdmin && canManageInvites ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {INVITE_RESEND_ADMIN_ONLY_LINE}
                </p>
              ) : null}
              {pending.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">{copy.empty}</p>
              ) : (
                <ul className="mt-3 space-y-1.5">
                  {pending.map((invite) => (
                    <InviteLine
                      key={invite.code}
                      invite={invite}
                      {...(canManageInvites
                        ? {
                            onRevoke: () =>
                              run({ kind: "revoke", code: invite.code }, "Invite withdrawn"),
                            busy: action.isPending,
                            // Minting is admin only now, so a lead's resend would
                            // be refused server side. Copy link and Withdraw stay.
                            ...(isAdmin
                              ? {
                                  onResend: () =>
                                    run({ kind: "resend", code: invite.code }, (result) =>
                                      resendMessage(result),
                                    ),
                                }
                              : {}),
                          }
                        : {})}
                    />
                  ))}
                </ul>
              )}
            </section>

            {history.length > 0 ? (
              <section>
                <button
                  type="button"
                  onClick={() => setShowHistory((v) => !v)}
                  className="micro-label transition-colors hover:text-foreground"
                >
                  {showHistory ? "Hide" : "Show"} invite history ({history.length})
                </button>
                {showHistory ? (
                  <ul className="mt-3 space-y-1.5 opacity-55">
                    {history.map((invite) => (
                      <InviteLine key={invite.code} invite={invite} />
                    ))}
                  </ul>
                ) : null}
              </section>
            ) : null}
          </div>

          <aside className="mt-10 space-y-8 lg:mt-0">
            <PlanSection entitlement={data.entitlement} business={business} />
            {isAdmin ? <OrgDataCard /> : null}
            <ToneCard tone="record" label="WHAT A ROLE CHANGES" className="gap-3 p-4">
              <p className="text-sm leading-6 text-foreground">
                A role changes what someone can see. It never changes what someone can be told.
              </p>
              <dl className="space-y-3 border-t border-border pt-3">
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-soft">Member</dt>
                  <dd>Their own work.</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-soft">Coach</dt>
                  <dd>Only work someone has shared with them.</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-soft">Admin</dt>
                  <dd>Firm counts, never a person&apos;s work.</dd>
                </div>
              </dl>
              <p className="font-hand text-green">nobody gets promoted into seeing your drafts</p>
            </ToneCard>
          </aside>
        </div>
      ) : null}

      {shareTarget && profile ? (
        <ShareWorkDialog
          open={Boolean(shareTarget)}
          onOpenChange={(next) => {
            if (!next) setShareTarget(null);
          }}
          profileId={profile.id}
          orgId={profile.org_id}
          coach={{ id: shareTarget.id, display_name: shareTarget.display_name }}
          viewerRole={profile.role}
        />
      ) : null}

      <AlertDialog open={Boolean(confirm)} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {confirm?.display_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will no longer be able to open this workspace or see anything in it. Nothing is
              deleted, and you can turn their access back on at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirm)
                  run({ kind: "deactivate", member_id: confirm.id }, "Member deactivated");
                setConfirm(null);
              }}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={Boolean(roleTarget)} onOpenChange={(open) => !open && setRoleTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="page-title">Change role</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {roleTarget?.display_name} can be a member or a lead. Admin and coach roles are set
            through an invite.
          </p>
          <RadioGroup
            value={nextRole}
            onValueChange={(value) => setNextRole(value as "em" | "lead")}
            className="gap-2"
          >
            <label className="flex items-center gap-2 text-sm text-foreground">
              <RadioGroupItem value="em" /> Engagement manager
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <RadioGroupItem value="lead" /> Lead
            </label>
          </RadioGroup>
          <Button
            type="button"
            onClick={() => {
              if (roleTarget)
                run({ kind: "role", member_id: roleTarget.id, role: nextRole }, "Role updated");
              setRoleTarget(null);
            }}
          >
            Save role
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InviteLine({
  invite,
  onRevoke,
  onResend,
  busy,
}: {
  invite: InviteRow;
  onRevoke?: () => void;
  onResend?: () => void;
  busy?: boolean;
}) {
  const expired = new Date(invite.expires_at) < new Date();
  const status = invite.revoked_at
    ? "Revoked"
    : invite.used_at
      ? "Accepted"
      : expired
        ? "Expired"
        : `Expires ${dateLabel(invite.expires_at)}`;

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--radius)] border border-border bg-card px-4 py-2.5">
      <span className="font-mono text-xs text-foreground">{maskCode(invite.code)}</span>
      <Badge>{ROLE_LABELS[invite.invited_role] ?? invite.invited_role}</Badge>
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
        {invite.email ?? "Open link"} · {status}
        {invite.created_by_name ? ` · invited by ${invite.created_by_name}` : ""}
      </span>
      {onRevoke ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Actions for invite ${maskCode(invite.code)}`}
            className="rounded-md p-1.5 text-foreground/60 transition-colors hover:bg-secondary"
          >
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => {
                void navigator.clipboard.writeText(
                  `${window.location.origin}/join?code=${invite.code}`,
                );
                toast.success("Invite link copied");
              }}
            >
              Copy link
            </DropdownMenuItem>
            {onResend ? (
              <DropdownMenuItem disabled={busy ?? false} onSelect={() => onResend()}>
                Resend
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onSelect={() => onRevoke()}>Withdraw</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </li>
  );
}

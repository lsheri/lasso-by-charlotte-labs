import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CHANGEABLE_ROLES, MEMBER_ROLE_LABELS, ROLE_COPY, isMemberRole, type MemberRole, type RoleChangeResult } from "@/lib/member-roles-shared";

/**
 * 20 Nov 2026, Members: an admin changes a teammate's role between Admin, Lead and Member. Plain values in, effects
 * out, so it is tested without a server. Lead shows only where the workspace has proposals. The server runs every rule
 * again (never your own role, never the last admin); this dialog shows its refusal in words and stays open.
 */
export function MemberRoleDialog({
  member,
  firmView,
  change,
  onChanged,
  onClose,
}: {
  member: { id: string; display_name: string; role: string } | null;
  /** A company workspace, where Lead is offered. */
  firmView: boolean;
  change: (memberId: string, role: MemberRole) => Promise<RoleChangeResult>;
  onChanged: (name: string, role: MemberRole) => void;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<MemberRole | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  useEffect(() => {
    setPicked(member && isMemberRole(member.role) ? member.role : null);
    setProblem(null);
    setBusy(false);
  }, [member]);

  const options = CHANGEABLE_ROLES.filter((role) => role !== "lead" || firmView || member?.role === "lead");

  async function save() {
    if (!member || !picked || busy) return;
    setBusy(true);
    setProblem(null);
    const forMember = member.id;
    let result: RoleChangeResult;
    try {
      result = await change(member.id, picked);
    } catch {
      result = { ok: false, reason: "unavailable" };
    }
    // Closed, or moved on to someone else, while this was out: say nothing on the wrong person.
    if (!live.current || forMember !== member.id) return;
    setBusy(false);
    if (result.ok) {
      onChanged(member.display_name, result.role);
      onClose();
    } else setProblem(ROLE_COPY.refusals[result.reason]);
  }

  return (
    <Dialog open={member !== null} onOpenChange={(open) => (!open && !busy ? onClose() : undefined)}>
      <DialogContent className="max-w-md" data-member-role-dialog>
        <DialogHeader>
          <DialogTitle>{member ? ROLE_COPY.dialogTitle(member.display_name) : ROLE_COPY.change}</DialogTitle>
          <DialogDescription className="sr-only">{ROLE_COPY.change}</DialogDescription>
        </DialogHeader>
        <div role="radiogroup" aria-label={ROLE_COPY.change} className="space-y-1.5">
          {options.map((role) => (
            <button
              key={role}
              type="button"
              role="radio"
              aria-checked={picked === role}
              disabled={busy}
              onClick={() => setPicked(role)}
              className={
                picked === role
                  ? "w-full rounded-[var(--radius)] border border-accent bg-accent-soft px-4 py-2.5 text-left"
                  : "w-full rounded-[var(--radius)] border border-border bg-card px-4 py-2.5 text-left transition-colors hover:bg-accent-soft"
              }
            >
              <span className="text-sm font-medium text-foreground">{MEMBER_ROLE_LABELS[role]}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{ROLE_COPY.hints[role]}</span>
            </button>
          ))}
        </div>
        {problem ? (
          <p role="alert" className="text-sm">
            {problem}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>
            {ROLE_COPY.cancel}
          </Button>
          <Button type="button" disabled={busy || !picked || picked === member?.role} onClick={() => void save()}>
            {busy ? ROLE_COPY.saving : ROLE_COPY.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

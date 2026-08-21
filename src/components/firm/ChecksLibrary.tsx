import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useFirmCheckLibrary, useSetFirmCheckActive } from "@/hooks/use-firm-dashboard";
import { useWriteFirmCheck } from "@/hooks/use-firm-checks";
import { useProfile } from "@/hooks/use-profile";

const SCOPE_WORD = {
  firm: "For the whole firm",
  engagement: "For one engagement",
  person: "For one person",
} as const;

/**
 * The library of checks this firm has written. Checks are retired, never
 * deleted, so a piece of work analysed last month still explains itself.
 * Admins and leads write firm wide checks here and can retire any check.
 */
export function ChecksLibrary({
  profileId,
  runCount,
}: {
  profileId: string | undefined;
  runCount: number;
}) {
  const { data: profile } = useProfile();
  const canAuthor = profile?.role === "admin" || profile?.role === "lead";
  const { data: checks } = useFirmCheckLibrary(profileId);
  const setActive = useSetFirmCheckActive(profileId);
  const { add } = useWriteFirmCheck();
  const [showRetired, setShowRetired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [writeError, setWriteError] = useState<string | null>(null);

  const rows = (checks ?? []).filter((row) => showRetired || row.active);

  async function toggle(id: string, active: boolean) {
    setError(null);
    try {
      await setActive.mutateAsync({ check_id: id, active });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function save() {
    if (!profile?.org_id || !profile?.id || !title.trim() || !body.trim()) return;
    setWriteError(null);
    try {
      await add.mutateAsync({
        orgId: profile.org_id,
        authorProfileId: profile.id,
        title,
        body,
        engagementId: null,
        subjectProfileId: null,
      });
      setTitle("");
      setBody("");
      setOpen(false);
    } catch (e) {
      setWriteError(`That check could not be saved: ${(e as Error).message}`);
    }
  }

  return (
    <section className="rounded-[var(--radius)] border border-border bg-card px-5 py-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="micro-label">Checks library</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            What this firm asks of its work. Everyone the check applies to can read it. Admins and
            leads write firm wide checks here; narrower checks are written on an engagement or in a
            coaching packet.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canAuthor ? (
            <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
              {open ? "Cancel" : "New firm check"}
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => setShowRetired((v) => !v)}>
            {showRetired ? "Active only" : "Show retired"}
          </Button>
        </div>
      </div>

      {open && canAuthor ? (
        <div className="mt-4 space-y-2 border-t border-border pt-4">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What the check is called"
          />
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="What the work should show"
          />
          <p className="text-xs text-muted-foreground">
            This applies to the whole firm and everyone can read it.
          </p>
          {writeError ? <p className="text-xs text-destructive">{writeError}</p> : null}
          <Button
            size="sm"
            onClick={() => void save()}
            disabled={add.isPending || !title.trim() || !body.trim()}
          >
            {add.isPending ? "Saving" : "Save check"}
          </Button>
        </div>
      ) : null}

      <p className="mt-3 text-sm text-muted-foreground">
        {runCount} firm checks {runCount === 1 ? "analysis has" : "analyses have"} been run in the
        last period. That counts runs of the checks analysis, not which single check was met.
      </p>

      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}

      <div className="mt-4 space-y-2">
        {rows.map((check) => (
          <div key={check.id} className="rounded-[var(--radius)] border border-border px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="text-sm font-medium text-foreground">{check.title}</p>
              <button
                type="button"
                onClick={() => void toggle(check.id, !check.active)}
                disabled={setActive.isPending}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {check.active ? "Retire" : "Restore"}
              </button>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{check.body}</p>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              {SCOPE_WORD[check.scope]}
              {check.active ? "" : " · retired"}
            </p>
          </div>
        ))}
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {showRetired ? "No checks written yet." : "No active checks right now."}
          </p>
        ) : null}
      </div>
    </section>
  );
}


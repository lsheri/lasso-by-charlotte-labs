import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  firmCheckAppliesTo,
  useFirmChecks,
  useWriteFirmCheck,
  type FirmCheck,
} from "@/hooks/use-firm-checks";

/**
 * The checks a coach or the firm wrote for this work. Everyone who the checks
 * apply to can read them: transparency is the trust model, a check is guidance
 * and never a hidden test. Only coaches and admins can write one.
 */
export function FirmChecksCard({
  orgId,
  authorProfileId,
  role,
  engagementId = null,
  subjectProfileId = null,
  subjectName,
}: {
  orgId: string | undefined;
  authorProfileId: string | undefined;
  role: string | undefined;
  engagementId?: string | null;
  subjectProfileId?: string | null;
  subjectName?: string;
}) {
  const canWrite = role === "coach" || role === "admin";
  const { data: checks } = useFirmChecks({ orgId, engagementId, subjectProfileId });
  const { add, deactivate } = useWriteFirmCheck();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [scope, setScope] = useState<"org" | "engagement" | "person">(
    subjectProfileId ? "person" : engagementId ? "engagement" : "org",
  );
  const [error, setError] = useState<string | null>(null);

  const rows = (checks ?? []) as FirmCheck[];
  if (!orgId) return null;
  if (rows.length === 0 && !canWrite) return null;

  async function save() {
    if (!orgId || !authorProfileId || !title.trim() || !body.trim()) return;
    setError(null);
    try {
      await add.mutateAsync({
        orgId,
        authorProfileId,
        title,
        body,
        engagementId: scope === "engagement" ? engagementId : null,
        subjectProfileId: scope === "person" ? subjectProfileId : null,
      });
      setTitle("");
      setBody("");
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <section className="rounded-[var(--radius)] border border-border bg-card px-5 py-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="micro-label">Firm checks</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            What this firm asks of work like this. Lasso can run these against a finished piece of
            work.
          </p>
        </div>
        {canWrite ? (
          <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
            {open ? "Cancel" : "Add a check"}
          </Button>
        ) : null}
      </div>

      {open && canWrite ? (
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
          <div className="flex flex-wrap gap-2">
            {(
              [
                { key: "org" as const, label: "Whole firm", show: true },
                { key: "engagement" as const, label: "This engagement", show: Boolean(engagementId) },
                {
                  key: "person" as const,
                  label: subjectName ? `Just ${subjectName}` : "This person",
                  show: Boolean(subjectProfileId),
                },
              ] satisfies { key: "org" | "engagement" | "person"; label: string; show: boolean }[]
            )
              .filter((option) => option.show)
              .map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setScope(option.key)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-opacity hover:opacity-85 ${
                    scope === option.key
                      ? "bg-ember text-ember-foreground"
                      : "border border-border text-muted-foreground"
                  }`}
                >
                  {option.label}
                </button>
              ))}
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <Button
            size="sm"
            onClick={() => void save()}
            disabled={add.isPending || !title.trim() || !body.trim()}
          >
            {add.isPending ? "Saving" : "Save check"}
          </Button>
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        {rows.map((check) => (
          <div key={check.id} className="rounded-[var(--radius)] border border-border px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-foreground">{check.title}</p>
              {canWrite && check.author_profile_id === authorProfileId ? (
                <button
                  type="button"
                  onClick={() => void deactivate.mutateAsync(check.id)}
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  Deactivate
                </button>
              ) : null}
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{check.body}</p>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              {firmCheckAppliesTo(check)}
            </p>
          </div>
        ))}
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No firm checks written yet.</p>
        ) : null}
      </div>
    </section>
  );
}

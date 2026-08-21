import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useFirmCheckLibrary, useSetFirmCheckActive } from "@/hooks/use-firm-dashboard";
import { useWriteFirmCheck } from "@/hooks/use-firm-checks";
import { useProfile } from "@/hooks/use-profile";
import { insertFirmCheck } from "@/hooks/use-firm-checks";
import {
  UPLOAD_HONESTY_LINE,
  parseCheckRules,
  truncationLine,
} from "@/lib/check-rules";

type ReviewDraft = { key: string; title: string; body: string; error: string | null };

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
  const [drafts, setDrafts] = useState<ReviewDraft[]>([]);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const [savingDrafts, setSavingDrafts] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  async function onFile(file: File | null | undefined) {
    if (!file) return;
    setUploadNote(null);
    const text = await file.text();
    const parsed = parseCheckRules(file.name, text);
    if (parsed.drafts.length === 0) {
      setUploadNote("That file had nothing in it we could turn into a check.");
      return;
    }
    setDrafts(
      parsed.drafts.map((draft, index) => ({
        key: `${Date.now()}-${index}`,
        title: draft.title,
        body: draft.body,
        error: null,
      })),
    );
    setUploadNote(parsed.truncated ? truncationLine(parsed.total) : null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function saveDrafts() {
    if (!profile?.org_id || !profile?.id || savingDrafts) return;
    setSavingDrafts(true);
    const remaining: ReviewDraft[] = [];
    let saved = 0;
    for (const draft of drafts) {
      if (!draft.title.trim() || !draft.body.trim()) {
        remaining.push({ ...draft, error: "A check needs both a name and a body." });
        continue;
      }
      try {
        await insertFirmCheck({
          orgId: profile.org_id,
          authorProfileId: profile.id,
          title: draft.title,
          body: draft.body,
          engagementId: null,
          subjectProfileId: null,
        });
        saved += 1;
      } catch (e) {
        remaining.push({ ...draft, error: `Not saved: ${(e as Error).message}` });
      }
    }
    if (saved > 0) {
      void queryClient.invalidateQueries({ queryKey: ["firm-checks"] });
      void queryClient.invalidateQueries({ queryKey: ["firm-check-library"] });
    }
    setDrafts(remaining);
    setSavingDrafts(false);
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
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <label className="cursor-pointer rounded-full border border-border bg-card px-3 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground">
              Upload rules (.txt or .md)
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.md,text/plain,text/markdown"
                className="sr-only"
                onChange={(e) => void onFile(e.target.files?.[0])}
              />
            </label>
            <p className="text-xs text-muted-foreground">{UPLOAD_HONESTY_LINE}</p>
          </div>
          {uploadNote ? <p className="text-xs text-muted-foreground">{uploadNote}</p> : null}

          {drafts.length > 0 ? (
            <div className="space-y-3">
              <p className="micro-label">Review these drafts</p>
              {drafts.map((draft) => (
                <div
                  key={draft.key}
                  className="space-y-2 rounded-[var(--radius)] border border-border px-3 py-3"
                >
                  <Input
                    value={draft.title}
                    onChange={(e) =>
                      setDrafts((prev) =>
                        prev.map((d) => (d.key === draft.key ? { ...d, title: e.target.value } : d)),
                      )
                    }
                    placeholder="What the check is called"
                  />
                  <Textarea
                    value={draft.body}
                    rows={3}
                    onChange={(e) =>
                      setDrafts((prev) =>
                        prev.map((d) => (d.key === draft.key ? { ...d, body: e.target.value } : d)),
                      )
                    }
                    placeholder="What the work should show"
                  />
                  {draft.error ? <p className="text-xs text-destructive">{draft.error}</p> : null}
                  <button
                    type="button"
                    onClick={() => setDrafts((prev) => prev.filter((d) => d.key !== draft.key))}
                    className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Remove this draft
                  </button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => void saveDrafts()} disabled={savingDrafts}>
                {savingDrafts ? "Saving" : `Save ${drafts.length} ${drafts.length === 1 ? "check" : "checks"}`}
              </Button>
            </div>
          ) : null}
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


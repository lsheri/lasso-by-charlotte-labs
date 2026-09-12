import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { logEvent } from "@/lib/telemetry";
import { daysToNoteBand } from "@/lib/coach-notes";
import { logV2 } from "@/lib/telemetry-v2";

export type CitationOption = { id: string; kind: "decision" | "task"; label: string };

export function NoteComposer({
  subjectId,
  engagementId,
  citations,
  latestActivityAt,
}: {
  subjectId: string;
  engagementId: string;
  citations: CitationOption[];
  /** The last thing that happened in this work, when it is known. */
  latestActivityAt?: string | null;
}) {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [didWell, setDidWell] = useState("");
  const [wouldTry, setWouldTry] = useState("");
  const [watchNext, setWatchNext] = useState("");
  const [cited, setCited] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setCited((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function save() {
    if (!profile) return;
    if (!didWell.trim() || !wouldTry.trim() || !watchNext.trim()) {
      setError("All three fields help the conversation land, please fill each one.");
      return;
    }
    if (cited.length === 0) {
      setError("Point to at least one decision or workstream so the note is grounded in real work.");
      return;
    }
    setPending(true);
    setError(null);

    const { data, error: insertError } = await supabase
      .from("coaching_notes")
      .insert({
        author_id: profile.id,
        subject_id: subjectId,
        engagement_id: engagementId,
        did_well: didWell.trim(),
        would_try: wouldTry.trim(),
        watch_next: watchNext.trim(),
      })
      .select("id")
      .maybeSingle();

    if (insertError || !data) {
      setError(insertError?.message ?? "Could not save this note.");
      setPending(false);
      return;
    }

    const rows = cited
      .map((id) => citations.find((c) => c.id === id))
      .filter((c): c is CitationOption => Boolean(c))
      .map((c) =>
        c.kind === "decision"
          ? { note_id: data.id, decision_id: c.id, task_id: null }
          : { note_id: data.id, decision_id: null, task_id: c.id },
      );
    const { error: citeError } = await supabase.from("note_cites").insert(rows);
    if (citeError) {
      setError(citeError.message);
      setPending(false);
      return;
    }

    logEvent("note.created", profile.org_id, {
      cites_count: cited.length,
      days_to_note_band: daysToNoteBand(latestActivityAt ?? null, new Date()),
    });
    logV2("coaching.note_created", { cites_count: cited.length }, { profileId: profile.id });
    await queryClient.invalidateQueries({ queryKey: ["packet", engagementId, subjectId] });
    await queryClient.invalidateQueries({ queryKey: ["coach-subjects"] });
    setDidWell("");
    setWouldTry("");
    setWatchNext("");
    setCited([]);
    setPending(false);
    toast.success("Coaching note shared");
  }

  return (
    <section className="rounded-[var(--radius-control)] border border-[var(--nb-pencil)] bg-card px-5 py-5">
      <h2 className="micro-label micro-label-section">Write a coaching note</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Your words, in your voice. Your colleague sees this note.
      </p>

      <div className="mt-4 space-y-4">
        <Field label="What went well">
          <Textarea rows={2} value={didWell} onChange={(e) => setDidWell(e.target.value)} />
        </Field>
        <Field label="What to try">
          <Textarea rows={2} value={wouldTry} onChange={(e) => setWouldTry(e.target.value)} />
        </Field>
        <Field label="What to watch">
          <Textarea rows={2} value={watchNext} onChange={(e) => setWatchNext(e.target.value)} />
        </Field>

        <div>
          <p className="micro-label mb-2">Point to the work (at least one)</p>
          {citations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing to cite yet in this engagement.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {citations.map((citation) => (
                <button
                  key={citation.id}
                  type="button"
                  onClick={() => toggle(citation.id)}
                  className={
                    cited.includes(citation.id)
                      ? "rounded-full border border-accent bg-accent-soft px-3 py-1 text-xs text-accent-deep"
                      : "rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  }
                >
                  {citation.kind === "decision" ? "Decision · " : "Workstream · "}
                  {citation.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button type="button" disabled={pending} onClick={() => void save()}>
          {pending ? "Sharing…" : "Share note"}
        </Button>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="micro-label mb-1.5">{label}</div>
      {children}
    </div>
  );
}

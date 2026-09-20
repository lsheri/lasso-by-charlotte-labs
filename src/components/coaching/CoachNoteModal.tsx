import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";
import {
  markNoteRead,
  unreadNotesKey,
  useNoteReplies,
  useSendNoteReply,
  type UnreadNote,
} from "@/hooks/use-coach-note-thread";
import { newestAgeBand } from "@/lib/coach-notes";
import { firstName, scopeLabel, scopeOf } from "@/lib/coach-note-scope";
import { vocabFor } from "@/lib/edu-vocab";
import { logEvent } from "@/lib/telemetry";

export type ModalNote = UnreadNote;

function noteDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** What the note points at, named in one line. One small read, on open. */
function usePointsAt(note: ModalNote | null) {
  return useQuery({
    queryKey: ["coachnote-target", note?.id],
    enabled: Boolean(note && (note.task_id || note.work_item_id)),
    queryFn: async (): Promise<string | null> => {
      if (note?.work_item_id) {
        const { data } = await supabase
          .from("work_items")
          .select("title")
          .eq("id", note.work_item_id)
          .maybeSingle();
        return data?.title ?? null;
      }
      if (note?.task_id) {
        const { data } = await supabase
          .from("tasks")
          .select("name")
          .eq("id", note.task_id)
          .maybeSingle();
        return data?.name ?? null;
      }
      return null;
    },
  });
}

/**
 * PASS D — one note, opened. The three fields as written, the work they point
 * at, and the conversation that follows. Opening it as the subject is what
 * marks it read; nobody is told anything else about the reading.
 */
export function CoachNoteModal({
  note,
  open,
  onOpenChange,
}: {
  note: ModalNote | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const vocab = vocabFor(profile);
  const amCoach = profile?.role === "coach";
  const { data: replies } = useNoteReplies(open && note ? note.id : undefined);
  const { data: pointsAt } = usePointsAt(open ? note : null);
  const send = useSendNoteReply(note?.id, profile?.id);
  const [draft, setDraft] = useState("");
  const markedRef = useRef<string | null>(null);

  // The read mark belongs to the subject only, and is written once.
  useEffect(() => {
    if (!open || !note || amCoach || !profile?.org_id) return;
    if (markedRef.current === note.id) return;
    markedRef.current = note.id;
    void markNoteRead(note.id)
      .then(() => {
        logEvent("coachnote.read", profile.org_id, {
          surface: "note",
          notes_shown_band: "1",
          newest_age_band: newestAgeBand(note.created_at),
        });
        // Both lists the circle reads: the unread set and the full page rows
        // (their read_at feeds the circle on the notes page).
        return Promise.all([
          queryClient.invalidateQueries({ queryKey: unreadNotesKey(profile.id) }),
          queryClient.invalidateQueries({ queryKey: ["notes-about-me-all", profile.id] }),
        ]);
      })
      .catch(() => {
        /* a read mark that does not land leaves the circle in place */
      });
  }, [open, note, amCoach, profile?.org_id, profile?.id, queryClient]);

  if (!note) return null;

  const scope = scopeOf(note);
  const coach = note.profiles?.display_name ?? "your coach";
  const header = `NOTE FROM ${coach.toUpperCase()} · ${noteDate(note.created_at).toUpperCase()} · ${scopeLabel(
    scope,
    vocab,
  ).toUpperCase()}`;

  async function onSend() {
    const body = draft.trim();
    if (!body || !profile) return;
    await send.mutateAsync(body);
    logEvent("coachnote.replied", profile.org_id, { by: amCoach ? "coach" : "subject" });
    setDraft("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="nb-note-modal max-w-[720px] gap-0 p-0">
        <div className="border-b border-[var(--nb-pencil)] px-6 py-4">
          <DialogTitle className="micro-label text-left">{header}</DialogTitle>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          <div className="space-y-4">
            <Field label="What went well" value={note.did_well} />
            <Field label="What to try" value={note.would_try} />
            <Field label="What to watch" value={note.watch_next} />
          </div>

          {note.engagement_id ? (
            <div className="mt-5 rounded-[var(--radius-md)] border border-[var(--nb-rule)] bg-muted/40 px-4 py-3">
              <p className="micro-label">{scopeLabel(scope, vocab).toUpperCase()}</p>
              <p className="mt-1 text-[13px] text-foreground">
                {pointsAt ?? "This engagement"}
              </p>
              <Link
                to="/engagements/$id"
                params={{ id: note.engagement_id }}
                search={{ work: note.task_id ?? undefined }}
                onClick={() => onOpenChange(false)}
                className="mt-2 inline-block font-hand text-[16px] text-green underline underline-offset-2"
              >
                Open the work
              </Link>
            </div>
          ) : null}

          <div className="mt-6 space-y-3">
            {(replies ?? []).map((reply) => {
              const mine = reply.author_id === profile?.id;
              return (
                <div key={reply.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={
                      mine
                        ? "max-w-[78%] rounded-[var(--radius-md)] border border-[var(--nb-yellow-edge)] bg-[var(--nb-yellow-wash)] px-3 py-2 text-[13px] text-foreground"
                        : "max-w-[78%] rounded-[var(--radius-md)] border border-[var(--nb-pencil)] bg-card px-3 py-2 text-[13px] text-foreground"
                    }
                  >
                    <p className="whitespace-pre-wrap">{reply.body}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5">
            <Textarea
              rows={2}
              value={draft}
              placeholder="write back"
              onChange={(event) => setDraft(event.target.value)}
              className="font-hand text-[16px] placeholder:font-hand placeholder:text-[16px]"
            />
            <Button
              type="button"
              className="mt-3"
              disabled={send.isPending || draft.trim().length === 0}
              onClick={() => void onSend()}
            >
              {send.isPending ? "Sending…" : "Send"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="micro-label mb-1">{label}</p>
      <p className="whitespace-pre-wrap text-[16px] leading-[24px] text-foreground">{value}</p>
    </div>
  );
}

export { firstName };

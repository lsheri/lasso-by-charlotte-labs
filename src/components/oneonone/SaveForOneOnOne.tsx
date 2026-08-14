import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { logV2 } from "@/lib/telemetry-v2";

/** What a saved note came from. Nothing else is ever written. */
export type OneOnOneNoteKind = "analysis_finding" | "chat_excerpt";

export type SaveForOneOnOneTarget = {
  text: string;
  kind: OneOnOneNoteKind;
  sessionId: string | null;
};

/** A long answer is trimmed to the part a person would actually read out. */
const EXCERPT_CAP = 1200;

export function trimExcerpt(text: string): string {
  const clean = text.trim();
  return clean.length <= EXCERPT_CAP ? clean : `${clean.slice(0, EXCERPT_CAP).trimEnd()}…`;
}

/**
 * Save one thing from a chat into the next 1:1. Two fields only: what was said,
 * and what the person wants to say about it.
 */
export function SaveForOneOnOneDialog({
  target,
  onOpenChange,
  profileId,
  orgId,
}: {
  target: SaveForOneOnOneTarget | null;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  orgId: string;
}) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [talkingPoint, setTalkingPoint] = useState("");

  useEffect(() => {
    if (target) {
      setContent(trimExcerpt(target.text));
      setTalkingPoint("");
    }
  }, [target]);

  const save = useMutation({
    mutationFn: async () => {
      if (!target) return;
      const { error } = await supabase.from("one_on_one_notes").insert({
        org_id: orgId,
        owner_id: profileId,
        source_session_id: target.sessionId,
        kind: target.kind,
        content: content.trim(),
        talking_point: talkingPoint.trim() ? talkingPoint.trim() : null,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      logV2("one_on_one.prepared", { item_count: 1 }, { profileId });
      toast.success("Saved for your next 1:1.");
      await queryClient.invalidateQueries({ queryKey: ["one-on-one-notes", profileId] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save for 1:1</DialogTitle>
          <DialogDescription>
            This is yours. It appears on your 1:1 prep page, above the brief.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <p className="micro-label">The part that matters</p>
            <Textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={7}
              className="mt-1 resize-none"
            />
          </div>
          <div>
            <p className="micro-label">What I want to say about this</p>
            <Input
              value={talkingPoint}
              onChange={(event) => setTalkingPoint(event.target.value)}
              placeholder="Optional, one line"
              className="mt-1"
            />
          </div>
          <Button
            type="button"
            disabled={save.isPending || !content.trim()}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type NoteRow = {
  id: string;
  kind: string;
  content: string;
  talking_point: string | null;
  discussed: boolean;
  created_at: string;
  source_session_id: string | null;
};

/**
 * What the person chose to bring, in their own order of importance: the line
 * they want to say first, then the thing it came from, then where it came from.
 */
export function SavedForOneOnOne({ profileId }: { profileId: string }) {
  const queryClient = useQueryClient();

  const { data: notes } = useQuery({
    queryKey: ["one-on-one-notes", profileId],
    queryFn: async (): Promise<NoteRow[]> => {
      const { data, error } = await supabase
        .from("one_on_one_notes")
        .select("id, kind, content, talking_point, discussed, created_at, source_session_id")
        .eq("owner_id", profileId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as NoteRow[];
    },
  });

  const sessionIds = Array.from(
    new Set((notes ?? []).map((n) => n.source_session_id).filter((id): id is string => Boolean(id))),
  );

  const { data: sessions } = useQuery({
    queryKey: ["one-on-one-note-sessions", sessionIds.join(",")],
    enabled: sessionIds.length > 0,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data } = await supabase
        .from("chat_sessions")
        .select("id, title")
        .in("id", sessionIds);
      return Object.fromEntries((data ?? []).map((row) => [row.id, row.title ?? "A chat"]));
    },
  });

  async function setDiscussed(id: string, discussed: boolean) {
    const { error } = await supabase.from("one_on_one_notes").update({ discussed }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["one-on-one-notes", profileId] });
  }

  if (!notes || notes.length === 0) return null;

  return (
    <section className="mb-6">
      <h2 className="micro-label">You wanted to talk about</h2>
      <div className="mt-3 space-y-3">
        {notes.map((note) => (
          <div
            key={note.id}
            className={`rounded-[var(--radius)] border border-border bg-card px-4 py-3 shadow-card ${
              note.discussed ? "opacity-60" : ""
            }`}
          >
            {note.talking_point ? (
              <p className="text-sm font-medium text-foreground">{note.talking_point}</p>
            ) : null}
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{note.content}</p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                {note.kind === "analysis_finding" ? "From an analysis" : "From a chat"}
                {note.source_session_id && sessions?.[note.source_session_id]
                  ? ` · ${sessions[note.source_session_id]}`
                  : ""}{" "}
                · {new Date(note.created_at).toLocaleDateString()}
              </p>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={note.discussed}
                  onCheckedChange={(value) => void setDiscussed(note.id, value === true)}
                />
                Discussed
              </label>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { GraphiteRule } from "@/components/notebook/marks";
import { Checkbox } from "@/components/ui/checkbox";
import { useMotion } from "@/hooks/use-motion";
import { supabase } from "@/integrations/supabase/client";
import {
  newestSessionId,
  noteTilt,
  noteTint,
  sessionDateLabel,
  todayValue,
} from "@/lib/oneonone-sessions";
import { logEvent } from "@/lib/telemetry";

type SessionRow = { id: string; held_on: string; created_at: string; title: string | null };
type StickyRow = { id: string; content: string; discussed: boolean; created_at: string };

/** The kind written on every note this surface makes. Free text column, one value. */
const STICKY = "sticky";

/**
 * PASS C · the hour itself: a dated session, and the notes a person wants to
 * bring to it. Owner only. Nothing here is sent anywhere.
 */
export function SessionStickies({ profileId, orgId }: { profileId: string; orgId: string }) {
  const queryClient = useQueryClient();
  const landed = useMotion("oneonone.note_landed");
  const [selected, setSelected] = useState<string | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [dateValue, setDateValue] = useState(todayValue());
  const [draft, setDraft] = useState("");

  const { data: sessions } = useQuery({
    queryKey: ["one-on-one-sessions", profileId],
    queryFn: async (): Promise<SessionRow[]> => {
      const { data, error } = await supabase
        .from("one_on_one_sessions")
        .select("id, held_on, created_at, title")
        .eq("owner_id", profileId)
        .order("held_on", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SessionRow[];
    },
  });

  const list = sessions ?? [];
  const current = selected ?? newestSessionId(list);

  useEffect(() => {
    if (selected && !list.some((row) => row.id === selected)) setSelected(null);
  }, [selected, list]);

  const { data: notes } = useQuery({
    queryKey: ["one-on-one-stickies", current],
    enabled: Boolean(current),
    queryFn: async (): Promise<StickyRow[]> => {
      const { data, error } = await supabase
        .from("one_on_one_notes")
        .select("id, content, discussed, created_at")
        .eq("session_id", current as string)
        .eq("kind", STICKY)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as StickyRow[];
    },
  });

  const createSession = useMutation({
    mutationFn: async (heldOn: string) => {
      const { data, error } = await supabase
        .from("one_on_one_sessions")
        .insert({ org_id: orgId, owner_id: profileId, held_on: heldOn })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: async (id) => {
      logEvent("oneonone.session_created", orgId, {});
      setSelected(id);
      setDateOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["one-on-one-sessions", profileId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addNote = useMutation({
    mutationFn: async (text: string) => {
      if (!current) return;
      const { error } = await supabase.from("one_on_one_notes").insert({
        org_id: orgId,
        owner_id: profileId,
        session_id: current,
        kind: STICKY,
        content: text,
        talking_point: null,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      logEvent("oneonone.note_added", orgId, { kind: STICKY });
      setDraft("");
      await queryClient.invalidateQueries({ queryKey: ["one-on-one-stickies", current] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function setDiscussed(id: string, discussed: boolean) {
    const { error } = await supabase.from("one_on_one_notes").update({ discussed }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (discussed) logEvent("oneonone.note_discussed", orgId, { kind: STICKY });
    await queryClient.invalidateQueries({ queryKey: ["one-on-one-stickies", current] });
  }

  async function removeNote(id: string) {
    const { error } = await supabase.from("one_on_one_notes").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["one-on-one-stickies", current] });
  }

  const currentRow = list.find((row) => row.id === current) ?? null;
  const older = list.filter((row) => row.id !== current);

  const dateField = (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="date"
        aria-label="When is your next 1:1"
        value={dateValue}
        onChange={(event) => setDateValue(event.target.value)}
        className="h-8 rounded-[var(--radius-control)] border border-[var(--nb-pencil)] bg-card px-2 font-mono text-[11px] text-foreground"
      />
      <button
        type="button"
        disabled={createSession.isPending || !dateValue}
        onClick={() => createSession.mutate(dateValue)}
        className="font-hand text-[16px] text-green transition-opacity hover:opacity-70 disabled:opacity-60"
      >
        {createSession.isPending ? "adding…" : "add it"}
      </button>
    </div>
  );

  if (list.length === 0) {
    return (
      <section className="mb-8">
        <p className="font-hand text-[16px] text-soft">when is your next one?</p>
        <div className="mt-2">{dateField}</div>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="relative inline-block">
          <h2 className="font-hand text-[30px] font-bold leading-none text-foreground">
            {currentRow ? sessionDateLabel(currentRow.held_on) : ""}
          </h2>
          <GraphiteRule className="mt-1 h-[6px] w-full text-[var(--nb-pencil)]" />
        </div>
        <button
          type="button"
          onClick={() => setDateOpen((open) => !open)}
          className="font-hand text-[16px] text-green transition-opacity hover:opacity-70"
        >
          + new 1:1
        </button>
      </div>

      {dateOpen ? <div className="mt-3">{dateField}</div> : null}

      {older.length > 0 ? (
        <ul className="mt-3 divide-y divide-border border-t border-border">
          {older.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => setSelected(row.id)}
                className="w-full py-2 text-left font-mono text-[11px] uppercase tracking-[0.08em] text-soft transition-colors hover:text-foreground"
              >
                {sessionDateLabel(row.held_on)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-4">
        {(notes ?? []).map((note, index) => (
          <div key={note.id} className={landed.className}>
          <div
            style={{ backgroundColor: noteTint(index) }}
            className={`flex h-[180px] w-[220px] max-w-full flex-col justify-between rounded-[var(--radius-sm)] border border-[var(--nb-pencil)] p-3 ${noteTilt(note.id)} ${note.discussed ? "opacity-60" : ""}`}
          >
            <p className="overflow-hidden whitespace-pre-wrap font-hand text-[18px] leading-[22px] text-foreground">
              {note.content}
            </p>
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.08em] text-soft">
                <Checkbox
                  checked={note.discussed}
                  onCheckedChange={(value) => void setDiscussed(note.id, value === true)}
                  aria-label="Discussed"
                />
                Discussed
              </label>
              <button
                type="button"
                onClick={() => void removeNote(note.id)}
                className="font-mono text-[10px] uppercase tracking-[0.08em] text-soft transition-colors hover:text-foreground"
              >
                remove
              </button>
            </div>
          </div>
          </div>
        ))}

        <div className="flex h-[180px] w-[220px] max-w-full flex-col justify-between rounded-[var(--radius-sm)] border border-dashed border-[var(--nb-pencil)] bg-card p-3">
          <textarea
            value={draft}
            aria-label="add a note"
            placeholder="add a note"
            disabled={!current || addNote.isPending}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                const text = draft.trim();
                if (text) addNote.mutate(text);
              }
            }}
            className="h-full w-full resize-none bg-transparent font-hand text-[18px] leading-[22px] text-foreground outline-none placeholder:text-soft"
          />
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-soft">
            <span aria-hidden>+ </span>
            Enter to pin it
          </p>
        </div>
      </div>
      {landed.still ? <p className="mt-2 font-hand text-[16px] text-soft">{landed.reduced}</p> : null}
    </section>
  );
}

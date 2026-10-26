import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const COPY = { search: "Search this chat", you: "You", ai: "AI", title: "Point to a chat turn", back: "Back", loading: "Reading chat…", empty: "No turns", error: "Chat could not be opened.", turn: (n: number) => `turn ${n}` };
type Turn = { id: string; turn_no: number; role: string; content: string; content_hash?: string | null; ts: string | null; model?: string | null; meta?: unknown };

export function DecisionTurnPicker({ parentId, onSelect, onClose }: { parentId: string; onSelect: (turn: number) => void; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  const turns = useQuery({
    // Identical key and projection to ThreadBody, so opening either shares the transcript.
    queryKey: ["turns", parentId],
    queryFn: async (): Promise<Turn[]> => {
      const { data, error } = await supabase.from("turns").select("id, turn_no, role, content, content_hash, ts, model, meta").eq("work_item_id", parentId).order("turn_no", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
  const rows = [...(turns.data ?? [])].sort((a, b) => a.turn_no - b.turn_no).filter((turn) => turn.content.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return <section role="dialog" aria-label={COPY.title} className="lasso-decisions-turn-picker" onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); } }}>
    <header><h2>{COPY.title}</h2><Button variant="ghost" onClick={onClose}>{COPY.back}</Button></header>
    <input ref={input} aria-label={COPY.search} placeholder={COPY.search} value={search} onChange={(event) => setSearch(event.target.value)} />
    {turns.isLoading ? <p>{COPY.loading}</p> : turns.isError ? <p role="alert">{COPY.error}</p> : rows.length === 0 ? <p>{COPY.empty}</p> : <ol>{rows.map((turn) => <li key={turn.id}><Button variant="ghost" onClick={() => onSelect(turn.turn_no)}><span>{COPY.turn(turn.turn_no)} · {turn.role === "user" ? COPY.you : COPY.ai}</span><span>{turn.content.slice(0, 160)}</span></Button></li>)}</ol>}
  </section>;
}
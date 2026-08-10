import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { parseThread, sha256 } from "@/lib/parse-thread";
import { logEvent } from "@/lib/telemetry";

const SOURCES = ["chatgpt", "claude", "gemini", "other"] as const;
type Source = (typeof SOURCES)[number];

export function PasteThreadDialog({ trigger }: { trigger: React.ReactNode }) {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const [title, setTitle] = useState("");
  const [source, setSource] = useState<Source>("chatgpt");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => (raw.trim() ? parseThread(raw) : null), [raw]);

  async function handleSave() {
    if (!profile || !raw.trim()) return;
    setPending(true);
    setError(null);

    const result = parseThread(raw);
    const firstUser = result.turns.find((t) => t.role === "user") ?? result.turns[0];
    const derivedTitle =
      title.trim() || (firstUser ? firstUser.content.slice(0, 60) : "Pasted thread");
    const contentHash = await sha256(raw);

    const { data: item, error: itemError } = await supabase
      .from("work_items")
      .insert({
        owner_id: profile.id,
        org_id: profile.org_id,
        type: "ai_thread",
        source: source === "other" ? "paste" : source,
        title: derivedTitle,
        content_hash: contentHash,
        ts_precision: "capture",
        meta: { turns_resolved: result.resolved },
      })
      .select("id")
      .maybeSingle();

    if (itemError || !item) {
      setError(itemError?.message ?? "Could not save this thread.");
      setPending(false);
      return;
    }

    const turnRows = await Promise.all(
      result.turns.map(async (turn) => ({
        work_item_id: item.id,
        turn_no: turn.turn_no,
        role: turn.role,
        content: turn.content,
        content_hash: await sha256(turn.content),
        ts: null,
        ts_precision: "capture" as const,
      })),
    );

    const { error: turnsError } = await supabase.from("turns").insert(turnRows);
    if (turnsError) {
      setError(turnsError.message);
      setPending(false);
      return;
    }

    logEvent("workitem.captured", profile.org_id, {
      type: "ai_thread",
      source: source === "other" ? "paste" : source,
    });

    await queryClient.invalidateQueries({ queryKey: ["work-items"] });
    setPending(false);
    setOpen(false);
    setRaw("");
    setTitle("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="page-title">Paste a thread</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            rows={12}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="Paste a ChatGPT, Claude, or Gemini conversation"
            className="font-mono text-xs leading-relaxed"
          />

          <p className="micro-label">
            {parsed
              ? parsed.resolved
                ? `${parsed.turns.length} turns detected`
                : "Couldn't split turns — will save as one block"
              : "Nothing pasted yet"}
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="thread-title" className="micro-label">
                Title (optional)
              </Label>
              <Input
                id="thread-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Auto from first turn"
              />
            </div>
            <div className="space-y-1.5">
              <span className="micro-label">Source</span>
              <div className="flex gap-1 rounded-[var(--radius)] bg-secondary p-1">
                {SOURCES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSource(value)}
                    className={
                      source === value
                        ? "flex-1 rounded-[calc(var(--radius)-4px)] bg-card px-2 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-foreground shadow-card"
                        : "flex-1 rounded-[calc(var(--radius)-4px)] px-2 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:text-foreground"
                    }
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button onClick={handleSave} disabled={pending || !raw.trim()} className="w-full">
            {pending ? "Saving…" : "Save thread"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

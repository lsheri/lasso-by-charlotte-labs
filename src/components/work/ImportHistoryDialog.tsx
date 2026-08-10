import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import {
  parseExport,
  readExportFile,
  serializeConversation,
  type ImportedConversation,
  type ImportPlatform,
} from "@/lib/ai-history";
import { sha256 } from "@/lib/parse-thread";
import { logEvent } from "@/lib/telemetry";
import { formatDate } from "@/lib/work-types";

const PLATFORMS: { value: ImportPlatform; label: string }[] = [
  { value: "chatgpt", label: "ChatGPT export" },
  { value: "claude", label: "Claude export" },
];

const SCOPES = [
  { value: 50, label: "Most recent 50" },
  { value: 100, label: "Most recent 100" },
  { value: 0, label: "All" },
];

const BATCH = 15;

type Step = "choose" | "summary" | "running" | "done";

export function ImportHistoryDialog({ trigger }: { trigger: React.ReactNode }) {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<ImportPlatform>("chatgpt");
  const [step, setStep] = useState<Step>("choose");
  const [conversations, setConversations] = useState<ImportedConversation[]>([]);
  const [scope, setScope] = useState(100);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setStep("choose");
    setConversations([]);
    setScope(100);
    setProgress(0);
    setResult(null);
    setError(null);
  }

  async function handleFile(file: File) {
    setError(null);
    try {
      const raw = await readExportFile(file);
      const parsed = parseExport(platform, raw);
      if (parsed.length === 0) throw new Error("No conversations with content found in that file.");
      setConversations(parsed);
      setStep("summary");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function runImport() {
    if (!profile) return;
    setStep("running");
    setError(null);
    const source = `import:${platform}`;
    const selected = scope > 0 ? conversations.slice(0, scope) : conversations;

    const existing = await supabase
      .from("work_items")
      .select("meta")
      .eq("owner_id", profile.id)
      .eq("source", source);
    if (existing.error) {
      setError(existing.error.message);
      setStep("summary");
      return;
    }
    const seen = new Set(
      (existing.data ?? [])
        .map((row) => (row.meta as { orig_id?: string } | null)?.orig_id)
        .filter((id): id is string => Boolean(id)),
    );

    const fresh = selected.filter((c) => !seen.has(c.orig_id));
    const skipped = selected.length - fresh.length;
    let imported = 0;

    for (let i = 0; i < fresh.length; i += BATCH) {
      const batch = fresh.slice(i, i + BATCH);
      const rows = await Promise.all(
        batch.map(async (conv) => ({
          owner_id: profile.id,
          org_id: profile.org_id,
          type: "ai_thread" as const,
          source,
          title: conv.title.slice(0, 200),
          visibility: "unmapped" as const,
          content_hash: await sha256(serializeConversation(conv)),
          ts_precision: "source" as const,
          created_at_source: conv.created_at,
          meta: { orig_id: conv.orig_id, imported: true },
        })),
      );

      const inserted = await supabase.from("work_items").insert(rows).select("id, meta");
      if (inserted.error) {
        setError(inserted.error.message);
        setStep("summary");
        return;
      }

      const byOrigId = new Map(
        (inserted.data ?? []).map((row) => [
          (row.meta as { orig_id?: string } | null)?.orig_id ?? "",
          row.id,
        ]),
      );

      const turnRows = (
        await Promise.all(
          batch.map(async (conv) => {
            const workItemId = byOrigId.get(conv.orig_id);
            if (!workItemId) return [];
            return Promise.all(
              conv.turns.map(async (turn) => ({
                work_item_id: workItemId,
                turn_no: turn.turn_no,
                role: turn.role,
                content: turn.content,
                content_hash: await sha256(turn.content),
                ts: turn.ts,
                ts_precision: "source" as const,
              })),
            );
          }),
        )
      ).flat();

      if (turnRows.length > 0) {
        const turnsInsert = await supabase.from("turns").insert(turnRows);
        if (turnsInsert.error) {
          setError(turnsInsert.error.message);
          setStep("summary");
          return;
        }
      }

      imported += batch.length;
      setProgress(Math.round((Math.min(i + BATCH, fresh.length) / Math.max(fresh.length, 1)) * 100));
    }

    logEvent("import.completed", profile.org_id, { source, imported });
    await queryClient.invalidateQueries({ queryKey: ["work-items"] });
    setResult({ imported, skipped });
    setStep("done");
  }

  const newest = conversations[0]?.created_at ?? null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="page-title">Import AI history</DialogTitle>
        </DialogHeader>

        {step === "choose" ? (
          <div className="space-y-4">
            <div>
              <span className="micro-label">Platform</span>
              <div className="mt-1.5 flex gap-1 rounded-[var(--radius)] bg-secondary p-1">
                {PLATFORMS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPlatform(option.value)}
                    className={
                      platform === option.value
                        ? "flex-1 rounded-[calc(var(--radius)-4px)] bg-card px-2 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-foreground shadow-card"
                        : "flex-1 rounded-[calc(var(--radius)-4px)] px-2 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:text-foreground"
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="micro-label">Export file</span>
              <input
                type="file"
                accept=".json,.zip"
                aria-label="Export file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                }}
                className="block w-full rounded-[var(--radius)] border border-border bg-card px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-full file:border-0 file:bg-secondary file:px-3 file:py-1 file:font-mono file:text-[11px] file:uppercase file:tracking-[0.08em]"
              />
              <p className="text-sm text-muted-foreground">
                Your export stays in the browser — only conversations you import are saved.
              </p>
            </div>
          </div>
        ) : null}

        {step === "summary" ? (
          <div className="space-y-4">
            <p className="text-sm text-foreground">
              {conversations.length} conversations found
              {newest ? ` · newest ${formatDate(newest)}` : ""}
            </p>
            <div>
              <span className="micro-label">Import scope</span>
              <div className="mt-1.5 flex gap-1 rounded-[var(--radius)] bg-secondary p-1">
                {SCOPES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setScope(option.value)}
                    className={
                      scope === option.value
                        ? "flex-1 rounded-[calc(var(--radius)-4px)] bg-card px-2 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-foreground shadow-card"
                        : "flex-1 rounded-[calc(var(--radius)-4px)] px-2 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:text-foreground"
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            {scope === 0 ? (
              <p className="text-sm text-muted-foreground">
                Importing everything can take a while and will fill Unmapped with{" "}
                {conversations.length} threads.
              </p>
            ) : null}
            <Button className="w-full" onClick={() => void runImport()}>
              Import
            </Button>
          </div>
        ) : null}

        {step === "running" ? (
          <div className="space-y-3">
            <Progress value={progress} />
            <p className="micro-label">Importing… {progress}%</p>
          </div>
        ) : null}

        {step === "done" && result ? (
          <div className="space-y-4">
            <p className="text-sm text-foreground">
              Imported {result.imported} conversation{result.imported === 1 ? "" : "s"} (
              {result.skipped} skipped as duplicates). They're in Unmapped — map what matters, or
              let Lasso suggest.
            </p>
            <Button className="w-full" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </DialogContent>
    </Dialog>
  );
}

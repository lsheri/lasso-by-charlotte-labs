import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { PasteThreadDialog } from "@/components/work/PasteThreadDialog";
import { OrganizeStep } from "@/components/work/import/OrganizeStep";
import { SelectionTable } from "@/components/work/import/SelectionTable";
import { VendorGuide } from "@/components/work/import/VendorGuide";
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
import { commitImport } from "@/lib/import-commit";
import {
  parseImport,
  readImportFiles,
  type ParseFailure,
  type ParsedConversation,
} from "@/lib/import-parsers";
import { VENDORS, VENDOR_ORDER, type ImportVendor } from "@/lib/import-vendors";
import { bucket, logEvent } from "@/lib/telemetry";

type Screen = "source" | "file" | "select" | "committing" | "done" | "organize";

function spanDays(list: ParsedConversation[]): number {
  const stamps = list
    .map((c) => c.first_ts)
    .filter((t): t is string => Boolean(t))
    .sort();
  const first = stamps[0];
  const last = stamps[stamps.length - 1];
  if (!first || !last) return 0;
  return Math.round((new Date(last).getTime() - new Date(first).getTime()) / 86_400_000);
}

function monthLabel(iso: string | null | undefined): string {
  if (!iso) return "undated";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export function ImportFlowDialog({ trigger }: { trigger: React.ReactNode }) {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState<Screen>("source");
  const [vendor, setVendor] = useState<ImportVendor | null>(null);
  const [conversations, setConversations] = useState<ParsedConversation[]>([]);
  const [failures, setFailures] = useState<ParseFailure[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ imported: number; duplicates: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setScreen("source");
    setVendor(null);
    setConversations([]);
    setFailures([]);
    setSelected(new Set());
    setProgress(0);
    setResult(null);
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next && profile && vendor && screen !== "done" && screen !== "organize") {
      logEvent("import.abandoned", profile.org_id, { vendor, last_screen: screen });
    }
    setOpen(next);
    if (!next) reset();
  }

  function chooseVendor(next: ImportVendor) {
    setVendor(next);
    setScreen("file");
    setError(null);
    if (profile) {
      logEvent("import.started", profile.org_id, { vendor: next, tier: VENDORS[next].tier });
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || !vendor) return;
    setError(null);
    try {
      const parts = await readImportFiles(Array.from(files));
      const parsed = parseImport(vendor, parts);
      if (parsed.conversations.length === 0) {
        setFailures(parsed.failures);
        throw new Error("No conversations could be read from that file.");
      }
      setConversations(parsed.conversations);
      setFailures(parsed.failures);
      setSelected(new Set());
      setScreen("select");
      if (profile) {
        logEvent("import.parsed", profile.org_id, {
          vendor,
          conversations_found_bucket: bucket(parsed.conversations.length),
          date_span_days_bucket: bucket(spanDays(parsed.conversations)),
          parse_failures: bucket(parsed.failures.length),
        });
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function commit() {
    if (!profile || !vendor) return;
    const chosen = conversations.filter((c) => selected.has(c.orig_id));
    if (chosen.length === 0) return;
    setScreen("committing");
    setError(null);
    try {
      const outcome = await commitImport({
        profileId: profile.id,
        orgId: profile.org_id,
        vendor,
        selected: chosen,
        onProgress: setProgress,
      });
      logEvent("import.committed", profile.org_id, {
        vendor,
        selected_count_bucket: bucket(chosen.length),
        excluded_count_bucket: bucket(conversations.length - chosen.length),
        ts_precision_mix: outcome.ts_precision_mix,
        duplicate_count_bucket: bucket(outcome.duplicates),
      });
      await queryClient.invalidateQueries({ queryKey: ["work-items"] });
      setResult({ imported: outcome.imported, duplicates: outcome.duplicates });
      setScreen("done");
    } catch (e) {
      setError((e as Error).message);
      setScreen("select");
    }
  }

  const found = conversations.length;
  const messages = conversations.reduce((sum, c) => sum + c.turns.length, 0);
  const sortedByDate = [...conversations].sort((a, b) =>
    (a.first_ts ?? "").localeCompare(b.first_ts ?? ""),
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="page-title">
            {vendor ? `Import from ${VENDORS[vendor].label}` : "Bring in your AI history"}
          </DialogTitle>
        </DialogHeader>

        {screen === "source" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {VENDOR_ORDER.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => chooseVendor(id)}
                className="rounded-[var(--radius)] border border-border bg-card p-4 text-left shadow-card transition-colors hover:border-accent"
              >
                <p className="text-sm font-medium text-foreground">{VENDORS[id].label}</p>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                  {VENDORS[id].tierHint}
                </p>
              </button>
            ))}
            <PasteThreadDialog
              trigger={
                <button
                  type="button"
                  className="rounded-[var(--radius)] border border-dashed border-border bg-card p-4 text-left shadow-card transition-colors hover:border-accent"
                >
                  <p className="text-sm font-medium text-foreground">Paste a conversation</p>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                    Full fidelity · nothing to download
                  </p>
                </button>
              }
            />
          </div>
        ) : null}

        {screen === "file" && vendor ? (
          <div className="grid gap-4 md:grid-cols-2">
            <VendorGuide vendor={vendor} />
            <div className="space-y-3">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void handleFiles(e.dataTransfer.files);
                }}
                className="flex h-40 flex-col items-center justify-center gap-2 rounded-[var(--radius)] border border-dashed border-border bg-card text-center"
              >
                <p className="text-sm text-foreground">Drop your export here</p>
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                  {VENDORS[vendor].accept}
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  aria-label="Export file"
                  accept={VENDORS[vendor].accept}
                  className="hidden"
                  onChange={(e) => void handleFiles(e.target.files)}
                />
                <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
                  Choose file
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Your export is read in this browser. Nothing is uploaded until you choose
                conversations.
              </p>
              <PasteThreadDialog
                trigger={
                  <button type="button" className="text-xs font-medium text-accent-deep hover:opacity-70">
                    Export not working? Paste a conversation instead
                  </button>
                }
              />
              <button
                type="button"
                onClick={() => setScreen("source")}
                className="block text-xs text-muted-foreground hover:text-foreground"
              >
                ← Choose a different source
              </button>
            </div>
          </div>
        ) : null}

        {screen === "select" && vendor ? (
          <div className="space-y-4">
            <p className="text-sm text-foreground">
              Found {found} conversation{found === 1 ? "" : "s"} ·{" "}
              {monthLabel(sortedByDate[0]?.first_ts)} –{" "}
              {monthLabel(sortedByDate[sortedByDate.length - 1]?.first_ts)} ·{" "}
              {messages.toLocaleString()} messages.
            </p>

            {failures.length > 0 ? (
              <details className="rounded-[var(--radius)] border border-border bg-secondary/60 p-3">
                <summary className="cursor-pointer text-sm text-foreground">
                  {failures.length} record{failures.length === 1 ? "" : "s"} couldn't be read
                </summary>
                <ul className="mt-2 space-y-1">
                  {failures.map((failure, i) => (
                    <li key={`${failure.record}-${i}`} className="text-xs text-muted-foreground">
                      {failure.record} — {failure.reason}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            <SelectionTable
              conversations={conversations}
              selected={selected}
              onChange={setSelected}
            />

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <div className="flex justify-end">
              <Button type="button" disabled={selected.size === 0} onClick={() => void commit()}>
                Import {selected.size} conversation{selected.size === 1 ? "" : "s"}
              </Button>
            </div>
          </div>
        ) : null}

        {screen === "committing" ? (
          <div className="space-y-3">
            <Progress value={progress} />
            <p className="micro-label">Importing… {progress}%</p>
          </div>
        ) : null}

        {screen === "done" && result ? (
          <div className="space-y-4">
            <p className="text-sm text-foreground">
              {result.imported} conversation{result.imported === 1 ? "" : "s"} added. They are
              private until you map them.
              {result.duplicates > 0
                ? ` ${result.duplicates} already in Lasso, skipped.`
                : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => setScreen("organize")}>
                Organize now
              </Button>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Leave for later
              </Button>
            </div>
          </div>
        ) : null}

        {screen === "organize" ? <OrganizeStep onDone={() => handleOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
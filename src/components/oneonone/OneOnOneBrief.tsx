import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { MarkdownMessage } from "@/components/markdown/MarkdownMessage";
import { SlideOver } from "@/components/peek/SlideOver";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ONEONONE_WINDOWS, type OneOnOneWindow } from "@/lib/oneonone-shared";
import { prepareOneOnOne, saveBriefToDrive } from "@/lib/oneonone.functions";

/** A brief the person owns: their work, their decisions, their questions. */
export function OneOnOneBrief({
  open,
  onOpenChange,
  profileId,
  engagementId,
  scopeLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  engagementId?: string | undefined;
  scopeLabel: string;
}) {
  const prepare = useServerFn(prepareOneOnOne);
  const save = useServerFn(saveBriefToDrive);
  const [days, setDays] = useState<OneOnOneWindow>(7);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: hasDrive } = useQuery({
    queryKey: ["has-drive", profileId],
    queryFn: async () => {
      const { data } = await supabase
        .from("connector_accounts")
        .select("id")
        .eq("profile_id", profileId)
        .eq("toolkit", "googledrive")
        .eq("status", "connected")
        .maybeSingle();
      return Boolean(data);
    },
  });

  const title = `1:1 brief, ${scopeLabel}, last ${days} days`;

  async function generate() {
    setBusy(true);
    try {
      const result = await prepare({
        data: { window_days: days, engagement_id: engagementId ?? null, profile_id: profileId },
      });
      setMarkdown(result.markdown);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't prepare the brief");
    } finally {
      setBusy(false);
    }
  }

  function download() {
    const blob = new Blob([markdown ?? ""], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function toDrive() {
    if (!markdown) return;
    setSaving(true);
    try {
      const result = await save({ data: { title, markdown, profile_id: profileId } });
      toast.success(result.link ? "Saved to your Drive." : "Saved to your Drive.");
      if (result.link) window.open(result.link, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save to Drive");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SlideOver
      open={open}
      onOpenChange={onOpenChange}
      title="Prepare a 1:1"
      description="A brief you take into your next 1:1"
    >
      <header className="shrink-0 border-b border-border px-6 pb-4 pt-6">
        <p className="micro-label">Prepare a 1:1</p>
        <h2 className="page-title mt-1 text-[19px] leading-snug">{scopeLabel}</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {ONEONONE_WINDOWS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setDays(option)}
              className={
                option === days
                  ? "rounded-full bg-accent-soft px-3 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-accent-deep"
                  : "rounded-full border border-border bg-card px-3 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
              }
            >
              Last {option} days
            </button>
          ))}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {markdown ? (
          <MarkdownMessage content={markdown} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Lasso reads your recorded work for the window you pick and drafts a brief: what you
            worked on, the decisions you made, and where you want input. You edit it before anyone
            sees it.
          </p>
        )}
      </div>

      <footer className="flex shrink-0 flex-wrap items-center gap-3 border-t border-border bg-card px-6 py-4">
        <Button type="button" disabled={busy} onClick={() => void generate()}>
          {busy ? (
            <WorkingLabel>Writing your brief</WorkingLabel>
          ) : markdown ? (
            "Regenerate"
          ) : (
            "Generate brief"
          )}
        </Button>
        {markdown ? (
          <>
            <button
              type="button"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => {
                void navigator.clipboard.writeText(markdown);
                toast.success("Copied.");
              }}
            >
              Copy
            </button>
            <button
              type="button"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              onClick={download}
            >
              Download .md
            </button>
            {hasDrive ? (
              <button
                type="button"
                disabled={saving}
                className="text-xs text-accent-deep transition-opacity hover:opacity-70 disabled:opacity-60"
                onClick={() => void toDrive()}
              >
                {saving ? "Saving…" : "Save to Drive"}
              </button>
            ) : null}
          </>
        ) : null}
      </footer>
    </SlideOver>
  );
}

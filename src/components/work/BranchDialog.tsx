import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { BRANCH_COPY, branchHasSigninConnector, branchPrimaryAction, branchMarkdown, branchPrompt, type BranchTurn } from "@/lib/branch-handoff";
import { BRANCH_TARGETS, BRANCH_TOOLS, branchOpenPlan, isBranchTool, type BranchTool } from "@/lib/branch-targets";
import { logEvent } from "@/lib/telemetry";
import { displayName } from "@/lib/work-item-name";

const TOOL_KEY = "lasso.branch.tool";

function readTool(): BranchTool {
  try {
    const value = window.localStorage.getItem(TOOL_KEY);
    return isBranchTool(value) ? value : "claude";
  } catch {
    return "claude";
  }
}

function writeTool(tool: BranchTool) {
  try { window.localStorage.setItem(TOOL_KEY, tool); } catch { /* storage unavailable */ }
}

function downloadText(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** BR-1: branch a piece of work into an AI tool. The source row is never written. */
export function BranchDialog({
  source,
  sourceOwnerLabel,
  open,
  onOpenChange,
  onBranched,
}: {
  source: { id: string; title: string; display_title?: string | null | undefined; owner_id?: string | null | undefined };
  /** Fallback label when the owner profile cannot be read. */
  sourceOwnerLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The new branch row exists; the caller places it on the board. */
  onBranched?: ((branchId: string) => void) | undefined;
}) {
  const { data: profile } = useProfile();
  const [tool, setTool] = useState<BranchTool>("claude");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const [hasSignin, setHasSignin] = useState(true);
  const created = useRef<{ id: string; at: string; tool: BranchTool } | null>(null);

  useEffect(() => {
    if (!open) return;
    setTool(readTool());
    setNotice(null);
    setOwnerName(null);
    created.current = null;
    // BR-3b: attribute the record to the source owner by name, the same
    // caller-scoped shared_work_display_name RPC the connector calls. Policies decide
    // visibility; a slow or refused read never blocks the branch.
    const ownerId = source.owner_id;
    if (!ownerId) return;
    let live = true;
    void supabase
      .rpc("shared_work_display_name", { p: ownerId })
      .then(({ data }) => {
        const name = typeof data === "string" ? data.trim() : "";
        if (live && name) setOwnerName(name);
      });
    return () => {
      live = false;
    };
  }, [open, source.owner_id]);

  // PRE-1: a branch link only loads through a signed-in connector. A failed
  // or slow read counts as "has one" so the main path never degrades.
  useEffect(() => {
    if (!open) return;
    setHasSignin(true);
    const profileId = profile?.id;
    if (!profileId) return;
    let live = true;
    void supabase
      .from("mcp_connections")
      .select("id")
      .eq("profile_id", profileId)
      .eq("kind", "signin")
      .is("revoked_at", null)
      .limit(1)
      .then(({ data, error }) => {
        if (live) setHasSignin(branchHasSigninConnector(error ? null : data ?? null));
      });
    return () => {
      live = false;
    };
  }, [open, profile?.id]);

  const primary = branchPrimaryAction(hasSignin);
  const ownerLabel = ownerName ?? sourceOwnerLabel;

  async function ensureBranch(id: string, chosen: BranchTool): Promise<{ id: string; at: string } | null> {
    if (created.current) return created.current;
    if (!profile) return null;
    const at = new Date().toISOString();
    const meta = { branch: { tool: chosen, source_work_item_id: source.id, opened_at: at } } as unknown as Json;
    const { error } = await supabase.from("work_items").insert({
      id,
      owner_id: profile.id,
      org_id: profile.org_id,
      parent_work_item_id: source.id,
      type: "ai_thread",
      source: "branch",
      source_vendor: BRANCH_TARGETS[chosen].vendor,
      title: `Branch of ${source.title}`,
      display_title: null,
      content_fidelity: "reference",
      meta,
    });
    if (error) {
      toast.error(BRANCH_COPY.failed);
      return null;
    }
    created.current = { id, at, tool: chosen };
    onBranched?.(id);
    return created.current;
  }

  async function handoffFile(branch: { id: string; at: string }, chosen: BranchTool) {
    const { data } = await supabase.from("turns").select("id, turn_no, role, content").eq("work_item_id", source.id).order("turn_no", { ascending: true });
    const text = branchMarkdown({
      branchId: branch.id,
      sourceId: source.id,
      sourceTitle: source.title,
      sourceOwner: ownerLabel,
      tool: chosen,
      createdAt: branch.at,
      turns: ((data ?? []) as BranchTurn[]),
    });
    downloadText(`lasso-branch-${branch.id}.md`, text);
  }

  async function openTool() {
    const chosen = tool;
    writeTool(chosen);
    const id = created.current?.id ?? crypto.randomUUID();
    const plan = branchOpenPlan(chosen, branchPrompt(id));
    // Open inside the click so the browser allows the new tab.
    window.open(plan.url, "_blank", "noopener,noreferrer");
    if (plan.handoff === "clipboard") {
      try { await navigator.clipboard.writeText(branchPrompt(id)); } catch { toast.error(BRANCH_COPY.copyFailed); }
    }
    setBusy(true);
    const branch = await ensureBranch(id, chosen);
    if (branch && plan.handoff === "clipboard" && plan.reason === "too_long") await handoffFile(branch, chosen);
    setBusy(false);
    if (!branch) return;
    if (profile?.org_id) logEvent("workitem.branched", profile.org_id, { tool: BRANCH_TARGETS[chosen].vendor, handoff: plan.handoff });
    if (plan.handoff === "clipboard") setNotice(plan.reason === "too_long" ? BRANCH_COPY.tooLong : BRANCH_COPY.clipboardReady(BRANCH_TARGETS[chosen].label));
    else onOpenChange(false);
  }

  async function download() {
    const chosen = tool;
    writeTool(chosen);
    setBusy(true);
    const branch = await ensureBranch(created.current?.id ?? crypto.randomUUID(), chosen);
    if (branch) await handoffFile(branch, chosen);
    setBusy(false);
    if (branch && profile?.org_id) logEvent("workitem.branched", profile.org_id, { tool: BRANCH_TARGETS[chosen].vendor, handoff: "download" });
  }

  const label = BRANCH_TARGETS[tool].label;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{BRANCH_COPY.title}</DialogTitle>
          <DialogDescription>{BRANCH_COPY.helper}</DialogDescription>
        </DialogHeader>
        <p className="truncate text-[13px] font-medium text-foreground">{displayName(source)}</p>
        <div role="radiogroup" aria-label={BRANCH_COPY.toolLabel} className="flex flex-wrap gap-2">
          {BRANCH_TOOLS.map((id) => (
            <Button key={id} type="button" role="radio" aria-checked={tool === id} variant={tool === id ? "default" : "outline"} size="sm" onClick={() => setTool(id)}>
              {BRANCH_TARGETS[id].label}
            </Button>
          ))}
        </div>
        {primary === "download" ? <p className="text-[13px] text-muted-foreground">{BRANCH_COPY.needsSignin}</p> : null}
        {notice ? <p role="status" className="text-[13px] text-foreground">{notice}</p> : null}
        <DialogFooter className="mt-2 gap-2">
          {primary === "download" ? (
            <>
              <Button type="button" variant="outline" disabled={busy || !profile} onClick={() => void openTool()}>{BRANCH_COPY.open(label)}</Button>
              <Button type="button" disabled={busy} onClick={() => void download()}>{BRANCH_COPY.download}</Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" disabled={busy} onClick={() => void download()}>{BRANCH_COPY.download}</Button>
              <Button type="button" disabled={busy || !profile} onClick={() => void openTool()}>{BRANCH_COPY.open(label)}</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

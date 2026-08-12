import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { useProfile } from "@/hooks/use-profile";
import { draftDecisions } from "@/lib/decisions.functions";

/** Drafting one item's decisions, shared by the peek panel and the row menu. */
export function useDraftDecisions(workItemId: string) {
  const run = useServerFn(draftDecisions);
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function draft() {
    setBusy(true);
    try {
      const result = await run({ data: { work_item_id: workItemId, profile_id: profile?.id } });
      await queryClient.invalidateQueries({ queryKey: ["decisions"] });
      toast(
        result.drafted > 0
          ? `${result.drafted} decision${result.drafted === 1 ? "" : "s"} drafted. Review them in your Decision log.`
          : "No consequential decisions found. You can add one yourself.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't draft decisions");
    } finally {
      setBusy(false);
    }
  }

  return { busy, draft: () => void draft() };
}

export function DraftDecisionsButton({
  workItemId,
  className,
  label = "Find decisions in this conversation",
}: {
  workItemId: string;
  className?: string;
  label?: string;
}) {
  const { busy, draft } = useDraftDecisions(workItemId);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={draft}
      className={
        className ??
        "text-xs font-medium text-accent-deep transition-opacity hover:opacity-70 disabled:opacity-60"
      }
    >
      {busy ? "Reading this conversation…" : label}
    </button>
  );
}

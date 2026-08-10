import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { draftDecisions } from "@/lib/decisions.functions";

export function DraftDecisionsButton({
  workItemId,
  className,
}: {
  workItemId: string;
  className?: string;
}) {
  const run = useServerFn(draftDecisions);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    try {
      const result = await run({ data: { work_item_id: workItemId } });
      await queryClient.invalidateQueries({ queryKey: ["decisions"] });
      toast(
        result.drafted > 0
          ? `${result.drafted} decision${result.drafted === 1 ? "" : "s"} drafted — review them in your Decision log`
          : "No consequential decisions found — you can add one yourself",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't draft decisions");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void onClick()}
      className={
        className ??
        "text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
      }
    >
      {busy ? "Drafting…" : "Draft decisions"}
    </button>
  );
}

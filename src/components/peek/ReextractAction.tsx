import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { reextractItemText } from "@/lib/item-text.functions";

/**
 * Owner-only, and only where the title-only state is already shown: re-runs the
 * one reader on a file whose contents could not be read. It promises nothing
 * except another honest attempt.
 */
export function ReextractAction({ workItemId }: { workItemId: string }) {
  const queryClient = useQueryClient();
  const run = useServerFn(reextractItemText);
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void run({ data: { work_item_id: workItemId } })
          .then(async (result) => {
            if (result.status === "ok") toast.success("Lasso read this file.");
            else toast.message(`Still not readable${result.note ? `: ${result.note}` : "."}`);
            await queryClient.invalidateQueries({ queryKey: ["work-items"] });
            await queryClient.invalidateQueries({ queryKey: ["item-text-pane", workItemId] });
          })
          .catch((error: unknown) => toast.error((error as Error).message))
          .finally(() => setBusy(false));
      }}
      className="text-xs font-medium text-accent-deep transition-opacity hover:opacity-70 disabled:opacity-50"
    >
      {busy ? "Trying again…" : "Try reading it again"}
    </button>
  );
}

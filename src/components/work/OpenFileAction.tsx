import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { getWorkFileUrl } from "@/lib/work-files.functions";
import { resolveWorkOpen } from "@/lib/work-open";
import type { WorkItemRow } from "@/lib/work-types";

/**
 * W1 — Open means "take me to it". Where the work happened, if we can get back
 * there. Otherwise the stored file, shown in the browser. Otherwise the reader
 * in Lasso. It never saves a file down.
 */
export function OpenFileAction({
  item,
  onOpenInApp,
}: {
  item: WorkItemRow;
  onOpenInApp?: (() => void) | undefined;
}) {
  const fetchUrl = useServerFn(getWorkFileUrl);
  const [pending, setPending] = useState(false);
  const plan = resolveWorkOpen(item);

  function noteSourceOpened() {
    void (async () => {
      try {
        const { noteSourceOpenedFn } = await import("@/lib/chat-library.functions");
        await noteSourceOpenedFn({ data: { work_item_id: item.id } });
      } catch {
        /* a link is a link */
      }
    })();
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={(event) => {
        event.stopPropagation();
        if (plan.kind === "source") {
          noteSourceOpened();
          window.open(plan.url, "_blank", "noopener,noreferrer");
          return;
        }
        if (plan.kind === "reader") {
          onOpenInApp?.();
          return;
        }
        void (async () => {
          setPending(true);
          try {
            const { url } = await fetchUrl({ data: { work_item_id: item.id, inline: true } });
            window.open(url, "_blank", "noopener,noreferrer");
          } catch (e) {
            toast.error((e as Error).message);
          } finally {
            setPending(false);
          }
        })();
      }}
      className="text-xs font-medium text-accent-deep transition-opacity hover:opacity-70 disabled:opacity-50"
    >
      {pending ? "Opening…" : "Open"}
    </button>
  );
}

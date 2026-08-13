import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { getWorkFileUrl } from "@/lib/work-files.functions";

/** Opens a stored file (uploaded, imported, or MCP-pushed) via a short-lived signed URL. */
export function OpenFileAction({ workItemId }: { workItemId: string }) {
  const fetchUrl = useServerFn(getWorkFileUrl);
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={(event) => {
        event.stopPropagation();
        void (async () => {
          setPending(true);
          try {
            const { url } = await fetchUrl({ data: { work_item_id: workItemId } });
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

import { toast } from "sonner";

import { useProfile } from "@/hooks/use-profile";
import { logEvent } from "@/lib/telemetry";

export type DownloadSurface = "review" | "focus";

/**
 * One download path for the board reader views. The server signs the URL with
 * a download disposition (no inline flag), and the file is fetched through a
 * hidden anchor click so no new window opens and no popup blocker can eat it.
 * The server function is imported lazily so reader-view tests that mock the
 * server-fn runtime never load the auth middleware chain.
 */
export function useWorkFileDownload(surface: DownloadSurface): (item: { id: string }) => Promise<void> {
  const { data: profile } = useProfile();

  return async (item) => {
    try {
      const { getWorkFileUrl } = await import("@/lib/work-files.functions");
      const { url } = await getWorkFileUrl({ data: { work_item_id: item.id } });
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      if (profile?.org_id) {
        logEvent("work.file_downloaded", profile.org_id, { surface });
      }
    } catch {
      toast.error("That file could not be downloaded. Try again.");
    }
  };
}

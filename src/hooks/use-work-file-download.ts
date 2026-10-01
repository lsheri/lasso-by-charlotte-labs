import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { useProfile } from "@/hooks/use-profile";
import { logEvent } from "@/lib/telemetry";
import { getWorkFileUrl } from "@/lib/work-files.functions";

export type DownloadSurface = "review" | "focus";

/**
 * One download path for the board reader views. The server signs the URL with
 * a download disposition (no inline flag), and the file is fetched through a
 * hidden anchor click so no new window opens and no popup blocker can eat it.
 */
export function useWorkFileDownload(surface: DownloadSurface): (item: { id: string }) => Promise<void> {
  const fetchUrl = useServerFn(getWorkFileUrl);
  const { data: profile } = useProfile();

  return async (item) => {
    try {
      const { url } = await fetchUrl({ data: { work_item_id: item.id } });
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

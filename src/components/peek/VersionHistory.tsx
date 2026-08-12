import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { getVersionFileUrl } from "@/lib/work-files.functions";
import { formatDate } from "@/lib/work-types";

const SOURCE_EVENT_LABEL: Record<string, string> = {
  connector_reimport: "re-imported from the source",
  initial_capture: "first captured",
};

/** "Version 3 of 3, updated Aug 12", with earlier versions openable. */
export function VersionHistory({ workItemId }: { workItemId: string }) {
  const open = useServerFn(getVersionFileUrl);
  const [expanded, setExpanded] = useState(false);

  const { data } = useQuery({
    queryKey: ["document-versions", workItemId],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("document_versions")
        .select("id, version_no, created_at, source_event")
        .eq("work_item_id", workItemId)
        .order("version_no", { ascending: false });
      if (error) throw new Error(error.message);
      return rows ?? [];
    },
  });

  const versions = data ?? [];
  if (versions.length < 2) return null;
  const latest = versions[0];
  if (!latest) return null;

  async function view(id: string) {
    try {
      const { url } = await open({ data: { version_id: id } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't open that version");
    }
  }

  return (
    <section className="mt-8 border-t border-border pt-4">
      <h3 className="micro-label">Versions</h3>
      <p className="mt-2 text-sm text-foreground">
        Version {latest.version_no} of {latest.version_no}, updated{" "}
        {formatDate(latest.created_at)}.
      </p>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="mt-1 text-xs font-medium text-accent-deep transition-opacity hover:opacity-70"
      >
        {expanded ? "Hide earlier versions" : "View earlier versions"}
      </button>
      {expanded ? (
        <ul className="mt-2 space-y-1">
          {versions.slice(1).map((version) => (
            <li key={version.id} className="text-xs text-muted-foreground">
              <button
                type="button"
                onClick={() => void view(version.id)}
                className="hover:text-foreground hover:underline"
              >
                Version {version.version_no}, {formatDate(version.created_at)},{" "}
                {SOURCE_EVENT_LABEL[version.source_event] ?? version.source_event}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
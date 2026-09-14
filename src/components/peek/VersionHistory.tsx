import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";
import { RECHECK_AT_KEY } from "@/lib/document-recheck-shared";
import { TEXT_CONTENT_HASH_KEY } from "@/lib/text-hash-shared";
import { logEvent } from "@/lib/telemetry";
import { getVersionFileUrl } from "@/lib/work-files.functions";
import { formatDate } from "@/lib/work-types";

const SOURCE_EVENT_LABEL: Record<string, string> = {
  connector_reimport: "re-imported from the source",
  initial_capture: "first captured",
  scheduled_recheck: "the source changed",
  baseline: "first recorded state",
};

export function VersionHistory({
  workItemId,
  capturedAt,
  lastCheckedAt,
  hasTextBaseline,
}: {
  workItemId: string;
  capturedAt?: string | null | undefined;
  lastCheckedAt?: string | null | undefined;
  hasTextBaseline?: boolean | undefined;
}) {
  const { data: profile } = useProfile();
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

  if (versions.length === 0 && !lastCheckedAt) {
    return null;
  }

  const latest = versions[0];
  const newestDate = latest?.created_at ?? capturedAt;

  async function view(id: string) {
    try {
      const { url } = await open({ data: { version_id: id } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't open that version");
    }
  }

  function toggleExpanded() {
    setExpanded((prev) => {
      const next = !prev;
      if (next && profile && versions.length >= 2) {
        logEvent("document.versions_expanded", profile.org_id, {
          version_count: versions.length,
        });
      }
      return next;
    });
  }

  let summaryLine: ReactNode = null;
  if (versions.length >= 2 && latest) {
    summaryLine = (
      <p className="mt-2 text-sm text-foreground">
        Version {latest.version_no} of {versions.length}, updated {formatDate(latest.created_at)}.
      </p>
    );
  } else if (versions.length === 1 && latest) {
    summaryLine = (
      <p className="mt-2 text-sm text-foreground">
        Version {latest.version_no}, recorded {formatDate(latest.created_at)}.
      </p>
    );
  } else if (versions.length === 0 && lastCheckedAt && capturedAt) {
    summaryLine = (
      <p className="mt-2 text-sm text-foreground">
        One recorded state, captured {formatDate(capturedAt)}.
      </p>
    );
  }

  return (
    <section className="mt-8 border-t border-border pt-4">
      <h3 className="micro-label micro-label-section">Versions</h3>
      {summaryLine}
      {lastCheckedAt ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {hasTextBaseline && newestDate
            ? `No change seen since ${formatDate(newestDate)}. Last checked ${formatDate(lastCheckedAt)}.`
            : `Last checked ${formatDate(lastCheckedAt)}.`}
        </p>
      ) : null}
      {versions.length >= 2 ? (
        <>
          <button
            type="button"
            onClick={toggleExpanded}
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
        </>
      ) : null}
    </section>
  );
}

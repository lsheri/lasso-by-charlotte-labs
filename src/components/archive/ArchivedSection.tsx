import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useClients, useInvalidateClients } from "@/hooks/use-clients";
import { useArchivedEngagements } from "@/hooks/use-engagements";
import { useProfile } from "@/hooks/use-profile";
import { CONTAINER_ACTIONS_COPY } from "@/lib/container-actions";
import { vocabFor } from "@/lib/edu-vocab";
import { usesGuestNav } from "@/lib/role-access";
import { rpcOutcome } from "@/lib/save-guard";
import { bucket } from "@/lib/telemetry-shared";
import { logEvent } from "@/lib/telemetry";

export const ARCHIVED_SECTION_COPY = {
  heading: "Archived",
  empty: "Nothing archived.",
  loading: "Reading archived work.",
  client: "Client",
  folder: "Folder",
  fallback: "That could not be brought back.",
  archivedAgo: (days: number) =>
    days <= 0 ? "Archived today" : days === 1 ? "Archived yesterday" : `Archived ${days} days ago`,
};

type ArchivedKind = "client" | "folder" | "workboard";
type ArchivedRow = { id: string; name: string; kind: ArchivedKind; archivedAt: string };

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

/** The way back for archived containers and workboards once Undo has gone. */
export function ArchivedSection() {
  const { data: profile } = useProfile();
  const orgId = profile?.org_id;
  const clients = useClients(orgId);
  const boards = useArchivedEngagements(profile?.id);
  const invalidate = useInvalidateClients();
  const vocab = vocabFor(profile);
  const opened = useRef(false);
  const guest = usesGuestNav(profile);

  const rows: ArchivedRow[] = [
    ...(clients.data ?? [])
      .filter((c) => Boolean(c.archived_at))
      .map((c) => ({ id: c.id, name: c.name, kind: c.kind, archivedAt: c.archived_at as string })),
    ...(boards.data ?? [])
      .filter((e) => Boolean(e.archived_at))
      .map((e) => ({ id: e.id, name: e.title, kind: "workboard" as const, archivedAt: e.archived_at as string })),
  ].sort((a, b) => b.archivedAt.localeCompare(a.archivedAt));

  async function bringBack(row: ArchivedRow) {
    const outcome = rpcOutcome(
      await supabase.rpc("unarchive_container", { p_id: row.id }),
      "unarchived",
      ARCHIVED_SECTION_COPY.fallback,
    );
    if (!outcome.ok) {
      toast.error(outcome.message);
      return;
    }
    invalidate();
    if (orgId) {
      logEvent("container.unarchived", orgId, {
        kind: row.kind,
        days_archived: bucket(daysSince(row.archivedAt)),
      });
    }
    toast.success(CONTAINER_ACTIONS_COPY.broughtBack(row.name));
  }

  const kindLabel = (kind: ArchivedKind) =>
    kind === "workboard" ? vocab.engagement : ARCHIVED_SECTION_COPY[kind];
  const loading = clients.isLoading || boards.isLoading;

  useEffect(() => {
    if (opened.current || loading || rows.length === 0 || !orgId || guest) return;
    opened.current = true;
    logEvent("container.archive_opened", orgId, { from: "past_work" });
  }, [loading, rows.length, orgId, guest]);

  return (
    <section id="archived" data-testid="archived-section" className="mt-6">
      <h2 className="font-mono text-[0.894rem] font-medium uppercase tracking-[0.12em] text-[var(--nb-mid)]">
        {ARCHIVED_SECTION_COPY.heading}
      </h2>
      {loading ? (
        <p className="mt-2 text-[13px] text-muted-foreground">{ARCHIVED_SECTION_COPY.loading}</p>
      ) : rows.length === 0 ? (
        <p className="mt-2 text-[13px] text-muted-foreground">{ARCHIVED_SECTION_COPY.empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-rule rounded-lg border border-graphite bg-card">
          {rows.map((row) => (
            <li key={`${row.kind}-${row.id}`} data-testid="archived-row" className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-foreground">{row.name}</p>
                <p className="nb-type-small text-muted-foreground">
                  {kindLabel(row.kind)} · {ARCHIVED_SECTION_COPY.archivedAgo(daysSince(row.archivedAt))}
                </p>
              </div>
              <button
                type="button"
                className="nb-pencil-cta shrink-0 rounded-md px-3 py-1 text-[13px]"
                onClick={() => void bringBack(row)}
              >
                {CONTAINER_ACTIONS_COPY.bringBack}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

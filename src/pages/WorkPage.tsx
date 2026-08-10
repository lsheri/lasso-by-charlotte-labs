import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { MapDialog } from "@/components/work/MapDialog";
import { PasteThreadDialog } from "@/components/work/PasteThreadDialog";
import { ThreadViewer } from "@/components/work/ThreadViewer";
import { UploadFilesButton } from "@/components/work/UploadFilesButton";
import { RowAction, WorkRow } from "@/components/work/WorkRow";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/use-profile";
import { useWorkItems } from "@/hooks/use-work-items";
import { supabase } from "@/integrations/supabase/client";
import { logEvent } from "@/lib/telemetry";
import type { WorkItemRow } from "@/lib/work-types";

export function WorkPage() {
  const { data: profile } = useProfile();
  const { data, isLoading, error } = useWorkItems();
  const queryClient = useQueryClient();
  const [mapItem, setMapItem] = useState<WorkItemRow | null>(null);
  const [threadItem, setThreadItem] = useState<WorkItemRow | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const all = data?.items ?? [];
  const mappingError = data?.mappingError ?? null;
  const mapped = all.filter((i) => i.visibility === "mapped");
  const unmapped = all.filter((i) => i.visibility === "unmapped");
  const priv = all.filter((i) => i.visibility === "private");

  async function makePrivate(item: WorkItemRow) {
    setActionError(null);
    const del = await supabase.from("work_item_tasks").delete().eq("work_item_id", item.id);
    if (del.error) return setActionError(del.error.message);
    const upd = await supabase
      .from("work_items")
      .update({ visibility: "private" })
      .eq("id", item.id);
    if (upd.error) return setActionError(upd.error.message);
    if (profile) {
      logEvent("workitem.marked_private", profile.org_id, { type: item.type, source: item.source });
    }
    await queryClient.invalidateQueries({ queryKey: ["work-items"] });
  }

  async function unmark(item: WorkItemRow) {
    setActionError(null);
    const upd = await supabase
      .from("work_items")
      .update({ visibility: "unmapped" })
      .eq("id", item.id);
    if (upd.error) return setActionError(upd.error.message);
    await queryClient.invalidateQueries({ queryKey: ["work-items"] });
  }

  function openItem(item: WorkItemRow): (() => void) | undefined {
    return item.type === "ai_thread" ? () => setThreadItem(item) : undefined;
  }

  return (
    <div>
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Work</h1>
          <p className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            {all.length} items · {mapped.length} mapped · {unmapped.length} unmapped ·{" "}
            {priv.length} private
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PasteThreadDialog trigger={<Button type="button">Paste a thread</Button>} />
          <UploadFilesButton />
        </div>
      </header>

      {error ? (
        <p className="mb-6 text-sm text-destructive">{(error as Error).message}</p>
      ) : null}
      {actionError ? <p className="mb-6 text-sm text-destructive">{actionError}</p> : null}
      {mappingError ? (
        <p className="mb-6 text-sm text-destructive">
          Mapping details couldn't load: {mappingError}
        </p>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading your work…</p>
      ) : all.length === 0 ? (
        <div className="mx-auto max-w-lg rounded-[var(--radius)] border border-border bg-card px-8 py-12 text-center shadow-card">
          <p className="text-sm text-foreground">
            Your work lands here. Paste an AI thread or drop a file — organize it whenever you're
            ready.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <PasteThreadDialog trigger={<Button type="button">Paste a thread</Button>} />
            <UploadFilesButton />
          </div>
        </div>
      ) : (
        <div className="space-y-10">
          <Section label="Mapped · Visible to your coach through tasks" items={mapped}>
            {(item) => (
              <WorkRow
                key={item.id}
                item={item}
                onOpen={openItem(item)}
                actions={
                  <>
                    <RowAction onClick={() => setMapItem(item)}>Remap</RowAction>
                    <RowAction onClick={() => void makePrivate(item)}>Make private</RowAction>
                  </>
                }
              />
            )}
          </Section>

          <Section label="Unmapped · Private by default until you map it" items={unmapped}>
            {(item) => (
              <WorkRow
                key={item.id}
                item={item}
                onOpen={openItem(item)}
                actions={
                  <>
                    <RowAction primary onClick={() => setMapItem(item)}>
                      Map to a task
                    </RowAction>
                    <RowAction onClick={() => void makePrivate(item)}>Make private</RowAction>
                  </>
                }
              />
            )}
          </Section>

          <Section label="Marked private · Never visible to anyone" items={priv}>
            {(item) => (
              <WorkRow
                key={item.id}
                item={item}
                onOpen={openItem(item)}
                actions={<RowAction onClick={() => void unmark(item)}>Unmark</RowAction>}
              />
            )}
          </Section>
        </div>
      )}

      <MapDialog
        item={mapItem}
        open={mapItem !== null}
        onOpenChange={(next) => {
          if (!next) setMapItem(null);
        }}
      />
      <ThreadViewer
        item={threadItem}
        open={threadItem !== null}
        onOpenChange={(next) => {
          if (!next) setThreadItem(null);
        }}
      />
    </div>
  );
}

function Section({
  label,
  items,
  children,
}: {
  label: string;
  items: WorkItemRow[];
  children: (item: WorkItemRow) => React.ReactNode;
}) {
  return (
    <section>
      <h2 className="micro-label">{label}</h2>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing here yet.</p>
        ) : (
          items.map((item) => children(item))
        )}
      </div>
    </section>
  );
}

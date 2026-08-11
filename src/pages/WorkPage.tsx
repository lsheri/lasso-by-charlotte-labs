import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { MapDialog } from "@/components/work/MapDialog";
import { DraftDecisionsButton } from "@/components/decisions/DraftDecisionsButton";
import { ImportFlowDialog } from "@/components/work/import/ImportFlowDialog";
import { PasteThreadDialog } from "@/components/work/PasteThreadDialog";
import { OpenFileAction } from "@/components/work/OpenFileAction";
import { SuggestionChip } from "@/components/work/SuggestionChip";
import { ThreadViewer } from "@/components/work/ThreadViewer";
import { UploadFilesButton } from "@/components/work/UploadFilesButton";
import { WorkDateDialog } from "@/components/work/WorkDateDialog";
import { RowAction, WorkRow } from "@/components/work/WorkRow";
import { ConversationChips } from "@/components/work/ConversationChips";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/use-profile";
import { useWorkItems } from "@/hooks/use-work-items";
import { supabase } from "@/integrations/supabase/client";
import type { MappingSuggestion } from "@/lib/mapping-shared";
import { suggestMappings } from "@/lib/mapping.functions";
import { logEvent } from "@/lib/telemetry";
import {
  groupConversations,
  isConversationGroup,
  type ConversationGroup,
  type WorkItemRow,
} from "@/lib/work-types";

export function WorkPage() {
  const { data: profile } = useProfile();
  const { data, isLoading, error } = useWorkItems();
  const queryClient = useQueryClient();
  const runSuggest = useServerFn(suggestMappings);
  const [mapItem, setMapItem] = useState<WorkItemRow | null>(null);
  const [mapGroup, setMapGroup] = useState<WorkItemRow[] | null>(null);
  const [threadItem, setThreadItem] = useState<WorkItemRow | null>(null);
  const [dateItem, setDateItem] = useState<WorkItemRow | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<MappingSuggestion[] | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [acceptPending, setAcceptPending] = useState(false);

  const all = data?.items ?? [];
  const mappingError = data?.mappingError ?? null;
  const mapped = all.filter((i) => i.visibility === "mapped");
  const unmapped = all.filter((i) => i.visibility === "unmapped");
  const priv = all.filter((i) => i.visibility === "private");

  const active = (suggestions ?? []).filter(
    (s) => !dismissed.includes(s.work_item_id) && unmapped.some((i) => i.id === s.work_item_id),
  );

  const { data: taskLabels } = useQuery({
    queryKey: ["suggestion-task-labels", active.map((s) => s.task_id).sort().join(",")],
    enabled: active.length > 0,
    queryFn: async (): Promise<Record<string, string>> => {
      const ids = Array.from(new Set(active.map((s) => s.task_id)));
      const { data: rows, error: taskError } = await supabase
        .from("tasks")
        .select("id, name, engagements(code)")
        .in("id", ids);
      if (taskError) throw taskError;
      const out: Record<string, string> = {};
      for (const row of (rows ?? []) as unknown as {
        id: string;
        name: string;
        engagements: { code: string } | null;
      }[]) {
        out[row.id] = `${row.engagements?.code ?? "—"} · ${row.name}`;
      }
      return out;
    },
  });

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

  function openMap(item: WorkItemRow, group?: WorkItemRow[]) {
    setMapGroup(group ?? null);
    setMapItem(item);
  }

  /** One conversation: transcript on top, its artifacts nested underneath. */
  function renderGroup(group: ConversationGroup, variant: "mapped" | "unmapped" | "private") {
    const head = group.transcript ?? group.items[0]!;
    const rest = group.transcript ? group.attachments : group.items.slice(1);
    return (
      <div
        key={group.key}
        className="rounded-[var(--radius)] border border-border bg-secondary/40 p-2"
      >
        <WorkRow
          item={head}
          onOpen={openItem(head)}
          chips={<ConversationChips item={head} />}
          actions={rowActions(head, variant, group.items)}
        />
        {rest.length > 0 ? (
          <div className="mt-2 space-y-2 border-l border-border pl-3">
            {rest.map((child) => (
              <WorkRow
                key={child.id}
                nested
                item={child}
                onOpen={openItem(child)}
                chips={<ConversationChips item={child} />}
                actions={rowActions(child, variant)}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  function rowActions(
    item: WorkItemRow,
    variant: "mapped" | "unmapped" | "private",
    group?: WorkItemRow[],
  ) {
    if (variant === "private") {
      return (
        <>
          {item.content_ref ? <OpenFileAction workItemId={item.id} /> : null}
          <RowAction onClick={() => setDateItem(item)}>Work date</RowAction>
          <RowAction onClick={() => void unmark(item)}>Unmark</RowAction>
        </>
      );
    }
    const groupLabel = group && group.length > 1;
    return (
      <>
        {item.type === "ai_thread" ? <DraftDecisionsButton workItemId={item.id} /> : null}
        {item.content_ref ? <OpenFileAction workItemId={item.id} /> : null}
        <RowAction primary={variant === "unmapped"} onClick={() => openMap(item, group)}>
          {variant === "mapped"
            ? groupLabel
              ? "Remap conversation"
              : "Remap"
            : groupLabel
              ? "Map conversation"
              : "Map to a task"}
        </RowAction>
        {group && group.length > 1 ? (
          <RowAction onClick={() => openMap(item)}>Map just this</RowAction>
        ) : null}
        <RowAction onClick={() => setDateItem(item)}>Work date</RowAction>
        <RowAction onClick={() => void makePrivate(item)}>Make private</RowAction>
      </>
    );
  }

  async function handleSuggest() {
    setSuggesting(true);
    setActionError(null);
    try {
      const result = await runSuggest({ data: { profile_id: profile?.id } });
      setSuggestions(result.suggestions);
      setDismissed([]);
      toast.success(
        result.suggestions.length > 0
          ? `${result.suggestions.length} suggestion${result.suggestions.length === 1 ? "" : "s"}`
          : "No confident matches yet",
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSuggesting(false);
    }
  }

  async function acceptSuggestion(suggestion: MappingSuggestion) {
    const item = unmapped.find((i) => i.id === suggestion.work_item_id);
    if (!item || !profile) return;
    setAcceptPending(true);
    setActionError(null);
    try {
      const cleanup = await supabase
        .from("work_item_tasks")
        .delete()
        .eq("work_item_id", item.id);
      if (cleanup.error) throw new Error(cleanup.error.message);
      const link = await supabase
        .from("work_item_tasks")
        .insert({ work_item_id: item.id, task_id: suggestion.task_id });
      if (link.error) throw new Error(link.error.message);
      const upd = await supabase
        .from("work_items")
        .update({ visibility: "mapped" })
        .eq("id", item.id);
      if (upd.error) throw new Error(upd.error.message);

      logEvent("workitem.mapped", profile.org_id, {
        type: item.type,
        source: item.source,
        suggested: true,
      });
      setDismissed((prev) => [...prev, item.id]);
      await queryClient.invalidateQueries({ queryKey: ["work-items"] });
      await queryClient.invalidateQueries({ queryKey: ["engagement"] });
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setAcceptPending(false);
    }
  }

  const highConfidence = active.filter((s) => s.confidence === "high");

  function suggestionFor(item: WorkItemRow) {
    const suggestion = active.find((s) => s.work_item_id === item.id);
    if (!suggestion) return null;
    return (
      <SuggestionChip
        label={taskLabels?.[suggestion.task_id] ?? "task"}
        reason={suggestion.reason}
        pending={acceptPending}
        onAccept={() => void acceptSuggestion(suggestion)}
        onDismiss={() => setDismissed((prev) => [...prev, suggestion.work_item_id])}
      />
    );
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
        <div className="flex flex-wrap items-center gap-2">
          {unmapped.length > 0 ? (
            <button
              type="button"
              disabled={suggesting}
              onClick={() => void handleSuggest()}
              className="text-xs font-medium text-accent-deep transition-opacity hover:opacity-70 disabled:opacity-50"
            >
              {suggesting ? "Thinking…" : "✨ Suggest mapping"}
            </button>
          ) : null}
          <PasteThreadDialog trigger={<Button type="button">Paste a thread</Button>} />
          <UploadFilesButton />
          <ImportFlowDialog
            trigger={
              <Button type="button" variant="outline">
                Import AI history
              </Button>
            }
          />
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
            <ImportFlowDialog
              trigger={
                <Button type="button" variant="outline">
                  Import AI history
                </Button>
              }
            />
          </div>
        </div>
      ) : (
        <div className="space-y-10">
          <Section
            label="Mapped · Visible to your coach through tasks"
            entries={groupConversations(mapped)}
          >
            {(entry) =>
              isConversationGroup(entry) ? (
                renderGroup(entry, "mapped")
              ) : (
                <WorkRow
                  key={entry.id}
                  item={entry}
                  onOpen={openItem(entry)}
                  chips={<ConversationChips item={entry} />}
                  actions={rowActions(entry, "mapped")}
                />
              )
            }
          </Section>

          <section className={suggesting ? "animate-pulse" : undefined}>
            <h2 className="micro-label">Unmapped · Private by default until you map it</h2>
            {unmapped.length > 0 && active.length === 0 ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-dashed border-border bg-accent-soft/50 px-4 py-3">
                <p className="text-sm text-accent-deep">✨ Let Lasso suggest where these go</p>
                <button
                  type="button"
                  disabled={suggesting}
                  onClick={() => void handleSuggest()}
                  className="text-xs font-medium text-accent-deep transition-opacity hover:opacity-70 disabled:opacity-50"
                >
                  {suggesting ? "Thinking…" : "Suggest mapping"}
                </button>
              </div>
            ) : null}
            {active.length > 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Suggestions are drafts — nothing is shared until you accept.
              </p>
            ) : null}
            {highConfidence.length >= 3 ? (
              <button
                type="button"
                disabled={acceptPending}
                onClick={() => {
                  void (async () => {
                    for (const suggestion of highConfidence) {
                      await acceptSuggestion(suggestion);
                    }
                  })();
                }}
                className="mt-2 text-xs font-medium text-accent-deep transition-opacity hover:opacity-70 disabled:opacity-50"
              >
                Accept all high-confidence ({highConfidence.length})
              </button>
            ) : null}
            <div className="mt-3 space-y-2">
              {unmapped.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing here yet.</p>
              ) : (
                groupConversations(unmapped).map((entry) =>
                  isConversationGroup(entry) ? (
                    renderGroup(entry, "unmapped")
                  ) : (
                    <div key={entry.id}>
                      <WorkRow
                        item={entry}
                        onOpen={openItem(entry)}
                        chips={<ConversationChips item={entry} />}
                        actions={rowActions(entry, "unmapped")}
                      />
                      {suggestionFor(entry)}
                    </div>
                  ),
                )
              )}
            </div>
          </section>

          <Section
            label="Marked private · Never visible to anyone"
            entries={groupConversations(priv)}
          >
            {(entry) =>
              isConversationGroup(entry) ? (
                renderGroup(entry, "private")
              ) : (
                <WorkRow
                  key={entry.id}
                  item={entry}
                  onOpen={openItem(entry)}
                  chips={<ConversationChips item={entry} />}
                  actions={rowActions(entry, "private")}
                />
              )
            }
          </Section>
        </div>
      )}

      <MapDialog
        item={mapItem}
        groupItems={mapGroup ?? undefined}
        open={mapItem !== null}
        onOpenChange={(next) => {
          if (!next) {
            setMapItem(null);
            setMapGroup(null);
          }
        }}
      />
      <ThreadViewer
        item={threadItem}
        open={threadItem !== null}
        onOpenChange={(next) => {
          if (!next) setThreadItem(null);
        }}
      />
      <WorkDateDialog
        item={dateItem}
        open={dateItem !== null}
        onOpenChange={(next) => {
          if (!next) setDateItem(null);
        }}
      />
    </div>
  );
}

function Section({
  label,
  entries,
  children,
}: {
  label: string;
  entries: (WorkItemRow | ConversationGroup)[];
  children: (entry: WorkItemRow | ConversationGroup) => React.ReactNode;
}) {
  return (
    <section>
      <h2 className="micro-label">{label}</h2>
      <div className="mt-3 space-y-2">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing here yet.</p>
        ) : (
          entries.map((entry) => (
            <div key={isConversationGroup(entry) ? entry.key : entry.id}>{children(entry)}</div>
          ))
        )}
      </div>
    </section>
  );
}

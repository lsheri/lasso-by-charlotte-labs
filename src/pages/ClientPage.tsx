import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { BrandLogo } from "@/components/connectors/BrandLogo";
import { NewEngagementDialog } from "@/components/engagements/NewEngagementDialog";
import { PageHeader } from "@/components/layout/PageHeader";
import { GraphiteIcon } from "@/components/notebook/icons";
import { SectionHeader } from "@/components/notebook/SectionHeader";
import { PeekPanel } from "@/components/peek/PeekPanel";
import { Button } from "@/components/ui/button";
import { sourceBrandKey } from "@/components/work/SourceMark";
import { useProfile } from "@/hooks/use-profile";
import { useWorkItems } from "@/hooks/use-work-items";
import { supabase } from "@/integrations/supabase/client";
import { boardHueIndex } from "@/lib/board-hue";
import { vocabFor } from "@/lib/edu-vocab";
import { isCoach } from "@/lib/role-access";
import { logEvent } from "@/lib/telemetry";
import { bucket } from "@/lib/telemetry-shared";
import { displayName } from "@/lib/work-item-name";
import { orderByWorkDate, resolveWorkDate } from "@/lib/work-order";
import { formatDate, type WorkItemRow } from "@/lib/work-types";

type ClientRecord = {
  id: string;
  name: string;
  code: string | null;
  quick_folder: boolean;
  kind: "client" | "folder" | null;
  parent_id: string | null;
};
type FolderBoard = { id: string; title: string | null; created_at: string | null };
type ChildFolder = { id: string; name: string };

/** What the context list can narrow to. "docs" covers documents, decks and sheets. */
export type ContextFilter = "all" | "docs" | "chats";
const CONTEXT_FILTERS: { value: ContextFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "docs", label: "Docs" },
  { value: "chats", label: "Chats" },
];

export function matchesContextFilter(item: Pick<WorkItemRow, "type">, filter: ContextFilter): boolean {
  if (filter === "chats") return item.type === "ai_thread";
  if (filter === "docs") return item.type === "document" || item.type === "deck" || item.type === "sheet";
  return true;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function boardOf(item: WorkItemRow): string | null {
  return item.work_item_tasks[0]?.tasks?.engagement_id ?? null;
}

/**
 * A folder is a table of contents, not a wall of cards (Liam, 15 Nov): the folders inside it, its boards, and the
 * docs and chats those boards hold, as a list that opens each one in the quick view. Every read is the ordinary
 * browser client, so row level policies decide what comes back. Moving the folder lives in the sidebar menu.
 */
export function ClientPage({ clientId }: { clientId: string }) {
  const { data: profile } = useProfile();
  const { data: workData } = useWorkItems();
  const vocab = vocabFor(profile);
  const [filter, setFilter] = useState<ContextFilter>("all");
  const [peek, setPeek] = useState<WorkItemRow | null>(null);

  const clientQuery = useQuery({
    queryKey: ["client", clientId],
    queryFn: async (): Promise<ClientRecord | null> => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, code, quick_folder, kind, parent_id")
        .eq("id", clientId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as ClientRecord | null;
    },
  });

  const boardsQuery = useQuery({
    queryKey: ["client-engagements", clientId],
    queryFn: async (): Promise<FolderBoard[]> => {
      const { data, error } = await supabase
        .from("engagements")
        .select("id, title, created_at")
        .eq("client_id", clientId)
        .is("archived_at", null)
        .order("title");
      if (error) throw error;
      return (data ?? []) as FolderBoard[];
    },
  });

  const childrenQuery = useQuery({
    queryKey: ["client-children", clientId],
    queryFn: async (): Promise<ChildFolder[]> => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .eq("parent_id", clientId)
        .is("archived_at", null)
        .order("name");
      if (error) throw error;
      return (data ?? []) as ChildFolder[];
    },
  });

  const client = clientQuery.data ?? null;
  const boards = useMemo(() => boardsQuery.data ?? [], [boardsQuery.data]);
  const children = useMemo(() => childrenQuery.data ?? [], [childrenQuery.data]);
  const boardIds = useMemo(() => new Set(boards.map((board) => board.id)), [boards]);
  const boardTitles = useMemo(() => new Map(boards.map((board) => [board.id, board.title ?? ""])), [boards]);

  // No new work_items query: the page filters the list the app already holds. Context is what sits on this
  // folder's boards, plus anything claimed to the folder that has no board yet.
  const context = useMemo(
    () =>
      orderByWorkDate(
        (workData?.items ?? []).filter((item) => {
          const board = boardOf(item);
          return board ? boardIds.has(board) : item.client_id === clientId;
        }),
      ),
    [workData, boardIds, clientId],
  );
  const shown = context.filter((item) => matchesContextFilter(item, filter));

  const perBoard = useMemo(() => {
    const map = new Map<string, { count: number; latest: string | null }>();
    for (const item of context) {
      const board = boardOf(item);
      if (!board) continue;
      const entry = map.get(board) ?? { count: 0, latest: null };
      const when = resolveWorkDate(item).iso;
      const newer = !entry.latest || new Date(when).getTime() > new Date(entry.latest).getTime();
      map.set(board, { count: entry.count + 1, latest: newer ? when : entry.latest });
    }
    return map;
  }, [context]);

  const unplacedCount = context.filter((item) => !boardOf(item)).length;
  const countsReady =
    clientQuery.isSuccess && Boolean(clientQuery.data) && boardsQuery.isSuccess && Boolean(workData);

  // Once per folder, and only once the numbers it reports are real.
  const seen = useRef<string | null>(null);
  useEffect(() => {
    if (!profile?.org_id) return;
    if (!countsReady) return;
    if (seen.current === clientId) return;
    seen.current = clientId;
    logEvent("client.page_viewed", profile.org_id, {
      engagements: bucket(boards.length),
      items: bucket(context.length),
      unplaced: bucket(unplacedCount),
    });
  }, [profile?.org_id, clientId, countsReady, boards.length, context.length, unplacedCount]);

  if (clientQuery.isLoading) {
    return (
      <div>
        <p className="text-sm text-muted-foreground">Loading.</p>
      </div>
    );
  }

  if (!client) {
    return (
      <div>
        <PageHeader title="Folder" subtitle="That folder is not in your workspace." />
      </div>
    );
  }

  const subtitle = [
    children.length > 0 ? plural(children.length, "folder", "folders") : null,
    plural(boards.length, vocab.engagement.toLowerCase(), vocab.engagements.toLowerCase()),
    plural(context.length, "piece of context", "pieces of context"),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="folder-page">
      <PageHeader
        title={client.name}
        subtitle={subtitle}
        action={
          <NewEngagementDialog
            initialClientId={clientId}
            from="client_page"
            trigger={
              <Button type="button" variant="outline" size="sm">
                {vocab.newEngagement}
              </Button>
            }
          />
        }
      />

      {children.length > 0 ? (
        <section className="mb-10" aria-label="Folders">
          <SectionHeader title="Folders" />
          <ul className="folder-page-rows">
            {children.map((child) => (
              <li key={child.id}>
                <Link to="/clients/$id" params={{ id: child.id }} className="folder-page-row">
                  <GraphiteIcon name="folder" size={18} />
                  <span className="truncate">{child.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mb-10" aria-label={vocab.engagements}>
        <SectionHeader title={vocab.engagements} />
        {boards.length === 0 ? (
          <p className="text-sm text-muted-foreground">{vocab.noEngagements}</p>
        ) : (
          <ul className="folder-page-boards">
            {boards.map((board) => {
              const stats = perBoard.get(board.id);
              const latest = stats?.latest ?? board.created_at;
              return (
                <li key={board.id}>
                  <Link
                    to="/engagements/$id"
                    params={{ id: board.id }}
                    search={{ work: undefined }}
                    className="folder-page-board"
                    data-board-hue={boardHueIndex(board.id)}
                  >
                    <span className="folder-page-board-tab" aria-hidden="true" />
                    <span className="folder-page-board-title">{board.title}</span>
                    <span className="folder-page-board-meta">
                      {plural(stats?.count ?? 0, "piece", "pieces")}
                      {latest ? ` · updated ${formatDate(latest)}` : ""}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-label="Context">
        <div className="folder-page-context-head">
          <SectionHeader title="Context" />
          <div role="group" aria-label="Show" className="folder-page-filters">
            {CONTEXT_FILTERS.map((choice) => (
              <button
                key={choice.value}
                type="button"
                aria-pressed={filter === choice.value}
                onClick={() => setFilter(choice.value)}
                className="folder-page-filter"
              >
                {choice.label}
              </button>
            ))}
          </div>
        </div>
        {shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {context.length === 0 ? "Nothing here yet." : "Nothing of that kind here."}
          </p>
        ) : (
          <ul className="folder-page-rows">
            {shown.map((item) => {
              const board = boardOf(item);
              return (
                <li key={item.id}>
                  <button type="button" className="folder-page-row" onClick={() => setPeek(item)}>
                    <BrandLogo brand={sourceBrandKey(item)} size={18} />
                    <span className="min-w-0 flex-1 truncate">{displayName(item)}</span>
                    <span className="folder-page-row-where">
                      {board ? boardTitles.get(board) : "No board yet"}
                    </span>
                    <span className="folder-page-row-when">{formatDate(resolveWorkDate(item).iso)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <PeekPanel
        entry={peek}
        open={peek !== null}
        onOpenChange={(open) => {
          if (!open) setPeek(null);
        }}
        canEdit={Boolean(profile) && !isCoach(profile!)}
        viewerProfileId={profile?.id ?? null}
      />
    </div>
  );
}

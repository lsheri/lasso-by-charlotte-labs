// Deliberate exception to _authenticated: this page grants nothing itself; RLS (active grant for the signed-in user) decides every row, and it has no write path.
import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import {
  SUPPORT_VIEW_COPY as C,
  supportDate,
  supportShortDay,
} from "@/lib/support-view";

export const Route = createFileRoute("/support/$grantId")({
  ssr: false,
  beforeLoad: async ({ params }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      throw redirect({ to: "/auth", search: { next: `/support/${params.grantId}` } as never });
    }
  },
  head: () => ({
    meta: [
      { title: "Support view | Lasso" },
      { name: "description", content: "A read-only support view of a Lasso workspace." },
      { property: "og:title", content: "Support view | Lasso" },
      { property: "og:description", content: "A read-only support view of a Lasso workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SupportRoute,
});

function SupportRoute() {
  const { grantId } = Route.useParams();
  return <SupportView grantId={grantId} />;
}

type Grant = {
  id: string;
  org_id: string;
  reason: string;
  include_conversations: boolean;
  status: string;
  ends_at: string | null;
};

type Tab = "home" | "boards" | "work";

/** One write per surface+id, so strict-mode double mounts never log twice. */
function useLogView(orgId: string) {
  const seen = useRef(new Set<string>());
  return (surface: string, id = "") => {
    const key = `${surface}:${id}`;
    if (seen.current.has(key)) return;
    seen.current.add(key);
    void supabase
      .rpc("log_support_view", { p_org: orgId, p_surface: surface })
      .then(() => undefined, () => undefined);
  };
}

export function SupportView({ grantId }: { grantId: string }) {
  const grant = useQuery({
    queryKey: ["support-view-grant", grantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("support_grants")
        .select("id, org_id, reason, include_conversations, status, ends_at")
        .eq("id", grantId)
        .maybeSingle();
      return (data as Grant | null) ?? null;
    },
  });
  if (grant.isLoading) {
    return <p className="p-6 text-sm text-muted-foreground">{C.loading}</p>;
  }
  const g = grant.data;
  const live =
    g && g.status === "active" && g.ends_at && new Date(g.ends_at).getTime() > Date.now();
  if (!g || !live) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center">
          <p className="text-sm text-foreground">{C.inactive}</p>
          <Link to="/" className="mt-3 inline-block text-sm text-muted-foreground underline">
            {C.back}
          </Link>
        </div>
      </main>
    );
  }
  return <ActiveView grant={g} />;
}

function ActiveView({ grant }: { grant: Grant }) {
  const [tab, setTab] = useState<Tab>("home");
  const [openItem, setOpenItem] = useState<string | null>(null);
  const logView = useLogView(grant.org_id);
  const org = useQuery({
    queryKey: ["support-view-org", grant.org_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("orgs")
        .select("name, org_mode")
        .eq("id", grant.org_id)
        .maybeSingle();
      return data as { name: string; org_mode: string | null } | null;
    },
  });

  useEffect(() => {
    logView(tab);
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const name = org.data?.name ?? "";
  return (
    <div className="min-h-screen bg-background">
      <div
        data-testid="support-banner"
        className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 bg-foreground px-4 py-2.5 text-sm text-background"
      >
        <span>{C.banner(name, grant.ends_at ? supportShortDay(grant.ends_at) : "")}</span>
        <span>{grant.include_conversations ? C.convIncluded : C.convHidden}</span>
      </div>
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-border px-4">
        {(["home", "boards", "work"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={
              tab === t
                ? "shrink-0 whitespace-nowrap border-b-2 border-foreground px-3 py-2.5 text-sm text-foreground"
                : "shrink-0 whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-sm text-muted-foreground"
            }
          >
            {C.tabs[t]}
          </button>
        ))}
      </div>
      <main className="mx-auto max-w-4xl px-4 py-6">
        {tab === "home" ? <HomeTab grant={grant} org={org.data ?? null} /> : null}
        {tab === "boards" ? (
          <BoardsTab orgId={grant.org_id} onBoard={(id) => logView("board", id)} onItem={setOpenItem} />
        ) : null}
        {tab === "work" ? <WorkTab orgId={grant.org_id} onItem={setOpenItem} /> : null}
      </main>
      {openItem ? (
        <ItemPanel
          itemId={openItem}
          includeConversations={grant.include_conversations}
          onTurns={() => logView("conversation", openItem)}
          onClose={() => setOpenItem(null)}
        />
      ) : null}
    </div>
  );
}

function HomeTab({
  grant,
  org,
}: {
  grant: Grant;
  org: { name: string; org_mode: string | null } | null;
}) {
  const counts = useQuery({
    queryKey: ["support-view-counts", grant.org_id],
    queryFn: async () => {
      const [people, boards] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("org_id", grant.org_id),
        supabase.from("engagements").select("id", { count: "exact", head: true }).eq("org_id", grant.org_id),
      ]);
      return { people: people.count ?? 0, boards: boards.count ?? 0 };
    },
  });
  return (
    <dl className="grid gap-4 text-sm">
      <div>
        <h1 className="page-title">{org?.name}</h1>
      </div>
      <Row label={C.type} value={org?.org_mode ?? ""} />
      <Row label={C.people} value={String(counts.data?.people ?? "")} />
      <Row label={C.boardsCount} value={String(counts.data?.boards ?? "")} />
      <Row label={C.reason} value={`"${grant.reason}"`} />
    </dl>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="micro-label">{label}</dt>
      <dd className="mt-1 text-foreground">{value}</dd>
    </div>
  );
}

type Board = { id: string; title: string; created_at: string };

function BoardsTab({
  orgId,
  onBoard,
  onItem,
}: {
  orgId: string;
  onBoard: (id: string) => void;
  onItem: (id: string) => void;
}) {
  const [open, setOpen] = useState<Board | null>(null);
  const boards = useQuery({
    queryKey: ["support-view-boards", orgId],
    queryFn: async () => {
      const { data } = await supabase
        .from("engagements")
        .select("id, title, created_at")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });
      return (data ?? []) as Board[];
    },
  });
  if (open) {
    return (
      <div>
        <button type="button" onClick={() => setOpen(null)} className="text-sm text-muted-foreground underline">
          {C.allBoards}
        </button>
        <h2 className="mt-3 text-lg text-foreground">{open.title}</h2>
        <BoardCards boardId={open.id} onItem={onItem} />
      </div>
    );
  }
  const list = boards.data ?? [];
  if (!boards.isLoading && list.length === 0) return <p className="text-sm text-muted-foreground">{C.noBoards}</p>;
  return (
    <ul className="divide-y divide-border">
      {list.map((b) => (
        <li key={b.id}>
          <button
            type="button"
            onClick={() => {
              onBoard(b.id);
              setOpen(b);
            }}
            className="flex w-full items-center justify-between gap-3 py-3 text-left text-sm"
          >
            <span className="text-foreground">{b.title}</span>
            <span className="shrink-0 text-muted-foreground">{supportDate(b.created_at)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

type CardRow = {
  task_id: string;
  work_items: { id: string; title: string; source: string; captured_at: string; visibility: string } | null;
};

function BoardCards({ boardId, onItem }: { boardId: string; onItem: (id: string) => void }) {
  const cards = useQuery({
    queryKey: ["support-view-cards", boardId],
    queryFn: async () => {
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, name, position")
        .eq("engagement_id", boardId)
        .order("position", { ascending: true });
      const taskList = (tasks ?? []) as { id: string; name: string }[];
      if (taskList.length === 0) return [] as { task: string; items: NonNullable<CardRow["work_items"]>[] }[];
      const { data: rows } = await supabase
        .from("work_item_tasks")
        .select("task_id, work_items(id, title, source, captured_at, visibility)")
        .in("task_id", taskList.map((t) => t.id));
      const byTask = new Map<string, NonNullable<CardRow["work_items"]>[]>();
      for (const r of (rows ?? []) as unknown as CardRow[]) {
        if (!r.work_items) continue;
        byTask.set(r.task_id, [...(byTask.get(r.task_id) ?? []), r.work_items]);
      }
      return taskList
        .map((t) => ({ task: t.name, items: byTask.get(t.id) ?? [] }))
        .filter((g) => g.items.length > 0);
    },
  });
  const groups = cards.data ?? [];
  if (!cards.isLoading && groups.length === 0) return <p className="mt-3 text-sm text-muted-foreground">{C.noCards}</p>;
  return (
    <div className="mt-4 space-y-5">
      {groups.map((g) => (
        <section key={g.task}>
          <p className="micro-label">{g.task}</p>
          <ul className="mt-2 divide-y divide-border">
            {g.items.map((w) => (
              <li key={w.id}>
                <button type="button" onClick={() => onItem(w.id)} className="w-full py-2.5 text-left text-sm">
                  <span className="block text-foreground">{w.title}</span>
                  <span className="block text-[13px] text-muted-foreground">
                    {w.source} · {supportDate(w.captured_at)} · {w.visibility}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

type WorkRow = {
  id: string;
  title: string;
  source: string;
  captured_at: string;
  work_item_tasks: { tasks: { engagements: { title: string } | null } | null }[] | null;
};

function WorkTab({ orgId, onItem }: { orgId: string; onItem: (id: string) => void }) {
  const work = useQuery({
    queryKey: ["support-view-work", orgId],
    queryFn: async () => {
      const { data } = await supabase
        .from("work_items")
        .select("id, title, source, captured_at, work_item_tasks(tasks(engagements(title)))")
        .eq("org_id", orgId)
        .order("captured_at", { ascending: false })
        .limit(200);
      return (data ?? []) as unknown as WorkRow[];
    },
  });
  const list = work.data ?? [];
  if (!work.isLoading && list.length === 0) return <p className="text-sm text-muted-foreground">{C.noWork}</p>;
  return (
    <ul className="divide-y divide-border">
      {list.map((w) => {
        const board = w.work_item_tasks?.find((l) => l.tasks?.engagements?.title)?.tasks?.engagements?.title;
        return (
          <li key={w.id}>
            <button type="button" onClick={() => onItem(w.id)} className="w-full py-2.5 text-left text-sm">
              <span className="block text-foreground">{w.title}</span>
              <span className="block text-[13px] text-muted-foreground">
                {w.source} · {supportDate(w.captured_at)}
                {board ? ` · ${board}` : ""}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ItemPanel({
  itemId,
  includeConversations,
  onTurns,
  onClose,
}: {
  itemId: string;
  includeConversations: boolean;
  onTurns: () => void;
  onClose: () => void;
}) {
  const item = useQuery({
    queryKey: ["support-view-item", itemId],
    queryFn: async () => {
      const [w, x] = await Promise.all([
        supabase.from("work_items").select("id, title").eq("id", itemId).maybeSingle(),
        supabase.from("work_item_extracts").select("summary").eq("work_item_id", itemId).maybeSingle(),
      ]);
      return {
        title: (w.data as { title: string } | null)?.title ?? "",
        summary: (x.data as { summary: string } | null)?.summary ?? null,
      };
    },
  });
  const turns = useQuery({
    queryKey: ["support-view-turns", itemId],
    enabled: includeConversations,
    queryFn: async () => {
      const { data } = await supabase
        .from("turns")
        .select("turn_no, role, content")
        .eq("work_item_id", itemId)
        .order("turn_no", { ascending: true });
      return (data ?? []) as { turn_no: number; role: string; content: string }[];
    },
  });
  useEffect(() => {
    if (includeConversations && turns.data && turns.data.length > 0) onTurns();
  }, [includeConversations, turns.data]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <aside
      data-testid="support-item-panel"
      className="fixed inset-y-0 right-0 z-30 w-full overflow-y-auto border-l border-border bg-card p-5 shadow-card sm:w-[420px]"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base text-foreground">{item.data?.title}</h2>
        <button type="button" onClick={onClose} className="shrink-0 text-sm text-muted-foreground underline">
          {C.close}
        </button>
      </div>
      {item.data?.summary ? (
        <div className="mt-4">
          <p className="micro-label">{C.summary}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{item.data.summary}</p>
        </div>
      ) : null}
      <div className="mt-5">
        {!includeConversations ? (
          <p className="text-sm text-muted-foreground">{C.hiddenConversations}</p>
        ) : turns.data && turns.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{C.noTurns}</p>
        ) : (
          <ol className="space-y-3">
            {(turns.data ?? []).map((t) => (
              <li key={t.turn_no} className="text-sm">
                <p className="micro-label">{t.role}</p>
                <p className="mt-1 whitespace-pre-wrap text-foreground">{t.content}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </aside>
  );
}

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { SectionHeader } from "@/components/notebook/SectionHeader";
import { WorkRow } from "@/components/work/WorkRow";
import { useProfile } from "@/hooks/use-profile";
import { useWorkItems } from "@/hooks/use-work-items";
import { supabase } from "@/integrations/supabase/client";
import { bucket } from "@/lib/telemetry-shared";
import { logEvent } from "@/lib/telemetry";
import type { WorkItemRow } from "@/lib/work-types";

type ClientRecord = { id: string; name: string; code: string | null; quick_folder: boolean };
type ClientEngagement = { id: string; code: string | null; title: string | null };

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * A client is now somewhere you can go, because `work_items.client_id` holds a
 * coarse claim that no engagement touches. Every read here is the ordinary
 * browser client, so row level policies decide what comes back.
 */
export function ClientPage({ clientId }: { clientId: string }) {
  const { data: profile } = useProfile();
  const { data: workData } = useWorkItems();

  const clientQuery = useQuery({
    queryKey: ["client", clientId],
    queryFn: async (): Promise<ClientRecord | null> => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, code, quick_folder")
        .eq("id", clientId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as ClientRecord | null;
    },
  });

  const engagementsQuery = useQuery({
    queryKey: ["client-engagements", clientId],
    queryFn: async (): Promise<ClientEngagement[]> => {
      const { data, error } = await supabase
        .from("engagements")
        .select("id, code, title")
        .eq("client_id", clientId)
        .order("code");
      if (error) throw error;
      return (data ?? []) as ClientEngagement[];
    },
  });

  const client = clientQuery.data ?? null;
  const engagements = useMemo(() => engagementsQuery.data ?? [], [engagementsQuery.data]);

  // No new work_items query: the page filters the list the app already holds.
  const items = useMemo(
    () => (workData?.items ?? []).filter((item) => item.client_id === clientId),
    [workData, clientId],
  );

  const placed = useMemo(() => items.filter((item) => item.work_item_tasks.length > 0), [items]);
  const unplaced = useMemo(
    () => items.filter((item) => item.work_item_tasks.length === 0),
    [items],
  );

  const byEngagement = useMemo(() => {
    const map = new Map<string, WorkItemRow[]>();
    for (const item of placed) {
      const engagementId = item.work_item_tasks[0]?.tasks?.engagement_id ?? "";
      const list = map.get(engagementId) ?? [];
      list.push(item);
      map.set(engagementId, list);
    }
    return map;
  }, [placed]);

  const engagementCount = engagements.length;
  const itemCount = items.length;
  const unplacedCount = unplaced.length;

  const countsReady =
    clientQuery.isSuccess &&
    Boolean(clientQuery.data) &&
    engagementsQuery.isSuccess &&
    Boolean(workData);

  // Once per client, and only once the numbers it reports are real. Firing on
  // mount recorded zeroes, because none of the three reads had resolved yet.
  const seen = useRef<string | null>(null);
  useEffect(() => {
    if (!profile?.org_id) return;
    if (!countsReady) return;
    if (seen.current === clientId) return;
    seen.current = clientId;
    logEvent("client.page_viewed", profile.org_id, {
      engagements: bucket(engagementCount),
      items: bucket(itemCount),
      unplaced: bucket(unplacedCount),
    });
  }, [profile?.org_id, clientId, countsReady, engagementCount, itemCount, unplacedCount]);

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
        <PageHeader title="Client" subtitle="That client is not in your workspace." />
      </div>
    );
  }

  const subtitle = [
    plural(engagementCount, "engagement", "engagements"),
    plural(itemCount, "piece of work", "pieces of work"),
    unplacedCount > 0 ? `${unplacedCount} not in a workstream yet` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div>
      <PageHeader
        title={client.name}
        subtitle={
          <>
            {subtitle}
            <span className="mt-1 block text-[11.5px]">
              This is the work you can see. Other people at your firm may hold more for this client.
            </span>
          </>
        }
      />

      <section className="mb-10">
        <SectionHeader title="In a workstream" />
        <div className="flex flex-col gap-6">
          {engagements.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing here yet.</p>
          ) : (
            engagements.map((engagement) => {
              const rows = byEngagement.get(engagement.id) ?? [];
              return (
                <div key={engagement.id}>
                  <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                    {[engagement.code, engagement.title].filter(Boolean).join(" · ")}
                  </p>
                  {rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nothing here yet.</p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {rows.map((item) => (
                        <WorkRow
                          key={item.id}
                          item={item}
                          dense
                          actions={null}
                          clientLabel={client.name}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      {unplaced.length > 0 ? (
        <section>
          <SectionHeader title="Claimed but not placed" />
          <p className="mb-3 text-[11.5px] text-muted-foreground">
            These are yours and you have said whose they are. They still need a place in the work.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {unplaced.map((item) => (
              <WorkRow key={item.id} item={item} dense actions={null} clientLabel={client.name} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

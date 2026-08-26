import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { DeliverableCardRow } from "@/lib/overview-work-shared";

type TaskRow = {
  id: string;
  name: string;
  status: string;
  delivered_at: string | null;
  accepted_at: string | null;
  engagement_id: string;
  engagements: { title: string | null; code: string | null; client_label: string | null } | null;
  work_item_tasks: { work_item_id: string }[] | null;
};

/** The caller's own deliverables, with the archive flag each one carries. */
export const listMyDeliverables = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DeliverableCardRow[]> => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!profile || profile.role === "coach") throw new Response("Forbidden", { status: 403 });

    const { data, error } = await context.supabase
      .from("tasks")
      .select(
        "id, name, status, delivered_at, accepted_at, engagement_id, engagements(title, code, client_label), work_item_tasks(work_item_id)",
      )
      .eq("owner_id", profile.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as TaskRow[];

    const itemIds = [
      ...new Set(rows.flatMap((row) => (row.work_item_tasks ?? []).map((l) => l.work_item_id))),
    ];
    const shipped = new Set<string>();
    if (itemIds.length > 0) {
      const { data: shippedRows } = await context.supabase
        .from("shipped_work")
        .select("work_item_id")
        .in("work_item_id", itemIds);
      for (const row of (shippedRows ?? []) as { work_item_id: string }[]) {
        shipped.add(row.work_item_id);
      }
    }

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      delivered_at: row.delivered_at,
      accepted_at: row.accepted_at,
      engagement_id: row.engagement_id,
      engagement_title: row.engagements?.title ?? null,
      engagement_code: row.engagements?.code ?? null,
      client_label: row.engagements?.client_label ?? null,
      shipped: (row.work_item_tasks ?? []).some((link) => shipped.has(link.work_item_id)),
    }));
  });

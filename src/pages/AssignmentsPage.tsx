import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { PageHeader } from "@/components/layout/PageHeader";
import { useEngagements } from "@/hooks/use-engagements";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { engagementDisplayTitle } from "@/lib/clients";
import { EDU_VOCAB } from "@/lib/edu-vocab";

type AssignmentRow = { id: string; name: string; status: string; engagement_id: string };

export function AssignmentsPage() {
  const { data: profile } = useProfile();
  const { data: engagements } = useEngagements(profile?.id);
  const ids = (engagements ?? []).map((row) => row.id);

  const { data: rows } = useQuery({
    queryKey: ["assignments", ids],
    enabled: ids.length > 0,
    queryFn: async (): Promise<AssignmentRow[]> => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, name, status, engagement_id, position")
        .in("engagement_id", ids)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AssignmentRow[];
    },
  });

  const byEngagement = new Map<string, AssignmentRow[]>();
  for (const row of rows ?? []) {
    const list = byEngagement.get(row.engagement_id) ?? [];
    list.push(row);
    byEngagement.set(row.engagement_id, list);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={EDU_VOCAB.assignments}
        subtitle="Everything you have open, grouped by the class or project it belongs to."
      />
      {(engagements ?? []).map((engagement) => {
        const list = byEngagement.get(engagement.id) ?? [];
        if (list.length === 0) return null;
        return (
          <section key={engagement.id} className="space-y-2">
            <Link
              to="/engagements/$id"
              params={{ id: engagement.id }}
              className="micro-label transition-colors hover:text-foreground"
            >
              {engagementDisplayTitle(engagement)}
            </Link>
            <ul className="divide-y divide-border rounded-[var(--radius)] border border-border bg-card">
              {list.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-sm text-foreground">{row.name}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                    {row.status}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {(rows ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing open yet. Add one inside a class or a project and it will show up here.
        </p>
      ) : null}
    </div>
  );
}

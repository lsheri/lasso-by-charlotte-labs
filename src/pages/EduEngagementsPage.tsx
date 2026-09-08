import { Link } from "@tanstack/react-router";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { useEngagements } from "@/hooks/use-engagements";
import { useOrgSettings, useSaveEngagementKind } from "@/hooks/use-org-settings";
import { useProfile } from "@/hooks/use-profile";
import { engagementDisplayTitle } from "@/lib/clients";
import { KIND_LABELS, KIND_QUESTION, readKinds, type EngagementKind } from "@/lib/edu-kinds";
import { EDU_VOCAB } from "@/lib/edu-vocab";

const COPY: Record<EngagementKind, { title: string; intro: string; empty: string }> = {
  class: {
    title: EDU_VOCAB.classes,
    intro: "Every class you are keeping work for, this term and the ones before it.",
    empty: "No classes yet. Make one and your work can start landing in it.",
  },
  project: {
    title: EDU_VOCAB.projects,
    intro: "Side projects, competitions, research, anything that is not a class.",
    empty: "No projects yet. Make one and your work can start landing in it.",
  },
};

export function EduEngagementsPage({ kind }: { kind: EngagementKind }) {
  const { data: profile } = useProfile();
  const { data: engagements } = useEngagements(profile?.id);
  const { data: settings } = useOrgSettings();
  const save = useSaveEngagementKind();
  const kinds = readKinds(settings);
  const rows = engagements ?? [];
  const mine = rows.filter((row) => kinds[row.id] === kind);
  const unsorted = rows.filter((row) => !kinds[row.id]);
  const copy = COPY[kind];

  return (
    <div className="space-y-8">
      <PageHeader title={copy.title} subtitle={copy.intro} />

      <div className="grid gap-3 md:grid-cols-2">
        {mine.map((row) => (
          <Link
            key={row.id}
            to="/engagements/$id"
            params={{ id: row.id }}
            className="rounded-[var(--radius)] border border-border bg-card p-5 shadow-card transition-colors hover:border-accent-deep"
          >
            <p className="text-sm font-medium text-foreground">{engagementDisplayTitle(row)}</p>
            {row.brief ? (
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{row.brief}</p>
            ) : null}
          </Link>
        ))}
      </div>
      {mine.length === 0 ? <p className="text-sm text-muted-foreground">{copy.empty}</p> : null}

      {unsorted.length > 0 ? (
        <section className="space-y-3">
          <p className="micro-label">{KIND_QUESTION}</p>
          {unsorted.map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-border bg-card p-4"
            >
              <span className="text-sm text-foreground">{engagementDisplayTitle(row)}</span>
              <span className="flex gap-2">
                {(["class", "project"] as const).map((option) => (
                  <Button
                    key={option}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => save.mutate({ engagementId: row.id, kind: option })}
                  >
                    {KIND_LABELS[option]}
                  </Button>
                ))}
              </span>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}

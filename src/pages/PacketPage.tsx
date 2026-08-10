import { useEffect } from "react";

import { CoachChat } from "@/components/coaching/CoachChat";
import { NoteComposer, type CitationOption } from "@/components/coaching/NoteComposer";
import { usePacket, type PacketElement } from "@/hooks/use-coaching";
import { useProfile } from "@/hooks/use-profile";
import { logEvent } from "@/lib/telemetry";
import { formatDate, sourceLabel } from "@/lib/work-types";

function elementDate(element: PacketElement): string {
  const item = element.work_items;
  if (!item) return "";
  return item.work_date ?? item.created_at_source ?? item.captured_at;
}

function orderElements(elements: PacketElement[]): PacketElement[] {
  const withItems = elements.filter((element) => element.work_items !== null);
  const confirmed = withItems.filter((e) => e.step_confirmed && e.step_no !== null);
  const rest = withItems
    .filter((e) => !(e.step_confirmed && e.step_no !== null))
    .sort((a, b) => new Date(elementDate(a)).getTime() - new Date(elementDate(b)).getTime());
  return [...confirmed.sort((a, b) => (a.step_no ?? 0) - (b.step_no ?? 0)), ...rest];
}

export function PacketPage({
  engagementId,
  subjectId,
}: {
  engagementId: string;
  subjectId: string;
}) {
  const { data: profile } = useProfile();
  const { data, isLoading, error } = usePacket(engagementId, subjectId);

  useEffect(() => {
    if (profile?.org_id && data?.engagement) logEvent("packet.viewed", profile.org_id, {});
  }, [profile?.org_id, data?.engagement]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data?.engagement || !data.subject) {
    return <p className="text-sm text-muted-foreground">This isn&apos;t available to you.</p>;
  }

  const subjectName = data.subject.display_name;
  const citations: CitationOption[] = [
    ...data.decisions.map((decision) => ({
      id: decision.id,
      kind: "decision" as const,
      label: decision.call_text.slice(0, 48),
    })),
    ...data.tasks.map((task) => ({ id: task.id, kind: "task" as const, label: task.name })),
  ];

  return (
    <div className="space-y-10">
      <header>
        <p className="micro-label">Coaching packet</p>
        <h1 className="page-title mt-1.5">{subjectName}</h1>
        <p className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          {data.engagement.code} · {data.engagement.title}
          {data.engagement.term_label ? ` · ${data.engagement.term_label}` : ""}
        </p>
        {data.engagement.brief ? (
          <div className="mt-4 rounded-[var(--radius)] border border-border bg-card px-5 py-4 shadow-card">
            <p className="micro-label">Brief</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
              {data.engagement.brief}
            </p>
          </div>
        ) : null}
      </header>

      <section>
        <h2 className="micro-label">How the work ran</h2>
        <div className="mt-3 space-y-2">
          {data.tasks.map((task) => {
            const elements = orderElements(task.work_item_tasks ?? []);
            return (
              <div
                key={task.id}
                className="rounded-[var(--radius)] border border-border bg-card px-4 py-3 shadow-card"
              >
                <p className="text-sm font-medium text-foreground">{task.name}</p>
                {task.goal ? (
                  <p className="mt-0.5 text-sm text-muted-foreground">{task.goal}</p>
                ) : null}
                <ul className="mt-2 space-y-1">
                  {elements.map((element, index) => {
                    const item = element.work_items;
                    if (!item) return null;
                    return (
                      <li
                        key={item.id}
                        className="flex items-center gap-3 rounded-[var(--radius)] border border-border bg-background px-3 py-2"
                      >
                        {element.step_confirmed && element.step_no !== null ? (
                          <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[10px] text-accent-deep">
                            {index + 1}
                          </span>
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-foreground">{item.title}</p>
                          <p className="truncate font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                            {item.type.replace("_", " ")} · {sourceLabel(item.source)} ·{" "}
                            {formatDate(elementDate(element))}
                          </p>
                        </div>
                        {item.content_fidelity === "summary" ? (
                          <span className="shrink-0 rounded-full border border-border bg-secondary px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                            Summary
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
          {data.tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing shared here yet.</p>
          ) : null}
        </div>
      </section>

      {data.decisions.length > 0 ? (
        <section>
          <h2 className="micro-label">Confirmed decisions</h2>
          <div className="mt-3 space-y-2">
            {data.decisions.map((decision) => (
              <article
                key={decision.id}
                className="rounded-[var(--radius)] border border-border bg-card px-5 py-4 shadow-card"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="micro-label">The call</span>
                  {decision.date_label ? (
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {decision.date_label}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm font-medium text-foreground">{decision.call_text}</p>
                <p className="mt-2 text-sm text-muted-foreground">{decision.situation}</p>
                <p className="mt-2 border-l-2 border-accent pl-4 text-sm text-foreground">
                  {decision.why}
                </p>
                {Array.isArray(decision.srcs) && decision.srcs.length > 0 ? (
                  <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                    {decision.srcs.length} source
                    {decision.srcs.length === 1 ? "" : "s"} in the shared work
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {data.notes.length > 0 ? (
        <section>
          <h2 className="micro-label">Earlier coaching notes</h2>
          <div className="mt-3 space-y-2">
            {data.notes.map((note) => (
              <CoachingNoteCard
                key={note.id}
                note={note}
                heading={new Date(note.created_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              />
            ))}
          </div>
        </section>
      ) : null}

      <NoteComposer subjectId={subjectId} engagementId={engagementId} citations={citations} />

      <CoachChat
        subjectId={subjectId}
        engagementId={engagementId}
        subjectName={subjectName.split(" ")[0] ?? subjectName}
      />
    </div>
  );
}

export function CoachingNoteCard({
  note,
  heading,
}: {
  note: { did_well: string; would_try: string; watch_next: string };
  heading: string;
}) {
  return (
    <article className="rounded-[var(--radius)] border border-border bg-card px-5 py-4 shadow-card">
      <p className="micro-label">{heading}</p>
      <div className="mt-3 space-y-3">
        <NoteField label="What went well" value={note.did_well} />
        <NoteField label="What to try" value={note.would_try} />
        <NoteField label="What to watch" value={note.watch_next} />
      </div>
    </article>
  );
}

function NoteField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="micro-label mb-1">{label}</p>
      <p className="whitespace-pre-wrap text-sm text-foreground">{value}</p>
    </div>
  );
}

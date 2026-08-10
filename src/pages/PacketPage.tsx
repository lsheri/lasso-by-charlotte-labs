import { useEffect, useMemo } from "react";

import { CoachChat } from "@/components/coaching/CoachChat";
import { NoteComposer, type CitationOption } from "@/components/coaching/NoteComposer";
import { TaskWorkflow, type WorkflowElement } from "@/components/work/TaskWorkflow";
import { usePacket, type PacketElement } from "@/hooks/use-coaching";
import { useProfile } from "@/hooks/use-profile";
import { logEvent } from "@/lib/telemetry";

const SEEN_PREFIX = "lasso.packet_seen.";

function readSeen(key: string): string | null {
  try {
    return window.localStorage.getItem(SEEN_PREFIX + key);
  } catch {
    return null;
  }
}

function writeSeen(key: string, iso: string): void {
  try {
    window.localStorage.setItem(SEEN_PREFIX + key, iso);
  } catch {
    /* remembering the last visit is a nicety, not a requirement */
  }
}

function toWorkflowElements(elements: PacketElement[]): WorkflowElement[] {
  return elements
    .filter((element) => element.work_items !== null)
    .map((element) => ({
      step_no: element.step_no,
      step_confirmed: element.step_confirmed,
      work_items: { ...element.work_items!, work_item_tasks: [] },
    }));
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

  const seenKey = `${engagementId}.${subjectId}`;

  const newest = useMemo(() => {
    if (!data) return null;
    const stamps = [
      ...data.decisions.map((decision) => decision.created_at),
      ...data.tasks.flatMap((task) =>
        (task.work_item_tasks ?? []).map((element) => element.mapped_at),
      ),
    ].sort();
    return stamps.length > 0 ? (stamps[stamps.length - 1] as string) : null;
  }, [data]);

  const lastSeen = useMemo(
    () => (typeof window === "undefined" ? null : readSeen(seenKey)),
    [seenKey],
  );
  const hasNewer = Boolean(newest && lastSeen && newest > lastSeen);

  useEffect(() => {
    if (!data?.engagement) return;
    if (profile?.org_id) logEvent("packet.viewed", profile.org_id, {});
    writeSeen(seenKey, new Date().toISOString());
  }, [profile?.org_id, data?.engagement, seenKey]);

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
        {hasNewer ? (
          <p className="mt-2 inline-block rounded-full bg-accent-soft px-3 py-1 font-mono text-[11px] tracking-[0.06em] text-accent-deep">
            Newer material since your last visit
          </p>
        ) : null}
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
          {data.tasks.map((task) => (
            <div
              key={task.id}
              className="rounded-[var(--radius)] border border-border bg-card px-4 py-3 shadow-card"
            >
              <p className="text-sm font-medium text-foreground">{task.name}</p>
              {task.goal ? (
                <p className="mt-0.5 text-sm text-muted-foreground">{task.goal}</p>
              ) : null}
              <div className="mt-2">
                <TaskWorkflow
                  taskId={task.id}
                  elements={toWorkflowElements(task.work_item_tasks ?? [])}
                  canEdit={false}
                  orgId={profile?.org_id}
                  onChanged={() => undefined}
                />
              </div>
            </div>
          ))}
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

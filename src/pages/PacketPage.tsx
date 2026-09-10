import { useEffect, useMemo, useState } from "react";

import { CoachChat } from "@/components/coaching/CoachChat";
import { NoteComposer, type CitationOption } from "@/components/coaching/NoteComposer";
import { PeekPanel } from "@/components/peek/PeekPanel";
import { AnalysisLens } from "@/components/reflect/AnalysisLens";
import { TaskWorkflow, type WorkflowElement } from "@/components/work/TaskWorkflow";
import { usePacket, type PacketElement } from "@/hooks/use-coaching";
import { useProfile } from "@/hooks/use-profile";
import { CoachOutcomeCard } from "@/components/coaching/CoachOutcomeCard";
import { FirmChecksCard } from "@/components/coaching/FirmChecksCard";
import { ToneCard } from "@/components/notebook/ToneCard";
import { SourceMark } from "@/components/work/SourceMark";
import { isBriefItem } from "@/lib/brief-shared";
import { contentsUnread } from "@/lib/text-status";
import { logEvent } from "@/lib/telemetry";
import { engagementLabel } from "@/lib/clients";
import type { WorkItemRow } from "@/lib/work-types";
import { markOpenStart } from "@/lib/perf-timing";

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
  const [peekItem, setPeekItem] = useState<WorkItemRow | null>(null);
  const [lensItem, setLensItem] = useState<WorkItemRow | null>(null);

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

  // Honesty for the coach: the same field the work list marks is what says
  // how much of this record could actually be read.
  const titleOnlyCount = useMemo(() => {
    if (!data) return 0;
    const seen = new Map<string, unknown>();
    for (const task of data.tasks) {
      for (const element of task.work_item_tasks ?? []) {
        if (element.work_items) seen.set(element.work_items.id, element.work_items.meta);
      }
    }
    return Array.from(seen.values()).filter((meta) => contentsUnread(meta as never)).length;
  }, [data]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data?.engagement || !data.subject) {
    return <p className="text-sm text-muted-foreground">This isn&apos;t available to you.</p>;
  }

  const subjectName = data.subject.display_name;
  const sharedBriefs = data.tasks
    .flatMap((task) => task.work_item_tasks ?? [])
    .map((element) => element.work_items)
    .filter((item): item is NonNullable<typeof item> => item !== null && isBriefItem(item));
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
        <p className="font-hand text-lg text-green">People you coach / {subjectName}</p>
        <p className="micro-label micro-label-section mt-3">
          What {subjectName} has chosen to share
        </p>
        {hasNewer ? (
          <p className="mt-2 inline-block rounded-full bg-accent-soft px-3 py-1 font-mono text-[11px] tracking-[0.06em] text-foreground">
            Newer material since your last visit
          </p>
        ) : null}
        <h1 className="page-title mt-1.5" title={subjectName}>
          {subjectName}
        </h1>
        <p className="page-subtitle">
          {engagementLabel(data.engagement)}
          {data.engagement.term_label ? ` · ${data.engagement.term_label}` : ""}
        </p>
        {sharedBriefs.length > 0 ? (
          <div className="mt-4 rounded-[var(--radius-control)] border border-accent bg-card px-5 py-4 shadow-card">
            <p className="micro-label micro-label-section">What {subjectName} was asked to do</p>
            {sharedBriefs.map((item) => (
              <p key={item.id} className="mt-1.5 text-sm font-medium text-foreground">
                {item.title}
              </p>
            ))}
            <p className="mt-1 text-sm text-muted-foreground">
              Shared with you as the brief for this work.
            </p>
          </div>
        ) : null}
        {data.engagement.brief ? (
          <div className="mt-4 rounded-[var(--radius-control)] border border-[var(--nb-pencil)] bg-card px-5 py-4 shadow-card">
            <p className="micro-label">Brief</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
              {data.engagement.brief}
            </p>
          </div>
        ) : null}
      </header>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10">
        <div className="min-w-0 space-y-10">
          <section>
            <h2 className="micro-label micro-label-section">How the work ran</h2>
            <div className="mt-3 space-y-3">
              {data.tasks.map((task) => {
                const taskItems = (task.work_item_tasks ?? [])
                  .map((element) => element.work_items)
                  .filter((item): item is NonNullable<typeof item> => item !== null);
                return (
                  <ToneCard
                    key={task.id}
                    tone="paper"
                    title={task.name}
                    mark={
                      taskItems.length > 0 ? (
                        <span className="flex items-center gap-1.5 opacity-65">
                          {taskItems.map((item) => (
                            <SourceMark key={item.id} item={item} size={20} />
                          ))}
                        </span>
                      ) : null
                    }
                    className="gap-2 p-4"
                  >
                    {task.goal ? <p>{task.goal}</p> : null}
                    <div className="mt-2">
                      <TaskWorkflow
                        taskId={task.id}
                        elements={toWorkflowElements(task.work_item_tasks ?? [])}
                        canEdit={false}
                        orgId={profile?.org_id}
                        onChanged={() => undefined}
                        onOpen={(item) => {
                          markOpenStart("peek.open");
                          setPeekItem(item);
                        }}
                      />
                    </div>
                  </ToneCard>
                );
              })}
              {data.tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing shared here yet.</p>
              ) : null}
            </div>
          </section>

          <CoachOutcomeCard engagementId={engagementId} role={profile?.role} />

          <FirmChecksCard
            orgId={profile?.org_id}
            authorProfileId={profile?.id}
            role={profile?.role}
            engagementId={engagementId}
            subjectProfileId={subjectId}
            subjectName={subjectName}
          />

          {data.decisions.length > 0 ? (
            <section>
              <h2 className="micro-label micro-label-section">Confirmed decisions</h2>
              <div className="mt-3 space-y-2">
                {data.decisions.map((decision) => (
                  <article key={decision.id} className="border-b border-[var(--nb-pencil)] px-1 py-4 first:pt-0">
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
              <h2 className="micro-label micro-label-section">Earlier coaching notes</h2>
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

          <NoteComposer
            subjectId={subjectId}
            engagementId={engagementId}
            citations={citations}
            latestActivityAt={newest}
          />

          <CoachChat
            subjectId={subjectId}
            engagementId={engagementId}
            subjectName={subjectName.split(" ")[0] ?? subjectName}
            titleOnlyCount={titleOnlyCount}
          />
        </div>

        <aside className="mt-10 space-y-4 lg:mt-0">
          <ToneCard
            tone="record"
            label="WHAT LASSO READ TO BUILD THIS"
            title={`${data.decisions.length} confirmed decision${data.decisions.length === 1 ? "" : "s"}`}
            className="gap-3 p-4"
          >
            <p>Mapped work in this engagement</p>
            <p>Confirmed decisions and earlier coaching notes</p>
            <p>Answers come only from what {subjectName} has shared here.</p>
          </ToneCard>
          <p className="font-hand text-green">he chose what you see. that is the point.</p>
        </aside>
      </div>

      <PeekPanel
        entry={peekItem}
        open={peekItem !== null}
        onOpenChange={(next) => {
          if (!next) setPeekItem(null);
        }}
        canEdit={false}
        onAnalyse={(item) => {
          setPeekItem(null);
          setLensItem(item);
        }}
      />

      {profile && lensItem ? (
        <AnalysisLens
          key={lensItem.id}
          open
          onOpenChange={(next) => {
            if (!next) setLensItem(null);
          }}
          target={{
            kind: "item",
            id: lensItem.id,
            title: lensItem.title,
            scope: lensItem.type === "ai_thread" ? "thread" : "deliverable",
          }}
          profileId={profile.id}
          orgId={profile.org_id}
          isCoach
        />
      ) : null}
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
    <article className="border-b border-[var(--nb-pencil)] px-1 py-4 first:pt-0">
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

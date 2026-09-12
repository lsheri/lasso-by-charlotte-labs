import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";

import { CoachingLinkNotices } from "@/components/coaching/CoachingLinkNotices";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionHeader } from "@/components/notebook/SectionHeader";
import { ToneCard } from "@/components/notebook/ToneCard";
import { ArchiveTeaser } from "@/components/archive/ArchiveTeaser";
import { ChatsToOrganise } from "@/components/overview/ChatsToOrganise";
import { ReadingPanel } from "@/components/overview/ReadingPanel";
import { NotCovered } from "@/components/overview/NotCovered";
import { OneOnOneBrief } from "@/components/oneonone/OneOnOneBrief";
import { Button } from "@/components/ui/button";
import { useDecisions, srcsOf } from "@/hooks/use-decisions";
import { useWorkItems } from "@/hooks/use-work-items";
import { useEngagements } from "@/hooks/use-engagements";
import { useProfile } from "@/hooks/use-profile";
import { isCoach } from "@/lib/role-access";

/** "2 SEP" — the mono date the cards use. */
function shortDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getDate()} ${d.toLocaleString("en-US", { month: "short" }).toUpperCase()}`;
}

/** "GOOGLE DRIVE" from a vendor or source string. */
function sourceLabel(vendor: string | null | undefined, source: string | null | undefined): string {
  const raw = vendor || source || "";
  return raw.replace(/[_-]+/g, " ").trim().toUpperCase();
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function OverviewPage() {
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const [prepOpen, setPrepOpen] = useState(false);
  const coach = isCoach(profile);

  // Overview is a person's own work. A coach has none, and their home is the
  // list of people who have shared work with them, so send them there.
  useEffect(() => {
    if (coach) void navigate({ to: "/coaching", replace: true });
  }, [coach, navigate]);

  const { data: decisions } = useDecisions();
  const { data: workData } = useWorkItems();
  const { data: engagements } = useEngagements(profile?.id);

  const rows = useMemo(() => decisions ?? [], [decisions]);
  const drafts = useMemo(() => rows.filter((r) => r.status === "draft"), [rows]);
  const confirmed = useMemo(() => rows.filter((r) => r.status === "confirmed"), [rows]);
  const items = useMemo(() => workData?.items ?? [], [workData]);

  // engagement_id -> display code, so a card can say where it landed.
  const codeById = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of (engagements ?? []) as { id: string; code?: string | null }[]) {
      if (e.code) map.set(e.id, e.code);
    }
    return map;
  }, [engagements]);

  if (coach) {
    return (
      <div>
        <PageHeader title="Shared with you" subtitle="Taking you to the people you coach." />
      </div>
    );
  }

  const waiting = drafts.slice(0, 2);
  const thisWeek = items.slice(0, 4);
  // Figma 21:2 "What Lasso is reading": the most recent arrivals from a
  // connected tool. Anything without a vendor came in by hand, so it is not
  // something Lasso went and read.
  const reading = items.filter((item) => Boolean(item.source_vendor)).slice(0, 3);

  const statLine = [
    plural(confirmed.length, "call on the record", "calls on the record"),
    plural(items.length, "piece of work", "pieces of work"),
    plural(drafts.length, "thing waiting on you", "things waiting on you"),
  ].join(" · ");

  const reviewLabel =
    drafts.length === 1 ? "Review it" : drafts.length === 2 ? "Review both" : "Review all";

  return (
    <div>
      <PageHeader title="Your" italicWord="work" subtitle={statLine} />

      <CoachingLinkNotices />

      {waiting.length > 0 ? (
        <section className="mt-2" data-testid="overview-waiting">
          <SectionHeader
            title="Waiting on you"
            action={
              <Link to="/decisions" className="text-[11.5px] text-accent-deep hover:underline">
                Open Your calls
              </Link>
            }
          />
          <div className="flex flex-wrap items-start gap-4">
            {waiting.map((row) => {
              const code = row.engagement_id ? codeById.get(row.engagement_id) : undefined;
              const srcCount = srcsOf(row).length;
              const meta = [code, srcCount > 0 ? plural(srcCount, "source", "sources") : ""]
                .filter(Boolean)
                .join(" · ");
              return (
                <ToneCard
                  key={row.id}
                  tone="claim"
                  label={["YOUR CALL", row.date_label].filter(Boolean).join(" · ")}
                  title={row.call_text ?? row.situation ?? "Untitled call"}
                  meta={meta}
                  className="w-[360px] max-w-full"
                />
              );
            })}

            <div className="flex w-[316px] max-w-full flex-col gap-2.5">
              <div>
                <Button type="button" onClick={() => void navigate({ to: "/decisions" })}>
                  {reviewLabel}
                </Button>
              </div>
              <p className="text-[11.5px] leading-[17px] text-muted-foreground">
                Lasso drafted these from your conversations. Nothing goes on the record until you
                say so.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {thisWeek.length > 0 ? (
        <section className="mt-10" data-testid="overview-this-week">
          <SectionHeader title="This week" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {thisWeek.map((item) => {
              const mapped = item.work_item_tasks?.[0]?.tasks;
              const code = mapped?.engagements?.code ?? null;
              const label = [
                sourceLabel(item.source_vendor, item.source),
                shortDate(item.captured_at ?? item.work_date),
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <Link key={item.id} to="/work" className="block">
                  <ToneCard
                    tone="paper"
                    label={label}
                    title={item.title ?? "Untitled"}
                    meta={code ?? "UNMAPPED"}
                    className="h-full transition-colors hover:border-foreground"
                  />
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <ReadingPanel items={reading} />

      <NotCovered />

      {profile ? (
        <div className="mt-10">
          <Button type="button" variant="secondary" onClick={() => setPrepOpen(true)}>
            Prepare a 1:1
          </Button>
          <OneOnOneBrief
            open={prepOpen}
            onOpenChange={setPrepOpen}
            profileId={profile.id}
            scopeLabel="All of your work"
          />
        </div>
      ) : null}

      <ArchiveTeaser />
    </div>
  );
}

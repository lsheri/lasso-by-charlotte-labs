import { useMemo } from "react";
import { Link, useNavigate } from "@tanstack/react-router";

import { SectionHeader } from "@/components/notebook/SectionHeader";
import { ToneCard } from "@/components/notebook/ToneCard";
import { Button } from "@/components/ui/button";
import { useDecisions, srcsOf } from "@/hooks/use-decisions";
import { useEngagements } from "@/hooks/use-engagements";
import { useProfile } from "@/hooks/use-profile";

/**
 * PASS A1 — the drafted calls waiting on a person, lifted off the retired
 * Overview onto the Inbox unchanged. It owns its own reads so the Inbox keeps
 * the hook list it already had. Styling is deliberately as it was: Pass B
 * restyles it.
 */

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function WaitingOnYou() {
  const { data: profile } = useProfile();
  const { data: decisions } = useDecisions();
  const { data: engagements } = useEngagements(profile?.id);
  const navigate = useNavigate();

  const drafts = useMemo(
    () => (decisions ?? []).filter((row) => row.status === "draft"),
    [decisions],
  );

  // engagement_id -> display code, so a card can say where it landed.
  const codeById = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of (engagements ?? []) as { id: string; code?: string | null }[]) {
      if (e.code) map.set(e.id, e.code);
    }
    return map;
  }, [engagements]);

  if (profile?.role === "coach") return null;

  const waiting = drafts.slice(0, 2);
  if (waiting.length === 0) return null;

  const reviewLabel =
    drafts.length === 1 ? "Review it" : drafts.length === 2 ? "Review both" : "Review all";

  return (
    <section className="mb-8" data-testid="overview-waiting">
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
            Lasso drafted these from your conversations. Nothing goes on the record until you say
            so.
          </p>
        </div>
      </div>
    </section>
  );
}
